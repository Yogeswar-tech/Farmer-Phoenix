"""Geocoding and distance calculation module."""

import logging
import math

import httpx

from app.location.models import GeoCoordinates
from app.settings import settings

logger = logging.getLogger(__name__)

# Known geographic coordinates for major Indian markets and agricultural hubs
KNOWN_LOCATIONS: dict[str, GeoCoordinates] = {
    "chennai": GeoCoordinates(latitude=13.0827, longitude=80.2707),
    "koyambedu": GeoCoordinates(latitude=13.0694, longitude=80.1948),
    "dindigul": GeoCoordinates(latitude=10.3673, longitude=77.9803),
    "oddanchatram": GeoCoordinates(latitude=10.4854, longitude=77.7471),
    "madurai": GeoCoordinates(latitude=9.9252, longitude=78.1198),
    "coimbatore": GeoCoordinates(latitude=11.0168, longitude=76.9558),
    "pune": GeoCoordinates(latitude=18.5204, longitude=73.8567),
    "nashik": GeoCoordinates(latitude=19.9975, longitude=73.7898),
    "lasalgaon": GeoCoordinates(latitude=20.1472, longitude=74.2268),
    "mumbai": GeoCoordinates(latitude=19.0760, longitude=72.8777),
    "navi mumbai": GeoCoordinates(latitude=19.0330, longitude=73.0297),
    "kolar": GeoCoordinates(latitude=13.1367, longitude=78.1292),
    "bengaluru": GeoCoordinates(latitude=12.9716, longitude=77.5946),
    "bangalore": GeoCoordinates(latitude=12.9716, longitude=77.5946),
    "mysuru": GeoCoordinates(latitude=12.2958, longitude=76.6394),
    "delhi": GeoCoordinates(latitude=28.6139, longitude=77.2090),
    "azadpur": GeoCoordinates(latitude=28.7041, longitude=77.1725),
    "maharashtra": GeoCoordinates(latitude=19.7515, longitude=75.7139),
    "tamil nadu": GeoCoordinates(latitude=11.1271, longitude=78.6569),
    "karnataka": GeoCoordinates(latitude=15.3173, longitude=75.7139),
    "andhra pradesh": GeoCoordinates(latitude=15.9129, longitude=79.7400),
    "telangana": GeoCoordinates(latitude=18.1124, longitude=79.0193),
}


def haversine_distance_km(coord1: GeoCoordinates, coord2: GeoCoordinates) -> float:
    """Calculate great-circle distance between two points in kilometers."""
    earth_radius_km = 6371.0

    lat1_rad = math.radians(coord1.latitude)
    lat2_rad = math.radians(coord2.latitude)
    delta_lat = math.radians(coord2.latitude - coord1.latitude)
    delta_lon = math.radians(coord2.longitude - coord1.longitude)

    a = (
        math.sin(delta_lat / 2.0) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return earth_radius_km * c


class Geocoder:
    """Geocodes text locations to coordinates via Google Maps API with offline fallback."""

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or settings.google_maps_api_key

    async def geocode(self, address: str) -> GeoCoordinates:
        """Convert a user location address into GeoCoordinates."""
        cleaned = address.strip().lower()

        # 1. Fast match against known locations (match longest/most specific name first)
        for name in sorted(KNOWN_LOCATIONS.keys(), key=len, reverse=True):
            if name in cleaned:
                coords = KNOWN_LOCATIONS[name]
                logger.info(
                    "Found known coordinate for '%s': (%f, %f)",
                    name,
                    coords.latitude,
                    coords.longitude,
                )
                return coords

        # 2. Try Google Maps Geocoding API if key configured
        if (
            self.api_key
            and not self.api_key.startswith("your_")
            and "placeholder" not in self.api_key.lower()
        ):
            try:
                url = "https://maps.googleapis.com/maps/api/geocode/json"
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(url, params={"address": address, "key": self.api_key})
                    resp.raise_for_status()
                    data = resp.json()

                results = data.get("results", [])
                if results:
                    loc = results[0]["geometry"]["location"]
                    return GeoCoordinates(latitude=loc["lat"], longitude=loc["lng"])
            except Exception as exc:
                logger.warning(
                    "Google Maps Geocoding API failed: %s; using default coordinates.", exc
                )

        # 3. Default fallback (Central Chennai / South India coordinate anchor)
        logger.info("No geocoding match found for '%s'; using default anchor.", address)
        return KNOWN_LOCATIONS["chennai"]
