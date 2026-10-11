"""Unit tests for price data ingestion, chunking, and embedding."""

import pytest

from app.ingestion.chunker import PriceChunker
from app.ingestion.embedder import VertexAIEmbedder
from app.ingestion.fetcher import AgmarknetFetcher, normalize_record
from app.ingestion.models import MandiPriceRecord


def test_normalize_record_standard_casing() -> None:
    raw = {
        "State": "Tamil Nadu",
        "District": "Chennai",
        "Market": "Koyambedu",
        "Commodity": "Tomato",
        "Variety": "Hybrid",
        "Arrival_Date": "11/10/2026",
        "Min_Price": "2000",
        "Max_Price": "2800",
        "Modal_Price": "2500",
    }
    record = normalize_record(raw)
    assert record.state == "Tamil Nadu"
    assert record.district == "Chennai"
    assert record.market == "Koyambedu"
    assert record.commodity == "Tomato"
    assert record.variety == "Hybrid"
    assert record.arrival_date == "2026-10-11"
    assert record.min_price == 2000.0
    assert record.max_price == 2800.0
    assert record.modal_price == 2500.0


def test_normalize_record_fallback_modal_calculation() -> None:
    raw = {
        "state": "Maharashtra",
        "district": "Pune",
        "market": "Pune APMC",
        "commodity": "Onion",
        "min_price": "2000",
        "max_price": "3000",
        "modal_price": "0",
        "arrival_date": "2026-10-11",
    }
    record = normalize_record(raw)
    # When modal is 0, it averages min and max
    assert record.modal_price == 2500.0


@pytest.mark.asyncio
async def test_fetcher_sample_fallback() -> None:
    fetcher = AgmarknetFetcher(api_key="")
    records = await fetcher.fetch_prices(commodity="Tomato", fallback_to_sample=True)
    assert len(records) > 0
    for r in records:
        assert r.commodity == "Tomato"
        assert r.modal_price > 0


def test_chunker_individual_and_comparative() -> None:
    records = [
        MandiPriceRecord(
            commodity="Tomato",
            variety="Hybrid",
            market="Koyambedu",
            district="Chennai",
            state="Tamil Nadu",
            min_price=2200.0,
            max_price=2800.0,
            modal_price=2500.0,
            arrival_date="2026-10-11",
            source="test",
        ),
        MandiPriceRecord(
            commodity="Tomato",
            variety="Local",
            market="Oddanchatram",
            district="Dindigul",
            state="Tamil Nadu",
            min_price=1900.0,
            max_price=2400.0,
            modal_price=2150.0,
            arrival_date="2026-10-11",
            source="test",
        ),
    ]

    chunker = PriceChunker(include_comparative_chunks=True)
    chunks = chunker.chunk_records(records)

    # 2 individual chunks + 1 comparative chunk
    assert len(chunks) == 3

    individual = [c for c in chunks if c.metadata.get("chunk_type") == "mandi_price"]
    assert len(individual) == 2
    assert "Koyambedu" in individual[0].text
    assert individual[0].metadata["modal_price"] == 2500.0

    comparative = [c for c in chunks if c.metadata.get("chunk_type") == "comparative_summary"]
    assert len(comparative) == 1
    assert "Highest price was in Koyambedu" in comparative[0].text
    assert comparative[0].metadata["highest_market"] == "Koyambedu"
    assert comparative[0].metadata["price_spread"] == 350.0


def test_embedder_mock_generation() -> None:
    embedder = VertexAIEmbedder()
    texts = [
        "Tomato in Koyambedu mandi on 2026-10-11: Modal price ₹2500/quintal",
        "Onion in Pune APMC on 2026-10-11: Modal price ₹3100/quintal",
    ]
    vectors = embedder.embed_texts(texts, fallback_to_mock=True)

    assert len(vectors) == 2
    assert len(vectors[0]) == 768
    assert len(vectors[1]) == 768

    # Vectors should be normalized (L2 norm ~ 1.0)
    norm0 = sum(v * v for v in vectors[0]) ** 0.5
    assert pytest.approx(norm0, 0.001) == 1.0
