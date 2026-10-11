"""Unit tests for geocoding and nearest mandi calculations."""

import pytest

from app.location.geocoder import Geocoder, haversine_distance_km
from app.location.mandi_finder import MandiFinder
from app.location.models import GeoCoordinates


def test_haversine_distance() -> None:
    # Chennai to Koyambedu (~11 km)
    chennai = GeoCoordinates(latitude=13.0827, longitude=80.2707)
    koyambedu = GeoCoordinates(latitude=13.0694, longitude=80.1948)
    dist = haversine_distance_km(chennai, koyambedu)
    assert 5.0 <= dist <= 15.0


@pytest.mark.asyncio
async def test_geocoder_known_location() -> None:
    geocoder = Geocoder()
    coords = await geocoder.geocode("Koyambedu market, Chennai")
    assert pytest.approx(coords.latitude, 0.05) == 13.0694
    assert pytest.approx(coords.longitude, 0.05) == 80.1948


@pytest.mark.asyncio
async def test_mandi_finder_nearest() -> None:
    finder = MandiFinder()
    nearest = await finder.find_nearest("Koyambedu, Chennai", top_n=2)
    assert len(nearest) == 2
    # Nearest to Koyambedu should be Koyambedu itself with distance < 2 km
    assert nearest[0].name == "Koyambedu"
    assert nearest[0].distance_km is not None
    assert nearest[0].distance_km < 2.0


@pytest.mark.asyncio
async def test_mandi_finder_state_filtering() -> None:
    finder = MandiFinder()
    # From Mumbai looking for Maharashtra mandis
    nearest = await finder.find_nearest("Mumbai", top_n=2, state="Maharashtra")
    assert len(nearest) == 2
    for m in nearest:
        assert m.state == "Maharashtra"
