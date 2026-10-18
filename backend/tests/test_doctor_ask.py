"""Unit and integration tests for POST /v1/doctor/ask and CIBRC embedding ingestion."""

import json
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.domain.doctor_service import CropDoctorService
from app.main import app
from scripts.embed_cibrc_registry import run_embedding_ingestion


class FakeEmbedder:
    """Deterministic fake embedder for offline unit testing without external APIs."""

    def __init__(self, dim: int = 768):
        self.dim = dim

    def embed_texts(
        self,
        texts: list[str],
        task_type: str = "RETRIEVAL_DOCUMENT",
    ) -> list[list[float]]:
        results = []
        for text in texts:
            val = (len(text) % 100) / 100.0
            vec = [val] * self.dim
            results.append(vec)
        return results


@pytest.fixture
def test_client():
    return TestClient(app)


def test_embed_cibrc_registry_with_fake_embedder():
    """Verify CIBRC embedding ingestion script embeds records using fake embedder."""
    fake_embedder = FakeEmbedder()
    count = run_embedding_ingestion(
        embedder=fake_embedder,
        batch_size=10,
        force_all=True,
        crop_filter="tomato",
    )
    assert count > 0


@pytest.mark.asyncio
async def test_doctor_ask_unknown_crop_abstains():
    """When crop cannot be determined, pipeline abstains with kisan_call_centre fallback."""
    service = CropDoctorService(embedder=FakeEmbedder())

    with patch.object(service, "extract_query_entities", new_callable=AsyncMock) as mock_extract:
        mock_extract.return_value = {
            "crop_key": None,
            "symptom": None,
            "pesticide": None,
            "confidence": 0.20,
        }

        res = await service.ask_pipeline(
            question="My leaves are turning yellow, what medicine should I use?",
            crop=None,
            lang="en",
        )

        assert res["abstained"] is True
        assert res["fallback"] == "kisan_call_centre"
        assert res["citations"] == []
        assert "Kisan Call Centre" in res["answer"] or "1800-180-1551" in res["answer"]


@pytest.mark.asyncio
async def test_doctor_ask_low_retrieval_score_abstains():
    """When top RRF retrieval score is below threshold, pipeline abstains."""
    service = CropDoctorService(embedder=FakeEmbedder())

    with patch.object(service, "extract_query_entities", new_callable=AsyncMock) as mock_extract:
        mock_extract.return_value = {
            "crop_key": "tomato",
            "symptom": "alien_galactic_syndrome",
            "pesticide": None,
            "confidence": 0.85,
        }

        with patch.object(service, "retrieve_hybrid_cibrc", return_value=([], 0.005)):
            res = await service.ask_pipeline(
                question="Tomato has alien galactic syndrome",
                crop="tomato",
                lang="en",
                abstain_threshold=0.012,
            )

            assert res["abstained"] is True
            assert res["fallback"] == "kisan_call_centre"
            assert res["citations"] == []


@pytest.mark.asyncio
async def test_doctor_ask_grounded_generation_copies_db_fields():
    """Generation: model returns record_ids; backend copies doses, PHI, toxicity from DB rows."""
    service = CropDoctorService(embedder=FakeEmbedder())

    mock_db_records = [
        {
            "id": 501,
            "category": "INSECTICIDE",
            "pesticide_name": "Chlorantraniliprole 18.50 % SC",
            "active_ingredient": "Chlorantraniliprole",
            "formulation": "18.50 % SC",
            "crop": "Tomato",
            "crop_key": "tomato",
            "target_pest_or_disease": "Fruit borer (Helicoverpa armigera)",
            "ai_dose": "30 g a.i./ha",
            "formulation_dose": "150 ml/ha",
            "dilution_water_liters": "500 L",
            "waiting_period_days": "3 days",
            "pump_dose_15l": "4.5 ml per 15L pump",
            "application_method": "Foliar Spray",
            "toxicity_band": "green",
            "toxicity_label": "Green Triangle (Caution)",
            "safety_warnings": "Do not exceed 2 sprays per cycle to avoid resistance.",
            "is_approved": True,
            "payload": {"common_brands": ["Coragen"]},
            "_rrf_score": 0.032,
        }
    ]

    mock_model_response = json.dumps({
        "selected_record_ids": [501],
        "reasoning": "Chlorantraniliprole provides effective control against Helicoverpa armigera.",
        "advisory_notes": "Spray uniformly on foliage during early morning.",
    })

    with patch.object(service.llm_gateway, "is_available", return_value=True):
        with patch.object(
            service.llm_gateway,
            "generate_response",
            new_callable=AsyncMock,
        ) as mock_llm:
            mock_llm.return_value = mock_model_response

            res = await service.generate_grounded_answer(
                question="How to control fruit borer in tomato?",
                crop_key="tomato",
                records=mock_db_records,
                lang="en",
            )

            assert res["abstained"] is False
            assert len(res["citations"]) == 1
            assert res["citations"][0]["record_id"] == 501
            assert "Chlorantraniliprole 18.50 % SC" in res["citations"][0]["source"]

            # Verify exact statutory database values were injected
            answer = res["answer"]
            assert "4.5 ml per 15L pump" in answer
            assert "150 ml/ha" in answer
            assert "3 days" in answer
            assert "Green Triangle" in answer
            assert "Do not exceed 2 sprays" in answer
            assert "effective control against Helicoverpa armigera" in answer


def test_doctor_ask_endpoint_sse_stream(test_client):
    """Test POST /v1/doctor/ask streams responses via Server-Sent Events (SSE)."""
    mock_record = {
        "id": 101,
        "category": "INSECTICIDE",
        "pesticide_name": "Chlorantraniliprole 18.50 % SC",
        "active_ingredient": "Chlorantraniliprole",
        "formulation": "18.50 % SC",
        "crop": "Tomato",
        "crop_key": "tomato",
        "target_pest_or_disease": "Fruit borer",
        "ai_dose": "30 g",
        "formulation_dose": "150 ml/ha",
        "dilution_water_liters": "500 L",
        "waiting_period_days": "3 days",
        "pump_dose_15l": "4.5 ml per 15L pump",
        "application_method": "Foliar Spray",
        "toxicity_band": "green",
        "toxicity_label": "Green Triangle",
        "safety_warnings": "Wear protective gear.",
        "is_approved": True,
        "payload": {},
        "_rrf_score": 0.030,
    }

    mock_llm_json = json.dumps({
        "selected_record_ids": [101],
        "reasoning": "Chlorantraniliprole is registered for tomato fruit borer.",
        "advisory_notes": "Apply thoroughly on canopy.",
    })

    with patch(
        "app.domain.doctor_service.doctor_service.extract_query_entities",
        new_callable=AsyncMock,
    ) as mock_extract:
        mock_extract.return_value = {
            "crop_key": "tomato",
            "symptom": "fruit borer",
            "pesticide": None,
            "confidence": 0.95,
        }

        with patch(
            "app.domain.doctor_service.doctor_service.retrieve_hybrid_cibrc",
            return_value=([mock_record], 0.030),
        ):
            with patch(
                "app.domain.doctor_service.doctor_service.llm_gateway.is_available",
                return_value=True,
            ):
                with patch(
                    "app.domain.doctor_service.doctor_service.llm_gateway.generate_response",
                    new_callable=AsyncMock,
                ) as mock_llm:
                    mock_llm.return_value = mock_llm_json

                    response = test_client.post(
                        "/v1/doctor/ask",
                        json={
                            "question": "What to spray for fruit borer in tomato?",
                            "crop": "tomato",
                            "lang": "en",
                        },
                    )

                    assert response.status_code == 200
                    assert "text/event-stream" in response.headers["content-type"]

                    lines = response.text.strip().split("\n\n")
                    assert len(lines) >= 2

                    payloads = []
                    for line in lines:
                        if line.startswith("data: "):
                            raw_json = line[6:].strip()
                            data = json.loads(raw_json)
                            payloads.append(data)

                    final_payload = payloads[-1]
                    assert "answer" in final_payload
                    assert "citations" in final_payload
                    assert final_payload["abstained"] is False
                    assert final_payload["confidence"] == 0.95
                    assert len(final_payload["citations"]) == 1
                    assert final_payload["citations"][0]["record_id"] == 101
                    assert "4.5 ml per 15L pump" in final_payload["answer"]


def test_doctor_ask_endpoint_abstain_sse(test_client):
    """Test POST /v1/doctor/ask streams abstained event when crop is unknown."""
    with patch(
        "app.domain.doctor_service.doctor_service.extract_query_entities",
        new_callable=AsyncMock,
    ) as mock_extract:
        mock_extract.return_value = {
            "crop_key": None,
            "symptom": None,
            "pesticide": None,
            "confidence": 0.1,
        }

        response = test_client.post(
            "/v1/doctor/ask",
            json={
                "question": "Vague question without crop or symptom",
                "lang": "te",
            },
        )

        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]

        lines = response.text.strip().split("\n\n")
        payloads = [json.loads(line[6:].strip()) for line in lines if line.startswith("data: ")]
        final_payload = payloads[-1]

        assert final_payload["abstained"] is True
        assert final_payload["fallback"] == "kisan_call_centre"
        assert "1800-180-1551" in final_payload["answer"]
