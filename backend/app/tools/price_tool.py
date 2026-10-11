"""Price retrieval tool for agents and API endpoints."""

from typing import Any

from app.rag.retriever import PriceRetriever


def get_mandi_prices_tool(
    query: str,
    commodity: str | None = None,
    state: str | None = None,
    district: str | None = None,
    markets: list[str] | None = None,
    top_k: int = 4,
) -> dict[str, Any]:
    """Retrieve grounded mandi price chunks and structured facts for a question.

    Args:
        query: Farmer natural language question
        commodity: Optional commodity filter
        state: Optional state filter
        district: Optional district filter
        markets: Optional list of nearby mandi names
        top_k: Number of chunks to retrieve

    Returns:
        Dictionary with retrieved items, formatted context for LLM, and status.
    """
    retriever = PriceRetriever()
    results = retriever.retrieve(
        query=query,
        top_k=top_k,
        commodity=commodity,
        state=state,
        district=district,
        markets=markets,
    )

    formatted_context = retriever.format_context_for_prompt(results)

    items = [
        {
            "chunk_id": r.chunk_id,
            "text": r.text,
            "score": r.score,
            "metadata": r.metadata,
        }
        for r in results
    ]

    return {
        "query": query,
        "results_count": len(results),
        "context_text": formatted_context,
        "items": items,
    }
