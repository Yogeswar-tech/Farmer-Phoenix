from unittest.mock import AsyncMock, patch

import pytest

from app.domain.pesticide_rag_service import PesticideRagService
from app.llm.client import LLMUnavailableError


@pytest.fixture
def service():
    return PesticideRagService()


@pytest.mark.asyncio
async def test_diagnose_and_prescribe_image_failure_returns_needs_more_info(service):
    """When image analysis fails and crop is missing, returns needs_more_info with questions."""
    with patch.object(
        service.llm_gateway,
        "generate_vision_response",
        new_callable=AsyncMock,
    ) as mock_vision:
        mock_vision.side_effect = LLMUnavailableError("Vision service timed out")

        res = await service.diagnose_and_prescribe(
            image_bytes=b"fake-image-bytes",
            crop_key=None,
            symptom_key=None,
        )

        assert res["status"] == "needs_more_info"
        assert len(res["questions"]) > 0
        assert "questions" in res
        assert res["actionable_solutions"] == []


@pytest.mark.asyncio
async def test_diagnose_and_prescribe_low_confidence_returns_needs_more_info(service):
    """When vision confidence is < 0.60, returns needs_more_info with questions."""
    with patch.object(service.llm_gateway, "is_available", return_value=True):
        with patch.object(
            service.llm_gateway,
            "generate_vision_response",
            new_callable=AsyncMock,
        ) as mock_vision:
            mock_vision.return_value = (
                '{"is_crop": true, "crop_key": "tomato", "symptom_key": "leaf_spot", '
                '"confidence": 0.45}'
            )

            res = await service.diagnose_and_prescribe(
                image_bytes=b"fake-image-bytes",
                crop_key=None,
                symptom_key=None,
            )

            assert res["status"] == "needs_more_info"
            assert "questions" in res
            assert len(res["questions"]) > 0
            assert res["actionable_solutions"] == []


@pytest.mark.asyncio
async def test_diagnose_and_prescribe_crop_not_in_registry_returns_needs_more_info(service):
    """When crop is not found in the CIBRC statutory registry, returns needs_more_info."""
    res = await service.diagnose_and_prescribe(
        crop_key="dragonfruit_unregistered_xyz",
        symptom_key="leaf_spot",
    )

    assert res["status"] == "needs_more_info"
    assert "No registered CIBRC records found" in res["message"] or "CIBRC" in res["message"]
    assert "questions" in res
    assert res["actionable_solutions"] == []


@pytest.mark.asyncio
async def test_diagnose_and_prescribe_no_symptom_records_empty_solutions_no_medicine(service):
    """If no records found for symptom, returns empty solutions list and no medicine in audio."""
    res = await service.diagnose_and_prescribe(
        crop_key="tomato",
        symptom_key="nonexistent_alien_xyz_unknown",
        lang="en",
    )

    assert res["status"] == "success"
    assert res["actionable_solutions"] == []
    assert "No registered products found" in res["message"]
    # Verify no audio script says "medicine"
    audio = res.get("audio_script", "").lower()
    assert "medicine" not in audio
    assert "మందు" not in audio
    assert "दवा" not in audio
    # Photo output reworded as possible causes and what to check, not definite diagnosis
    assert "possible_causes_and_what_to_check" in res
    notice = res["possible_causes_and_what_to_check"]["diagnostic_notice"]
    assert "not a definitive diagnosis" in notice


@pytest.mark.asyncio
async def test_diagnose_and_prescribe_range_pump_dose_parsing(service):
    """Parse pump_dose_15l ranges like '7.5-10 g' correctly (both bounds scaled)."""
    # Mock search_registry to return a custom record with range dose
    mock_record = {
        "id": 9991,
        "category": "FUNGICIDE",
        "pesticide_name": "Test Range Fungicide 50% WP",
        "active_ingredient": "TestMolecule",
        "formulation": "50% WP",
        "crop": "Tomato",
        "crop_key": "tomato",
        "target_pest_or_disease": "leaf spot, early blight",
        "ai_dose": "250-300 g",
        "formulation_dose": "500-600 g",
        "dilution_water_liters": "500 L",
        "waiting_period_days": "3 days",
        "pump_dose_15l": "7.5-10 g",
        "application_method": "Foliar Spray",
        "toxicity_band": "green",
        "toxicity_label": "Green",
        "safety_warnings": "Wear PPE",
        "is_approved": 0,  # Explicitly False in DB row to test derivation
        "payload": {"common_brands": ["TestBrand"]},
    }

    with patch.object(service, "search_registry", return_value=[mock_record]):
        # Test 30L tank: 7.5g / 15 * 30 = 15.0g, 10g / 15 * 30 = 20.0g
        res = await service.diagnose_and_prescribe(
            crop_key="tomato",
            symptom_key="leaf_spot",
            tank_liters=30,
        )

        assert res["status"] == "success"
        solutions = res["actionable_solutions"]
        assert len(solutions) == 1
        sol = solutions[0]

        # Verify range dose parsing: scaled to 30L tank
        assert "15.0-20.0 g per 30L pump" in sol["pump_dose"]
        # Verify is_cibrc_approved derived from database row, not hardcoded True!
        assert sol["is_cibrc_approved"] is False

        # Output reworded as possible causes and what to check
        assert "possible_causes_and_what_to_check" in res
        assert sol["brand_name"] == "TestBrand"
