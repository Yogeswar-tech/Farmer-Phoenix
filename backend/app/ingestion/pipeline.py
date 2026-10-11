"""End-to-end data ingestion pipeline orchestrator."""

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
from app.ingestion.models import PriceChunk
from app.ingestion.sheets_writer import GoogleSheetsWriter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("mandi_pipeline")


async def run_pipeline(
    state: str | None = None,
    commodity: str | None = None,
    limit: int = 50,
    save_sheets: bool = True,
    generate_embeddings: bool = True,
    output_json_path: Path | None = None,
) -> list[PriceChunk]:
    """Execute Step 1 Ingestion Pipeline:

    1. Fetch daily mandi prices (data.gov.in AGMARKNET API or fallback)
    2. Store in Google Sheets (or local CSV backup audit trail)
    3. Chunk into RAG-ready text units
    4. Generate Vertex AI text embeddings
    """
    logger.info("=== STEP 1: Fetching Mandi Prices ===")
    fetcher = AgmarknetFetcher()
    records = await fetcher.fetch_prices(state=state, commodity=commodity, limit=limit)
    logger.info("Fetched %d mandi price records.", len(records))

    if not records:
        logger.warning("No records found to ingest.")
        return []

    if save_sheets:
        logger.info("=== STEP 2: Appending to Google Sheets Audit Trail ===")
        writer = GoogleSheetsWriter()
        saved_count = writer.append_prices(records, local_csv_fallback=True)
        logger.info("Stored %d rows in audit sheet/backup.", saved_count)

    logger.info("=== STEP 3: Chunking Price Data for RAG ===")
    chunker = PriceChunker(include_comparative_chunks=True)
    chunks = chunker.chunk_records(records)
    logger.info("Generated %d RAG chunks (including comparative summaries).", len(chunks))

    if generate_embeddings:
        logger.info("=== STEP 4: Generating Vertex AI Embeddings ===")
        embedder = VertexAIEmbedder()
        chunks = embedder.embed_chunks(chunks, fallback_to_mock=True)
        embedded_count = sum(1 for c in chunks if c.embedding is not None)
        logger.info("Embedded %d / %d chunks with Vertex AI vectors.", embedded_count, len(chunks))

    # Save chunks to disk for local RAG inspection / downstream indexing
    if output_json_path:
        output_json_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_json_path, "w", encoding="utf-8") as f:
            json.dump([c.model_dump() for c in chunks], f, indent=2)
        logger.info("Saved %d chunks to %s", len(chunks), output_json_path)

    return chunks


def main() -> None:
    """CLI entrypoint for running ingestion pipeline."""
    parser = argparse.ArgumentParser(
        description="Mandi Mitra / Kisan Sethu Price Ingestion Pipeline"
    )
    parser.add_argument(
        "--state", type=str, default=None, help="Filter by State (e.g. 'Tamil Nadu')"
    )
    parser.add_argument(
        "--commodity", type=str, default=None, help="Filter by Commodity (e.g. 'Tomato')"
    )
    parser.add_argument("--limit", type=int, default=20, help="Max records to fetch")
    parser.add_argument("--no-sheets", action="store_true", help="Skip Google Sheets write")
    parser.add_argument(
        "--no-embeddings", action="store_true", help="Skip generating Vertex AI embeddings"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="data/rag_docs/mandi_price_chunks.json",
        help="Path to save output chunks JSON",
    )

    args = parser.parse_args()

    chunks = asyncio.run(
        run_pipeline(
            state=args.state,
            commodity=args.commodity,
            limit=args.limit,
            save_sheets=not args.no_sheets,
            generate_embeddings=not args.no_embeddings,
            output_json_path=Path(args.output) if args.output else None,
        )
    )

    print("\n--- SAMPLE CHUNKS GENERATED ---")
    for i, c in enumerate(chunks[:3], 1):
        print(f"\nChunk {i} [ID: {c.chunk_id}]:")
        print(f"Text: {c.text}")
        print(f"Metadata: {json.dumps(c.metadata, indent=2)}")
        if c.embedding:
            dim = len(c.embedding)
            print(f"Embedding: [{c.embedding[0]:.4f}, {c.embedding[1]:.4f}, ... (dim: {dim})]")


if __name__ == "__main__":
    main()
