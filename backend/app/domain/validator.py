"""Validation of model outputs against factual retrieved facts."""

import re
from collections.abc import Sequence

from app.rag.models import SearchResult


def extract_price_numbers(text: str) -> set[float]:
    """Extract numeric price values from text."""
    matches = re.findall(r"(?:₹|rs\.?|inr)?\s*(\d+(?:,\d+)?(?:\.\d+)?)", text, re.IGNORECASE)
    numbers: set[float] = set()
    for m in matches:
        cleaned = m.replace(",", "").strip()
        try:
            val = float(cleaned)
            if val >= 1.0:
                numbers.add(val)
        except ValueError:
            continue
    return numbers


def validate_grounded_numbers(
    answer: str,
    retrieved_facts: Sequence[SearchResult],
) -> tuple[bool, list[str]]:
    """Verify that all major price figures in the answer exist in the factual context.

    Returns:
        tuple of (is_valid: bool, violations: list[str])
    """
    if not retrieved_facts:
        return True, []

    fact_numbers: set[float] = set()
    for fact in retrieved_facts:
        fact_numbers.update(extract_price_numbers(fact.text))
        meta = fact.metadata
        for key in (
            "min_price",
            "max_price",
            "modal_price",
            "highest_price",
            "lowest_price",
            "price_per_kg",
            "min_price_per_kg",
            "max_price_per_kg",
        ):
            if key in meta and isinstance(meta[key], (int, float)):
                val = float(meta[key])
                fact_numbers.add(val)
                fact_numbers.add(round(val / 100.0, 2))
                fact_numbers.add(round(val * 100.0, 2))

    answer_numbers = extract_price_numbers(answer)

    # Ignore common calendar years or date digits
    common_date_numbers = {
        2024.0, 2025.0, 2026.0, 2027.0,
        1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0,
        11.0, 12.0, 13.0, 14.0, 15.0, 16.0, 17.0, 18.0, 19.0, 20.0,
        21.0, 22.0, 23.0, 24.0, 25.0, 26.0, 27.0, 28.0, 29.0, 30.0, 31.0,
        100.0,
    }

    unsupported = [
        num
        for num in answer_numbers
        if num not in fact_numbers
        and round(num, 2) not in fact_numbers
        and round(num * 100.0, 2) not in fact_numbers
        and round(num / 100.0, 2) not in fact_numbers
        and num not in common_date_numbers
    ]

    if unsupported:
        violations = [
            f"Number {n:.0f} in response does not match injected fact numbers"
            for n in unsupported
        ]
        return False, violations

    return True, []
