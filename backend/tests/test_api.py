"""Unit tests for FastAPI endpoints."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint() -> None:
    response = client.get("/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_get_prices_endpoint() -> None:
    response = client.get("/v1/prices?commodity=Tomato&state=Tamil+Nadu")
    assert response.status_code == 200
    data = response.json()
    assert "prices" in data
    assert "avg_modal_price" in data
    assert "trend" in data


def test_ask_endpoint() -> None:
    payload = {
        "query": "What is tomato price near Chennai?",
        "location": "Chennai, Tamil Nadu",
        "commodity": "Tomato",
    }
    response = client.post("/v1/ask", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "recommendation" in data
    assert "sources" in data
    assert "nearby_markets" in data
    assert "as_of" in data
    assert data["grounding_valid"] is True
    # Check FarmerEnvelope compatibility fields
    assert "card" in data
    assert "numbers" in data
    assert "provenance" in data


def test_crops_endpoint() -> None:
    response = client.get("/v1/crops?lang=en")
    assert response.status_code == 200
    crops = response.json()
    assert len(crops) > 0
    assert any(c["id"] == "tomato" for c in crops)


def test_resolve_region_endpoint() -> None:
    response = client.get("/v1/regions/resolve?lat=13.0827&lon=80.2707")
    assert response.status_code == 200
    data = response.json()
    assert "region_id" in data
    assert "mandis" in data
    assert len(data["mandis"]) > 0


def test_insight_endpoint() -> None:
    response = client.get("/v1/insight?crop=tomato&region=Chennai&lang=en")
    assert response.status_code == 200
    data = response.json()
    assert "card" in data
    assert "numbers" in data
    assert "provenance" in data
    assert "freshness" in data

