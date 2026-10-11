"""Data models for RAG retrieval results and query parameters."""

from typing import Any

from pydantic import BaseModel, Field


class SearchResult(BaseModel):
    """A retrieved chunk matching a query along with similarity score and metadata."""

    chunk_id: str = Field(..., description="Unique chunk identifier")
    text: str = Field(..., description="Document text content")
    score: float = Field(..., ge=0.0, le=1.0, description="Cosine similarity score (0.0 to 1.0)")
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Structured metadata attributes (mandi, commodity, prices, date)",
    )
