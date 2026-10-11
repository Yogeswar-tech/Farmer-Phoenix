"""Data models for agricultural mandi price ingestion and RAG chunks."""

from typing import Any

from pydantic import BaseModel, Field


class MandiPriceRecord(BaseModel):
    """Normalized structured mandi price record."""

    commodity: str = Field(..., description="Crop or vegetable commodity name")
    variety: str = Field(default="Other", description="Commodity variety")
    market: str = Field(..., description="Mandi or market name")
    district: str = Field(..., description="District name")
    state: str = Field(..., description="State name")
    min_price: float = Field(..., ge=0, description="Minimum price in ₹/quintal")
    max_price: float = Field(..., ge=0, description="Maximum price in ₹/quintal")
    modal_price: float = Field(..., ge=0, description="Modal (most frequent) price in ₹/quintal")
    arrival_date: str = Field(..., description="Arrival or reported date (YYYY-MM-DD)")
    source: str = Field(default="AGMARKNET (data.gov.in)", description="Data provider or source")

    @property
    def price_per_kg(self) -> float:
        """Price converted from ₹/quintal to ₹/kg (1 quintal = 100 kg)."""
        return round(self.modal_price / 100.0, 2)

    @property
    def min_price_per_kg(self) -> float:
        """Minimum price in ₹/kg."""
        return round(self.min_price / 100.0, 2)

    @property
    def max_price_per_kg(self) -> float:
        """Maximum price in ₹/kg."""
        return round(self.max_price / 100.0, 2)


class PriceChunk(BaseModel):
    """Text chunk optimized for vector embedding and RAG retrieval."""

    chunk_id: str = Field(..., description="Unique deterministic identifier for the chunk")
    text: str = Field(..., description="Natural language chunk text fed into embedding model")
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Structured metadata for vector database filtering and grounding validation",
    )
    embedding: list[float] | None = Field(
        default=None,
        description="Dense vector embedding generated for the chunk",
    )
