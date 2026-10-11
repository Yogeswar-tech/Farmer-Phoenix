"""Location models for geocoding and nearest mandi calculations."""

from pydantic import BaseModel, Field


class GeoCoordinates(BaseModel):
    """Geographic coordinates (latitude, longitude)."""

    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees")


class MandiLocation(BaseModel):
    """Mandi location with coordinates and calculated distance."""

    name: str = Field(..., description="Mandi or market name")
    district: str = Field(..., description="District name")
    state: str = Field(..., description="State name")
    latitude: float = Field(..., description="Latitude")
    longitude: float = Field(..., description="Longitude")
    distance_km: float | None = Field(default=None, description="Distance in km from user location")
