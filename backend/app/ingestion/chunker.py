"""Price data chunking module for RAG retrieval and vector indexing."""

import hashlib
import re
from collections import defaultdict
from typing import Any

from app.ingestion.models import MandiPriceRecord, PriceChunk


class PriceChunker:
    """Transforms structured price records into natural language chunks and metadata for RAG."""

    def __init__(self, include_comparative_chunks: bool = True) -> None:
        self.include_comparative_chunks = include_comparative_chunks

    def chunk_record(self, record: MandiPriceRecord) -> PriceChunk:
        """Create a single RAG chunk for an individual commodity arrival at a mandi."""
        clean_state = re.sub(r"[^a-zA-Z0-9]+", "_", record.state).strip("_").lower()
        clean_district = re.sub(r"[^a-zA-Z0-9]+", "_", record.district).strip("_").lower()
        clean_market = re.sub(r"[^a-zA-Z0-9]+", "_", record.market).strip("_").lower()
        clean_commodity = re.sub(r"[^a-zA-Z0-9]+", "_", record.commodity).strip("_").lower()
        clean_date = re.sub(r"[^a-zA-Z0-9]+", "_", record.arrival_date).strip("_").lower()

        datapoint_id = (
            f"{clean_state}_{clean_district}_{clean_market}_{clean_commodity}_{clean_date}"
        )
        chunk_id = datapoint_id

        text = (
            f"As of {record.arrival_date}, in {record.market} Mandi "
            f"({record.district}, {record.state}), {record.commodity} ({record.variety}) "
            f"has a modal price of ₹{record.price_per_kg:.2f}/kg "
            f"(₹{record.modal_price:.0f}/quintal), with min price of "
            f"₹{record.min_price_per_kg:.2f}/kg and max price of "
            f"₹{record.max_price_per_kg:.2f}/kg. Reported source: {record.source}."
        )

        metadata: dict[str, Any] = {
            "chunk_type": "mandi_price",
            "datapoint_id": datapoint_id,
            "commodity": record.commodity,
            "variety": record.variety,
            "market_name": record.market,
            "district": record.district,
            "state": record.state,
            "arrival_date": record.arrival_date,
            "min_price": record.min_price,
            "max_price": record.max_price,
            "modal_price": record.modal_price,
            "price_per_kg": record.price_per_kg,
            "min_price_per_kg": record.min_price_per_kg,
            "max_price_per_kg": record.max_price_per_kg,
            "source": record.source,
            "restricts": [
                {"namespace": "commodity", "allow": [record.commodity.lower()]},
                {"namespace": "state", "allow": [record.state.lower()]},
            ],
            "numeric_restricts": [{"namespace": "price_kg", "value_float": record.price_per_kg}],
        }

        return PriceChunk(chunk_id=chunk_id, text=text, metadata=metadata)

    def chunk_records(self, records: list[MandiPriceRecord]) -> list[PriceChunk]:
        """Convert records into individual chunks plus multi-market comparative chunks."""
        chunks: list[PriceChunk] = []

        # 1. Base individual chunks
        for record in records:
            chunks.append(self.chunk_record(record))

        # 2. Multi-market comparative chunks per (state, commodity, arrival_date)
        if self.include_comparative_chunks and len(records) > 1:
            grouped: dict[tuple[str, str, str], list[MandiPriceRecord]] = defaultdict(list)
            for r in records:
                grouped[(r.state, r.commodity, r.arrival_date)].append(r)

            for (state, commodity, date), group in grouped.items():
                if len(group) >= 2:
                    sorted_by_modal = sorted(group, key=lambda x: x.modal_price, reverse=True)
                    highest = sorted_by_modal[0]
                    lowest = sorted_by_modal[-1]

                    market_summaries = ", ".join(
                        f"{r.market} (₹{r.modal_price:.0f}/qtl)" for r in sorted_by_modal
                    )

                    spread = highest.modal_price - lowest.modal_price
                    comp_text = (
                        f"Comparative prices for {commodity} across mandis in {state} on {date}: "
                        f"{market_summaries}. "
                        f"Highest price was in {highest.market} (₹{highest.modal_price:.0f}/qtl), "
                        f"while lowest was in {lowest.market} (₹{lowest.modal_price:.0f}/qtl). "
                        f"Price spread across mandis is ₹{spread:.0f}/qtl."
                    )

                    raw_id = f"comp:{state}:{commodity}:{date}"
                    chunk_id = hashlib.sha256(raw_id.encode("utf-8")).hexdigest()[:16]

                    comp_metadata: dict[str, Any] = {
                        "chunk_type": "comparative_summary",
                        "commodity": commodity,
                        "state": state,
                        "arrival_date": date,
                        "markets_compared": [r.market for r in sorted_by_modal],
                        "highest_market": highest.market,
                        "highest_price": highest.modal_price,
                        "lowest_market": lowest.market,
                        "lowest_price": lowest.modal_price,
                        "price_spread": highest.modal_price - lowest.modal_price,
                    }

                    chunks.append(
                        PriceChunk(chunk_id=chunk_id, text=comp_text, metadata=comp_metadata)
                    )

        return chunks
