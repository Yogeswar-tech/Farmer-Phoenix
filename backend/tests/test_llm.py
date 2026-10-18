"""Unit tests for prompt loader and LLM gateway."""

import pytest

from app.domain.validator import extract_price_numbers, validate_grounded_numbers
from app.llm.client import LLMGateway
from app.llm.prompt_loader import load_prompt
from app.rag.models import SearchResult


def test_load_prompt_and_fragments() -> None:
    prompt = load_prompt(
        feature="price",
        name="advisor",
        version=1,
        variables={
            "current_date": "2026-10-11",
            "farmer_location": "Chennai",
            "nearest_mandis": "Koyambedu (1.2 km)",
            "retrieved_facts": "Tomato: ₹2500/qtl",
            "farmer_query": "What is tomato price?",
        },
    )

    # Verify shared policy was included
    assert "Strict Grounding & Safety Policy" in prompt
    assert "No Chemical Dosages" in prompt
    # Verify variables injected
    assert "2026-10-11" in prompt
    assert "Chennai" in prompt
    assert "Tomato: ₹2500/qtl" in prompt


@pytest.mark.asyncio
async def test_llm_gateway_unconfigured_raises() -> None:
    from app.llm.client import LLMUnavailableError
    gateway = LLMGateway(api_key="", project_id="")
    prompt = (
        "Context:\n"
        "[1] Tomato (Hybrid) in Koyambedu mandi on 2026-10-11: Modal price is ₹2500/quintal\n"
        "Question: Tomato price near Chennai?"
    )
    with pytest.raises(LLMUnavailableError):
        await gateway.generate_response(prompt)


def test_validator_grounding_pass() -> None:
    facts = [
        SearchResult(
            chunk_id="c1",
            text="Tomato in Koyambedu: Modal price is ₹2500/quintal",
            score=0.9,
            metadata={"modal_price": 2500.0},
        )
    ]
    answer = "The modal price in Koyambedu is ₹2500 per quintal."
    is_valid, violations = validate_grounded_numbers(answer, facts)
    assert is_valid is True
    assert len(violations) == 0


def test_validator_grounding_detects_hallucination() -> None:
    facts = [
        SearchResult(
            chunk_id="c1",
            text="Tomato in Koyambedu: Modal price is ₹2500/quintal",
            score=0.9,
            metadata={"modal_price": 2500.0},
        )
    ]
    # Model hallucinated 3800 which is nowhere in the facts
    answer = "The price of tomato in Koyambedu is ₹3800 per quintal."
    is_valid, violations = validate_grounded_numbers(answer, facts)
    assert is_valid is False
    assert len(violations) > 0


def test_extract_price_numbers() -> None:
    text = "Prices are ₹2,500/quintal in Koyambedu and Rs 2150 in Oddanchatram."
    nums = extract_price_numbers(text)
    assert 2500.0 in nums
    assert 2150.0 in nums
