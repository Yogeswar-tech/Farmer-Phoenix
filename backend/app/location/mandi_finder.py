"""Finds nearest mandis to a farmer's coordinates using geospatial distance."""

import logging
from collections.abc import Sequence

from app.location.geocoder import Geocoder, haversine_distance_km
from app.location.models import GeoCoordinates, MandiLocation

logger = logging.getLogger(__name__)

# Master list of major mandis with known geographic coordinates
KNOWN_MANDIS: list[MandiLocation] = [
    MandiLocation(
        name="Koyambedu",
        district="Chennai",
        state="Tamil Nadu",
        latitude=13.0694,
        longitude=80.1948,
    ),
    MandiLocation(
        name="Oddanchatram",
        district="Dindigul",
        state="Tamil Nadu",
        latitude=10.4854,
        longitude=77.7471,
    ),
    MandiLocation(
        name="Madurai APMC",
        district="Madurai",
        state="Tamil Nadu",
        latitude=9.9252,
        longitude=78.1198,
    ),
    MandiLocation(
        name="Pune APMC",
        district="Pune",
        state="Maharashtra",
        latitude=18.4967,
        longitude=73.8647,
    ),
    MandiLocation(
        name="Lasalgaon",
        district="Nashik",
        state="Maharashtra",
        latitude=20.1472,
        longitude=74.2268,
    ),
    MandiLocation(
        name="Vashi APMC",
        district="Navi Mumbai",
        state="Maharashtra",
        latitude=19.0760,
        longitude=73.0076,
    ),
    MandiLocation(
        name="Kolar",
        district="Kolar",
        state="Karnataka",
        latitude=13.1367,
        longitude=78.1292,
    ),
    MandiLocation(
        name="Yeshwanthpur",
        district="Bengaluru",
        state="Karnataka",
        latitude=13.0238,
        longitude=77.5529,
    ),
    MandiLocation(
        name="Azadpur",
        district="Delhi",
        state="Delhi",
        latitude=28.7041,
        longitude=77.1725,
    ),
    MandiLocation(
        name="Guntur Mirchi Yard",
        district="Guntur",
        state="Andhra Pradesh",
        latitude=16.3067,
        longitude=80.4365,
    ),
    MandiLocation(
        name="Kurnool APMC",
        district="Kurnool",
        state="Andhra Pradesh",
        latitude=15.8281,
        longitude=78.0373,
    ),
    MandiLocation(
        name="Madanapalle Tomato Yard",
        district="Chittoor",
        state="Andhra Pradesh",
        latitude=13.5500,
        longitude=78.5000,
    ),
    MandiLocation(
        name="Tirupati Agri Market",
        district="Tirupati",
        state="Andhra Pradesh",
        latitude=13.6288,
        longitude=79.4192,
    ),
    MandiLocation(
        name="Vijayawada Gollapudi",
        district="NTR Krishna",
        state="Andhra Pradesh",
        latitude=16.5410,
        longitude=80.5960,
    ),
    MandiLocation(
        name="Warangal Agri Market",
        district="Warangal",
        state="Telangana",
        latitude=17.9689,
        longitude=79.5941,
    ),
    MandiLocation(
        name="Khammam APMC",
        district="Khammam",
        state="Telangana",
        latitude=17.2473,
        longitude=80.1514,
    ),
    MandiLocation(
        name="Anantapur Market",
        district="Anantapur",
        state="Andhra Pradesh",
        latitude=14.6819,
        longitude=77.6006,
    ),
    MandiLocation(
        name="Adoni Cotton Yard",
        district="Kurnool",
        state="Andhra Pradesh",
        latitude=15.6322,
        longitude=77.2728,
    ),
]


class MandiFinder:
    """Finds nearest mandis based on user location coordinates."""

    def __init__(
        self,
        geocoder: Geocoder | None = None,
        mandis: Sequence[MandiLocation] | None = None,
    ) -> None:
        self.geocoder = geocoder or Geocoder()
        self.mandis = list(mandis or KNOWN_MANDIS)

    async def find_nearest(
        self,
        location: str | GeoCoordinates,
        top_n: int = 3,
        state: str | None = None,
    ) -> list[MandiLocation]:
        """Compute nearest mandis to a string address or GeoCoordinates."""
        if isinstance(location, str):
            coords = await self.geocoder.geocode(location)
        else:
            coords = location

        candidates = self.mandis
        if not state and isinstance(location, str):
            loc_lower = location.strip().lower()
            for m in self.mandis:
                if m.state.lower() == loc_lower or m.state.lower() in loc_lower:
                    state = m.state
                    break

        if state:
            state_lower = state.strip().lower()
            filtered = [m for m in candidates if m.state.lower() == state_lower]
            if filtered:
                candidates = filtered

        calculated: list[MandiLocation] = []
        for mandi in candidates:
            mandi_coord = GeoCoordinates(latitude=mandi.latitude, longitude=mandi.longitude)
            dist = haversine_distance_km(coords, mandi_coord)
            calculated.append(
                MandiLocation(
                    name=mandi.name,
                    district=mandi.district,
                    state=mandi.state,
                    latitude=mandi.latitude,
                    longitude=mandi.longitude,
                    distance_km=round(dist, 1),
                )
            )

        # Sort ascending by distance in km
        calculated.sort(key=lambda m: m.distance_km if m.distance_km is not None else 999999.0)
        return calculated[:top_n]
