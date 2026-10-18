"""Indexer module to populate vector store from chunks or live ingestion."""

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path

# Ensure UTF-8 output on Windows console
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.ingestion.models import PriceChunk
from app.ingestion.pipeline import run_pipeline
from app.rag.retriever import PriceRetriever
from app.rag.vector_store import BaseVectorStore, get_vector_store

logger = logging.getLogger(__name__)


def index_chunks(chunks: list[PriceChunk], store: BaseVectorStore | None = None) -> int:
    """Index chunks into the vector store."""
    target_store = store or get_vector_store()
    count = target_store.add_chunks(chunks)
    logger.info("Indexed %d chunks into vector store. Total: %d", count, target_store.count())
    return count


def index_from_file(
    file_path: Path | str = "data/rag_docs/mandi_price_chunks.json",
    store: BaseVectorStore | None = None,
) -> int:
    """Load chunks from disk JSON and index them."""
    path = Path(file_path)
    if not path.exists():
        logger.warning("Chunks file not found at %s", path)
        return 0

    with open(path, encoding="utf-8") as f:
        raw_items = json.load(f)

    chunks = [PriceChunk(**item) for item in raw_items]
    return index_chunks(chunks, store)


async def ensure_indexed(store: BaseVectorStore | None = None) -> int:
    """Ensure vector store has data, fetching sample/live data if empty."""
    target_store = store or get_vector_store()
    if target_store.count() > 0:
        logger.info("Vector store already contains %d items.", target_store.count())
        return target_store.count()

    chunks_file = Path("data/rag_docs/mandi_price_chunks.json")
    if chunks_file.exists():
        logger.info("Indexing from existing file: %s", chunks_file)
        index_from_file(chunks_file, target_store)

    crop_guide_file = Path("data/rag_docs/crop_guide_chunks.json")
    if crop_guide_file.exists():
        logger.info("Indexing crop guide chunks from: %s", crop_guide_file)
        index_from_file(crop_guide_file, target_store)

    if target_store.count() > 0:
        return target_store.count()

    logger.info("Vector store empty and no chunk file found; running ingestion pipeline...")
    chunks = await run_pipeline(
        limit=20,
        save_sheets=True,
        generate_embeddings=True,
        output_json_path=chunks_file,
    )
    return index_chunks(chunks, target_store)


def main() -> None:
    """CLI to index data and run test queries."""
    parser = argparse.ArgumentParser(description="Mandi RAG Indexer and Query Tester")
    parser.add_argument(
        "--query",
        type=str,
        default="What is tomato price near Chennai?",
        help="Test query",
    )
    parser.add_argument("--top-k", type=int, default=3, help="Top-K results to retrieve")
    parser.add_argument("--reindex", action="store_true", help="Clear store and re-index")
    args = parser.parse_args()

    store = get_vector_store()
    if args.reindex:
        logger.info("Clearing existing vector store...")
        store.clear()

    asyncio.run(ensure_indexed(store))

    print(f"\n--- TESTING RETRIEVAL FOR: '{args.query}' ---")
    retriever = PriceRetriever(vector_store=store)
    results = retriever.retrieve(query=args.query, top_k=args.top_k)

    if not results:
        print("No matching price records found.")
        return

    print(f"\nFound {len(results)} relevant chunks:\n")
    for i, res in enumerate(results, 1):
        print(f"[{i}] Score: {res.score:.4f} | Chunk ID: {res.chunk_id}")
        print(f"    Text: {res.text}")
        print(f"    Metadata: {json.dumps(res.metadata)}")
        print()

    print("--- FORMATTED PROMPT CONTEXT ---")
    print(retriever.format_context_for_prompt(results))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    main()
