"""Tests for Async LLM Gateway, Timeouts, Retries, and Typed Error Handling with Mocked Client."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.llm.client import LLMGateway, LLMUnavailableError
from app.main import app

client = TestClient(app)


@pytest.mark.asyncio
async def test_llm_gateway_unconfigured_raises_typed_error():
    """Unconfigured gateway raises LLMUnavailableError without returning fake fallback text."""
    gateway = LLMGateway(api_key="", project_id="")
    assert not gateway.is_available()

    with pytest.raises(LLMUnavailableError) as exc_info:
        await gateway.generate_response("Tomato price in Guntur")

    err_str = str(exc_info.value).lower()
    assert "missing credentials" in err_str or "not configured" in err_str


@pytest.mark.asyncio
async def test_llm_gateway_async_success_with_mock():
    """Mocked client.aio.models.generate_content succeeds asynchronously."""
    gateway = LLMGateway(api_key="valid-test-key", project_id="")

    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.text = "Grounded advisory: Market rates are steady."
    mock_client.aio.models.generate_content = AsyncMock(return_value=mock_resp)

    gateway._client = mock_client

    result = await gateway.generate_response("What is the tomato price today?")
    assert result == "Grounded advisory: Market rates are steady."
    mock_client.aio.models.generate_content.assert_called_once()


@pytest.mark.asyncio
async def test_llm_gateway_retries_once_before_raising():
    """LLMGateway retries once with backoff on failure before raising LLMUnavailableError."""
    gateway = LLMGateway(api_key="valid-test-key", project_id="")

    mock_client = MagicMock()
    # Fails both attempt 1 and attempt 2
    mock_client.aio.models.generate_content = AsyncMock(
        side_effect=RuntimeError("Google GenAI Connection Timeout")
    )
    gateway._client = mock_client

    with pytest.raises(LLMUnavailableError) as exc_info:
        await gateway.generate_response("Question")

    assert "failed after retry" in str(exc_info.value)
    # Exactly 2 calls (1 initial + 1 retry)
    assert mock_client.aio.models.generate_content.call_count == 2


@pytest.mark.asyncio
async def test_llm_credential_detection():
    """Consistent credential detection: Vertex when project_id is set, else API Key."""
    # 1. Vertex AI mode
    vertex_gw = LLMGateway(project_id="kisan-sethu-prod", api_key="")
    with patch("google.genai.Client") as mock_genai_cls:
        vertex_gw._get_client()
        mock_genai_cls.assert_called_with(
            vertexai=True,
            project="kisan-sethu-prod",
            location="asia-south1",
        )

    # 2. Gemini API key mode
    key_gw = LLMGateway(project_id="", api_key="my-secret-gemini-key")
    with patch("google.genai.Client") as mock_genai_cls:
        key_gw._get_client()
        mock_genai_cls.assert_called_with(api_key="my-secret-gemini-key")


def test_ask_caller_handles_llm_unavailable_error():
    """POST /v1/ask returns status: unavailable and advisory: null when LLM is offline."""
    from app.llm import get_llm_gateway

    gateway = get_llm_gateway()
    # Force mock client to raise LLMUnavailableError
    err = LLMUnavailableError("Service Offline")
    with patch.object(gateway, "generate_response", side_effect=err):
        res = client.post("/v1/ask", json={
            "query": "What is the tomato price today in Madanapalle?",
            "location": "Madanapalle",
            "lang": "te"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "unavailable"
        assert data["advisory"] is None
        assert "క్షమించండి" in data["answer"] or "అందుబాటులో లేదు" in data["answer"]


def test_cibrc_ai_advisor_caller_handles_llm_unavailable_error():
    """POST /v1/db/pesticides/cibrc/ai-advisor returns status: unavailable and advisory: null."""
    from app.llm import get_llm_gateway

    gateway = get_llm_gateway()
    err = LLMUnavailableError("Quota Exhausted")
    with patch.object(gateway, "generate_response", side_effect=err):
        res = client.post("/v1/db/pesticides/cibrc/ai-advisor", json={
            "query": "How to control fruit borer?",
            "crop": "Tomato",
            "pesticide": "Chlorantraniliprole",
            "lang": "hi"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "unavailable"
        assert data["advisory"] is None
        assert "अनुपलब्ध" in data["message"]


def test_soil_scan_caller_handles_llm_unavailable_error():
    """POST /v1/db/soil/scan-report returns status: unavailable when vision LLM fails."""
    import base64

    from app.llm import get_llm_gateway

    gateway = get_llm_gateway()
    b64_dummy = base64.b64encode(b"dummy image bytes").decode("utf-8")

    err = LLMUnavailableError("Vision Offline")
    with patch.object(gateway, "generate_vision_response", side_effect=err):
        res = client.post("/v1/db/soil/scan-report", json={
            "image_base64": b64_dummy,
            "mime_type": "image/jpeg",
            "lang": "en"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "unavailable"
        assert data["advisory"] is None
        assert data["is_valid_report"] is False
        assert "temporarily unavailable" in data["message"]
