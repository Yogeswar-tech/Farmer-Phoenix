"""Crop Guide RAG retrieval — queries vector store for PDF-sourced crop advisory data."""

from __future__ import annotations

import logging
import re
from typing import Any

logger = logging.getLogger("CropGuideRAG")


def _normalize_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def get_crop_guide_data(
    crop_key: str,
    symptom_query: str | None = None,
    top_k: int = 5,
) -> dict[str, Any] | None:
    """Retrieve crop guide chunks from the vector store for a given crop.

    Returns None when no crop guide data is found (caller must handle).
    Returns a dict with keys: crop_key, crop_name, overview, diseases, source.
    """
    try:
        from app.ingestion.embedder import VertexAIEmbedder
        from app.rag.vector_store import get_vector_store

        store = get_vector_store()
        if store.count() == 0:
            return None

        key = _normalize_key(crop_key)

        # Try a few spelling variants
        variants = {key, key.replace("_", " ")}

        # Query with the symptom text if provided, else use crop name
        query_text = f"{crop_key} {symptom_query or ''}".strip()

        embedder = VertexAIEmbedder()
        query_vectors = embedder.embed_texts(
            [query_text], task_type="RETRIEVAL_QUERY", fallback_to_mock=True
        )
        if not query_vectors:
            return None

        results = store.search(
            query_vector=query_vectors[0],
            top_k=top_k * 3,  # over-fetch then filter by crop
            filter_metadata={"chunk_type": "crop_guide"},
        )

        # Filter to matching crop (exact key or name)
        matched = [
            r for r in results
            if _normalize_key(r.metadata.get("crop_key", "")) in variants
            or _normalize_key(r.metadata.get("crop_name", "")) in variants
        ]

        # Fall back to top semantic matches if no exact key match
        if not matched:
            matched = results[:top_k]

        if not matched:
            return None

        crop_name = matched[0].metadata.get("crop_name", crop_key.title())
        source_pdf = matched[0].metadata.get("source_pdf", "crop_guide_pdf")

        overview_texts = [
            r.text for r in matched if r.metadata.get("section") == "overview"
        ]
        disease_texts = [
            r.text for r in matched if r.metadata.get("section") == "disease"
        ]

        # Also include top unfiltered chunks if overview is missing
        if not overview_texts:
            overview_texts = [matched[0].text]

        return {
            "crop_key": key,
            "crop_name": crop_name,
            "overview": overview_texts[0] if overview_texts else "",
            "disease_advisories": disease_texts[:3],
            "source_pdf": source_pdf,
            "is_cibrc_validated": False,
            "data_source": "crop_guide_pdf",
            "is_sample": False,
            "advisory_note": (
                "Data sourced from ICAR Indian Crops Guide. "
                "Verify doses with your Krishi Vigyan Kendra (KVK) or agriculture officer."
            ),
        }

    except Exception as exc:
        logger.warning("CropGuideRAG lookup failed for '%s': %s", crop_key, exc)
        return None
