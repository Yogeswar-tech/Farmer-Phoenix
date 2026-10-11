"""Unit tests for RAG vector store and price retriever."""

from pathlib import Path

import pytest

from app.ingestion.embedder import VertexAIEmbedder
from app.ingestion.models import PriceChunk
from app.rag.retriever import PriceRetriever
from app.rag.vector_store import LocalVectorStore, cosine_similarity
from app.tools.price_tool import get_mandi_prices_tool


@pytest.fixture
def sample_chunks() -> list[PriceChunk]:
    embedder = VertexAIEmbedder()
    chunks = [
        PriceChunk(
            chunk_id="c1",
            text="Tomato in Koyambedu mandi, Chennai, Tamil Nadu: Modal price ₹2500/quintal",
            metadata={
                "commodity": "Tomato",
                "state": "Tamil Nadu",
                "district": "Chennai",
                "market_name": "Koyambedu",
                "modal_price": 2500.0,
            },
        ),
        PriceChunk(
            chunk_id="c2",
            text="Tomato in Oddanchatram mandi, Dindigul, Tamil Nadu: Modal price ₹2150/quintal",
            metadata={
                "commodity": "Tomato",
                "state": "Tamil Nadu",
                "district": "Dindigul",
                "market_name": "Oddanchatram",
                "modal_price": 2150.0,
            },
        ),
        PriceChunk(
            chunk_id="c3",
            text="Onion in Pune APMC, Pune, Maharashtra: Modal price ₹3100/quintal",
            metadata={
                "commodity": "Onion",
                "state": "Maharashtra",
                "district": "Pune",
                "market_name": "Pune APMC",
                "modal_price": 3100.0,
            },
        ),
    ]
    # Embed with mock vectors
    return embedder.embed_chunks(chunks, fallback_to_mock=True)


def test_cosine_similarity() -> None:
    v1 = [1.0, 0.0, 0.0]
    v2 = [1.0, 0.0, 0.0]
    assert pytest.approx(cosine_similarity(v1, v2), 0.001) == 1.0

    v3 = [0.0, 1.0, 0.0]
    assert pytest.approx(cosine_similarity(v1, v3), 0.001) == 0.0


def test_local_vector_store_filtering(tmp_path: Path, sample_chunks: list[PriceChunk]) -> None:
    store_file = tmp_path / "test_store.json"
    store = LocalVectorStore(persistence_path=store_file)

    added = store.add_chunks(sample_chunks)
    assert added == 3
    assert store.count() == 3

    # Query with Koyambedu vector
    query_vec = sample_chunks[0].embedding
    assert query_vec is not None

    # Search with commodity filter = Onion
    results = store.search(query_vec, top_k=5, filter_metadata={"commodity": "Onion"})
    assert len(results) == 1
    assert results[0].chunk_id == "c3"
    assert results[0].metadata["commodity"] == "Onion"

    # Search with market_names filter = ["Koyambedu"]
    m_results = store.search(query_vec, top_k=5, filter_metadata={"market_names": ["Koyambedu"]})
    assert len(m_results) == 1
    assert m_results[0].chunk_id == "c1"


def test_price_retriever(tmp_path: Path, sample_chunks: list[PriceChunk]) -> None:
    store_file = tmp_path / "test_retriever_store.json"
    store = LocalVectorStore(persistence_path=store_file)
    store.add_chunks(sample_chunks)

    retriever = PriceRetriever(vector_store=store)

    # Auto-extracts "Tomato" and retrieves
    results = retriever.retrieve("What is tomato price near Chennai?", top_k=2)
    assert len(results) >= 1
    assert results[0].metadata["commodity"] == "Tomato"

    # Context formatting
    context = retriever.format_context_for_prompt(results)
    assert "Tomato" in context
    assert "Modal price" in context


def test_mandi_prices_tool(tmp_path: Path, sample_chunks: list[PriceChunk]) -> None:
    store_file = tmp_path / "test_tool_store.json"
    store = LocalVectorStore(persistence_path=store_file)
    store.add_chunks(sample_chunks)

    # Use tool with retriever bound to our store
    retriever = PriceRetriever(vector_store=store)
    results = retriever.retrieve("Onion in Pune", commodity="Onion", top_k=1)
    assert len(results) == 1
    assert results[0].metadata["commodity"] == "Onion"

    tool_res = get_mandi_prices_tool("Any query", top_k=1)
    assert "query" in tool_res
    assert "results_count" in tool_res
