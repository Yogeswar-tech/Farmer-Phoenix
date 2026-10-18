"""Test suite for Kisan Sethu Voice Bot Assistant."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_voice_bot_weather_telugu():
    """Test Telugu colloquial weather query."""
    response = client.post(
        "/v1/voice-bot/ask",
        json={
            "query": "eeroju weather cheppandi ?",
            "lang": "te",
            "location": "Guntur",
            "crop": "chilli"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "spoken_answer" in data
    assert "verdict" in data
    assert "detailed_answer" in data
    assert data["category"] == "weather"
    assert data["lang"] == "te"
    assert len(data["spoken_answer"]) > 5


def test_voice_bot_1hour_precautions_telugu():
    """Test Telugu 1-hour forecast and farming precautions query."""
    response = client.post(
        "/v1/voice-bot/ask",
        json={
            "query": "inkoka ganta lo weather ela vuntundhi , nenem precautions theesukovali ?",
            "lang": "te",
            "location": "Guntur",
            "crop": "chilli"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "spoken_answer" in data
    assert "action_plan" in data
    assert data["category"] == "weather"
    assert "జాగ్రత్త" in data["detailed_answer"] or "టార్పాలిన్" in data["detailed_answer"] or "పిచికారీ" in data["detailed_answer"]


def test_voice_bot_profit_arbitrage_telugu():
    """Test Telugu query for selling destination and profit comparison."""
    response = client.post(
        "/v1/voice-bot/ask",
        json={
            "query": "nenu evriki sell chesthe profit vasthundhi ?",
            "lang": "te",
            "location": "Guntur",
            "crop": "chilli"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["category"] == "profit"
    assert "లాభం" in data["spoken_answer"] or "లాభం" in data["verdict"]


def test_voice_bot_hindi():
    """Test Hindi weather and profit query."""
    response = client.post(
        "/v1/voice-bot/ask",
        json={
            "query": "आज का मौसम कैसा रहेगा और किसको बेचने से ज्यादा मुनाफा होगा?",
            "lang": "hi",
            "location": "Guntur",
            "crop": "chilli"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["lang"] == "hi"
    assert len(data["spoken_answer"]) > 5


def test_voice_bot_repeated_queries():
    """Verify that multiple consecutive calls with the same query succeed consistently."""
    for _ in range(3):
        res = client.post(
            "/v1/voice-bot/ask",
            json={
                "query": "eeroju weather ela vundhi cheppu ?",
                "lang": "te",
                "location": "Guntur"
            }
        )
        assert res.status_code == 200
        assert res.json()["spoken_answer"] != ""
