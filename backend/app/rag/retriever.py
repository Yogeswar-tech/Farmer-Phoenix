"""Location and commodity aware RAG retrieval engine."""

import logging
from typing import Any

from app.ingestion.embedder import VertexAIEmbedder
from app.rag.models import SearchResult
from app.rag.vector_store import BaseVectorStore, get_vector_store

logger = logging.getLogger(__name__)

COMMON_COMMODITIES = [
    "Tomato",
    "Onion",
    "Potato",
    "Brinjal",
    "Chilli",
    "Cabbage",
    "Cauliflower",
    "Garlic",
    "Ginger",
    "Carrot",
    "Bhindi",
    "Matar",
    "Capsicum",
    "Cucumber",
    "Bottle Gourd",
    "Bitter Gourd",
    "Palak",
    "Lemon",
    "Coriander",
    "Beetroot",
    "Okra",
    "Peas",
    "Spinach",
]


COMMON_STATES = [
    "Maharashtra",
    "Tamil Nadu",
    "Karnataka",
    "Andhra Pradesh",
    "Telangana",
    "Uttar Pradesh",
    "Madhya Pradesh",
    "Gujarat",
    "Punjab",
    "Haryana",
    "Rajasthan",
    "West Bengal",
    "Bihar",
    "Odisha",
    "Kerala",
]


class PriceRetriever:
    """Retrieves mandi price chunks and advisories using vector search and metadata filters."""

    def __init__(
        self,
        vector_store: BaseVectorStore | None = None,
        embedder: VertexAIEmbedder | None = None,
    ) -> None:
        self.vector_store = vector_store or get_vector_store()
        self.embedder = embedder or VertexAIEmbedder()

    def retrieve(
        self,
        query: str,
        top_k: int = 5,
        commodity: str | None = None,
        state: str | None = None,
        district: str | None = None,
        markets: list[str] | None = None,
        auto_detect_filters: bool = True,
    ) -> list[SearchResult]:
        """Retrieve most relevant grounded chunks for a farmer's question.

        Args:
            query: Farmer natural language question (e.g. "What is tomato price near Chennai?")
            top_k: Maximum number of chunks to return
            commodity: Optional explicit commodity filter (e.g. "Tomato")
            state: Optional state filter (e.g. "Tamil Nadu")
            district: Optional district filter (e.g. "Chennai")
            markets: Optional list of nearest mandi names to prioritize/filter
            auto_detect_filters: If True, infer commodity & state from query when not provided
        """
        if not query.strip():
            return []

        # 1. Build metadata filter dictionary
        filter_metadata: dict[str, Any] = {}

        target_commodity = commodity
        target_state = state

        if auto_detect_filters:
            detected_commodities = self._extract_commodities(query)
            if not target_commodity and len(detected_commodities) == 1:
                target_commodity = detected_commodities[0]

            if not target_state:
                target_state = self._extract_state(query)

        if target_commodity:
            filter_metadata["commodity"] = target_commodity
        if target_state:
            filter_metadata["state"] = target_state
        if district:
            filter_metadata["district"] = district
        if markets:
            filter_metadata["market_names"] = markets

        # 2. Embed the farmer's query using task_type='RETRIEVAL_QUERY'
        logger.info("Embedding query with RETRIEVAL_QUERY hint: '%s'", query)
        query_vectors = self.embedder.embed_texts(
            [query],
            task_type="RETRIEVAL_QUERY",
            fallback_to_mock=True,
        )
        if not query_vectors:
            return []

        query_vector = query_vectors[0]

        # 3. Vector search with metadata filters
        results = self.vector_store.search(
            query_vector=query_vector,
            top_k=top_k,
            filter_metadata=filter_metadata if filter_metadata else None,
        )

        # Fallback: if strict filter yielded 0 results, retry without commodity or state filter
        if not results and filter_metadata:
            logger.info("Strict filter yielded 0 results; retrying search without filters.")
            results = self.vector_store.search(
                query_vector=query_vector,
                top_k=top_k,
                filter_metadata=None,
            )

        logger.info("Retrieved %d chunks for query '%s'", len(results), query)
        return results

    @staticmethod
    def _extract_commodities(query: str) -> list[str]:
        """Infer mentioned commodities from query."""
        query_lower = query.lower()
        found: list[str] = []
        for comm in COMMON_COMMODITIES:
            cl = comm.lower()
            if cl in query_lower or f"{cl}es" in query_lower or f"{cl}s" in query_lower:
                found.append(comm)
        return found

    @staticmethod
    def _extract_state(query: str) -> str | None:
        """Infer mentioned Indian state from query."""
        query_lower = query.lower()
        for s in COMMON_STATES:
            if s.lower() in query_lower:
                return s
        return None

    @staticmethod
    def format_context_for_prompt(results: list[SearchResult]) -> str:
        """Format retrieved chunks into numbered context text for LLM prompt injection."""
        if not results:
            return "NO PRICE DATA AVAILABLE FOR THIS QUERY."

        lines: list[str] = []
        for i, res in enumerate(results, start=1):
            source = res.metadata.get("source", "AGMARKNET")
            date = res.metadata.get("arrival_date", "Today")
            lines.append(f"[{i}] (Source: {source}, Date: {date}, Similarity: {res.score:.2f})")
            lines.append(f"    {res.text}")

        return "\n".join(lines)
