"""CIBRC Statutory Registry Semantic Embedding Ingestion Script.

Generates 768-dimensional multilingual embeddings using VertexAIEmbedder (text-embedding-004)
and populates the 'embedding' column in the PostgreSQL / SQLite cibrc_pesticide_registry table.
"""

import json
import logging
import os
import sys
from pathlib import Path
from typing import Any

CURRENT_FILE = Path(__file__).resolve()
BACKEND_DIR = CURRENT_FILE.parents[1]
PROJECT_ROOT = BACKEND_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from database.cibrc_isolated_db import get_cibrc_cursor  # noqa: E402
from database.connection import is_postgres_active  # noqa: E402

from app.ingestion.embedder import VertexAIEmbedder  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("EmbedCibrcRegistry")


def construct_cibrc_embedding_text(record: dict[str, Any]) -> str:
    """Builds semantic representation of a CIBRC statutory record for multilingual retrieval."""
    crop = record.get("crop", "")
    crop_key = record.get("crop_key", "")
    pest_name = record.get("pesticide_name", "")
    active_ing = record.get("active_ingredient", "")
    formulation = record.get("formulation", "")
    target = record.get("target_pest_or_disease", "")
    category = record.get("category", "")
    method = record.get("application_method", "")
    dose = record.get("pump_dose_15l", "")

    return (
        f"Crop: {crop} ({crop_key}) | Category: {category} | Chemical: {pest_name} | "
        f"Active Ingredient: {active_ing} {formulation} | "
        f"Target Pests and Diseases: {target} | Spray Method: {method} | Pump Dose: {dose}"
    ).strip()


def run_embedding_ingestion(
    embedder: Any | None = None,
    batch_size: int = 25,
    force_all: bool = False,
    crop_filter: str | None = None,
) -> int:
    """Embeds CIBRC pesticide records and writes vector embeddings to database.

    Args:
        embedder: Custom embedder instance (or defaults to VertexAIEmbedder).
        batch_size: Batch size for embedding calls.
        force_all: If True, re-embed records even if an embedding exists.
        crop_filter: Optional crop_key to limit embedding to specific crops.

    Returns:
        Number of records successfully embedded.
    """
    if embedder is None:
        embedder = VertexAIEmbedder()

    use_pg = is_postgres_active()
    ph = "%s" if use_pg else "?"

    # Ensure embedding column exists
    with get_cibrc_cursor() as cur:
        if use_pg:
            try:
                cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
                cur.execute(
                    "ALTER TABLE cibrc_pesticide_registry ADD COLUMN IF NOT EXISTS "
                    "embedding vector(768);"
                )
            except Exception:
                try:
                    cur.execute(
                        "ALTER TABLE cibrc_pesticide_registry ADD COLUMN IF NOT EXISTS "
                        "embedding text;"
                    )
                except Exception:
                    pass
        else:
            try:
                cur.execute("ALTER TABLE cibrc_pesticide_registry ADD COLUMN embedding TEXT;")
            except Exception:
                pass

    query = (
        "SELECT id, category, pesticide_name, active_ingredient, formulation, crop, crop_key, "
        "target_pest_or_disease, pump_dose_15l, application_method, payload "
        "FROM cibrc_pesticide_registry WHERE 1=1"
    )
    params: list[Any] = []

    if not force_all:
        query += " AND (embedding IS NULL OR embedding = '')"

    if crop_filter:
        query += f" AND LOWER(crop_key) = LOWER({ph})"
        params.append(crop_filter.strip().lower())

    query += " ORDER BY id ASC;"

    records: list[dict[str, Any]] = []
    with get_cibrc_cursor() as cur:
        cur.execute(query, tuple(params))
        rows = cur.fetchall()
        for r in rows:
            records.append(dict(r))

    total = len(records)
    logger.info(
        "Found %d CIBRC records to embed (force_all=%s, crop_filter=%s)",
        total,
        force_all,
        crop_filter,
    )
    if total == 0:
        return 0

    embedded_count = 0
    for i in range(0, total, batch_size):
        batch = records[i : i + batch_size]
        texts = [construct_cibrc_embedding_text(r) for r in batch]

        try:
            vectors = embedder.embed_texts(texts, task_type="RETRIEVAL_DOCUMENT")
        except Exception as exc:
            logger.error("Embedding failed for batch %d-%d: %s", i, i + len(batch), exc)
            if os.getenv("KS_ENV", "").lower() in ("prod", "production"):
                raise
            continue

        with get_cibrc_cursor() as cur:
            for record, vector in zip(batch, vectors, strict=False):
                rec_id = record["id"]
                vec_json = json.dumps(vector)

                payload_data = record.get("payload") or {}
                if isinstance(payload_data, str):
                    try:
                        payload_data = json.loads(payload_data)
                    except Exception:
                        payload_data = {}
                payload_data["embedding"] = vector
                updated_payload = json.dumps(payload_data)

                if use_pg:
                    try:
                        update_sql = """
                            UPDATE cibrc_pesticide_registry
                            SET embedding = %s::vector,
                                payload = %s::jsonb,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = %s;
                        """
                        cur.execute(update_sql, (vec_json, updated_payload, rec_id))
                    except Exception:
                        update_sql = """
                            UPDATE cibrc_pesticide_registry
                            SET embedding = %s,
                                payload = %s::jsonb,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = %s;
                        """
                        cur.execute(update_sql, (vec_json, updated_payload, rec_id))
                else:
                    update_sql = """
                        UPDATE cibrc_pesticide_registry
                        SET embedding = ?,
                            payload = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?;
                    """
                    cur.execute(update_sql, (vec_json, updated_payload, rec_id))

                embedded_count += 1

        logger.info(
            "Embedded batch %d-%d / %d",
            i + 1,
            min(i + batch_size, total),
            total,
        )

    logger.info("CIBRC embedding ingestion completed. Total embedded: %d", embedded_count)
    return embedded_count


if __name__ == "__main__":
    count = run_embedding_ingestion()
    print(f"Finished embedding {count} CIBRC rows.")
