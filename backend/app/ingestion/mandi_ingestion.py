"""Live Indian Mandi Vegetable Price Ingestion Worker for Vertex AI RAG Pipeline.

Queries the official Open Government Data API (data.gov.in) Resource ID:
9ef84268-d588-465a-a308-a864a43d0070
Normalizes prices (₹/quintal and ₹/kg), chunks records with restricts,
generates Vertex AI embeddings, and upserts into vector store.
"""

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path

# Ensure UTF-8 output on Windows console
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.ingestion.chunker import PriceChunker
from app.ingestion.embedder import VertexAIEmbedder
from app.ingestion.fetcher import AgmarknetFetcher
from app.ingestion.models import MandiPriceRecord, PriceChunk
from app.rag.vector_store import get_vector_store

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("mandi_ingestion")


async def run_mandi_ingestion(
    commodity: str | None = None,
    state: str | None = None,
    limit: int = 200,
    local_dump_path: str | None = None,
    generate_embeddings: bool = True,
    output_json_path: Path | None = None,
    gcs_jsonl_path: Path | None = None,
) -> list[PriceChunk]:
    """Execute live mandi vegetable price ingestion and Vertex AI RAG indexing."""
    logger.info("=== STEP 1: Ingesting Live Mandi Price Data ===")

    records: list[MandiPriceRecord] = []
    if local_dump_path:
        logger.info("Ingesting from local historical dump: %s", local_dump_path)
        records = AgmarknetFetcher.load_from_local_dump(
            file_path=local_dump_path,
            state=state,
            commodity=commodity,
            limit=limit,
        )

    if not records:
        logger.info(
            "Fetching from data.gov.in (Resource ID: 9ef84268-d588-465a-a308-a864a43d0070)..."
        )
        fetcher = AgmarknetFetcher()
        records = await fetcher.fetch_prices(state=state, commodity=commodity, limit=limit)

    logger.info("Total normalized mandi records: %d", len(records))
    if not records:
        logger.warning("No records ingested.")
        return []

    logger.info("=== STEP 2: Document Chunking & Metadata Structuring ===")
    chunker = PriceChunker(include_comparative_chunks=True)
    chunks = chunker.chunk_records(records)
    logger.info("Generated %d chunks with Vertex AI restricts and dense snippets.", len(chunks))

    if generate_embeddings:
        logger.info("=== STEP 3: Generating Vertex AI Embeddings (text-embedding-004) ===")
        embedder = VertexAIEmbedder()
        chunks = embedder.embed_chunks(chunks, fallback_to_mock=True)
        embedded_count = sum(1 for c in chunks if c.embedding is not None)
        logger.info("Embedded %d / %d chunks with 768-dim vectors.", embedded_count, len(chunks))

    logger.info("=== STEP 4: Upserting into Vector Store ===")
    vector_store = get_vector_store()
    added_count = vector_store.add_chunks(chunks)
    logger.info(
        "Upserted %d vectors into vector store (%s).", added_count, type(vector_store).__name__
    )

    # Save chunks locally for inspection
    if output_json_path:
        output_json_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_json_path, "w", encoding="utf-8") as f:
            json.dump([c.model_dump() for c in chunks], f, indent=2)
        logger.info("Saved chunks to %s", output_json_path)

    # Optional: Save JSONL batch dump for GCS staging upload to Vertex AI Vector Search
    if gcs_jsonl_path:
        gcs_jsonl_path.parent.mkdir(parents=True, exist_ok=True)
        with open(gcs_jsonl_path, "w", encoding="utf-8") as f:
            for c in chunks:
                if c.embedding:
                    line = {
                        "id": c.chunk_id,
                        "embedding": c.embedding,
                        "restricts": c.metadata.get("restricts", []),
                        "numeric_restricts": c.metadata.get("numeric_restricts", []),
                    }
                    f.write(json.dumps(line) + "\n")
        logger.info("Wrote GCS staging JSONL batch dump to %s", gcs_jsonl_path)

    return chunks


def main() -> None:
    """CLI runner for mandi ingestion."""
    parser = argparse.ArgumentParser(
        description="Live Indian Mandi Vegetable Price Ingestion for Vertex AI RAG"
    )
    parser.add_argument(
        "--commodity", type=str, default=None, help="Vegetable commodity (e.g. 'Tomato')"
    )
    parser.add_argument(
        "--state", type=str, default=None, help="State filter (e.g. 'Maharashtra')"
    )
    parser.add_argument("--limit", type=int, default=200, help="Maximum records to ingest")
    parser.add_argument(
        "--local-dump", type=str, default=None, help="Path to local historical CSV/JSON dump"
    )
    parser.add_argument("--no-embeddings", action="store_true", help="Skip generating embeddings")
    parser.add_argument(
        "--output",
        type=str,
        default="data/rag_docs/mandi_price_chunks.json",
        help="Path to save output chunks JSON",
    )
    parser.add_argument(
        "--gcs-jsonl",
        type=str,
        default="data/rag_docs/vertex_datapoints.jsonl",
        help="Path to save GCS JSONL batch dump",
    )

    args = parser.parse_args()

    chunks = asyncio.run(
        run_mandi_ingestion(
            commodity=args.commodity,
            state=args.state,
            limit=args.limit,
            local_dump_path=args.local_dump,
            generate_embeddings=not args.no_embeddings,
            output_json_path=Path(args.output) if args.output else None,
            gcs_jsonl_path=Path(args.gcs_jsonl) if args.gcs_jsonl else None,
        )
    )

    print("\n========================================================")
    print(f"INGESTION COMPLETED: {len(chunks)} chunks processed.")
    print("========================================================")
    for i, c in enumerate(chunks[:2], 1):
        print(f"\n[Sample Chunk {i}] ID: {c.chunk_id}")
        print(f"Text: {c.text}")
        print(f"Restricts: {c.metadata.get('restricts')}")
        print(f"Numeric Restricts: {c.metadata.get('numeric_restricts')}")


if __name__ == "__main__":
    main()
