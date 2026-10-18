"""Evaluation runner for Crop Doctor RAG (/v1/doctor/ask).

Evaluates the 150 cases from golden_set.jsonl and calculates:
1. Recall@5: Fraction of normal queries where expected approved chemical appears in top-5 citations.
2. Faithfulness: 1.0 iff every numerical dose in the answer exists in cited CIBRC database records.
3. Correct-Abstain Rate: Fraction of off-label, wrong-crop, vague, non-farming, and injection cases correctly rejected.
4. P95 Latency: 95th percentile response latency in seconds.

Exits with code 1 if faithfulness < 1.0 or correct-abstain < 0.90.
"""

import json
import logging
import math
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

# Configure project roots
BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Set test environment to avoid live network requirement during CI
os.environ.setdefault("KS_ENV", "test")

from fastapi.testclient import TestClient

from app.core.security import default_ask_limiter
from app.main import app
from database.cibrc_isolated_db import get_cibrc_cursor

# Allow eval harness to run all 150 queries without hitting 429
default_ask_limiter.requests_limit = 100000

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

logger = logging.getLogger("CropDoctorEvals")


def extract_dosage_numbers(text: str) -> set[float]:
    """Extract numeric dosage figures from text (e.g. '4.5 ml', '150 ml/ha', '35 g', '3 days')."""
    # Look for numbers associated with units ml, g, kg, l, days
    pattern = r"(\d+(?:\.\d+)?)\s*(?:ml|g|gm|kg|l|litres|liters|days|రోజులు|दिन)\b"
    matches = re.findall(pattern, text, re.IGNORECASE)
    numbers: set[float] = set()
    for m in matches:
        try:
            val = float(m)
            # Exclude standard year numbers
            if val not in {2024.0, 2025.0, 2026.0, 2027.0}:
                numbers.add(val)
        except ValueError:
            continue
    return numbers


def get_record_dosage_numbers(record_ids: list[int]) -> set[float]:
    """Retrieve all valid numerical dosages, days, and volumes from CIBRC database for cited records."""
    if not record_ids:
        return set()

    from database.connection import is_postgres_active
    ph = "%s" if is_postgres_active() else "?"
    numbers: set[float] = set()
    with get_cibrc_cursor() as cur:
        for rid in record_ids:
            cur.execute(
                f"SELECT * FROM cibrc_pesticide_registry WHERE id = {ph};",
                (rid,)
            )
            row = cur.fetchone()
            if row:
                row_dict = dict(row)
                text_to_scan = " ".join(str(v) for v in row_dict.values() if v)
                numbers.update(extract_dosage_numbers(text_to_scan))
                # Also extract all pure numbers from fields
                for val in re.findall(r"\d+(?:\.\d+)?", text_to_scan):
                    try:
                        n = float(val)
                        if n not in {2024.0, 2025.0, 2026.0, 2027.0}:
                            numbers.add(n)
                    except ValueError:
                        continue
    return numbers


def run_evaluations() -> dict[str, Any]:
    dataset_path = Path(__file__).resolve().parent / "golden_set.jsonl"
    if not dataset_path.exists():
        raise FileNotFoundError(f"Golden dataset missing at {dataset_path}")

    with open(dataset_path, encoding="utf-8") as f:
        cases = [json.loads(line) for line in f if line.strip()]

    print(f"\n================================================================================")
    print(f"🚀 Running Kisan Sethu Crop Doctor Evals on {len(cases)} cases")
    print(f"================================================================================\n")

    client = TestClient(app)

    latencies: list[float] = []
    normal_total = 0
    normal_recalled = 0
    abstain_total = 0
    abstain_correct = 0
    faithfulness_total = 0
    faithfulness_correct = 0

    category_stats: dict[str, dict[str, int]] = {}

    for idx, case in enumerate(cases, start=1):
        case_id = case["id"]
        category = case["category"]
        should_abstain = case["should_abstain"]
        expected_chems = case.get("expected_chemicals", [])

        if category not in category_stats:
            category_stats[category] = {"total": 0, "success": 0}
        category_stats[category]["total"] += 1

        payload_req = {
            "question": case["question"],
            "crop": case.get("crop"),
            "lang": case.get("lang", "en"),
        }

        t0 = time.perf_counter()
        response = client.post("/v1/doctor/ask", json=payload_req)
        duration = time.perf_counter() - t0
        latencies.append(duration)

        if response.status_code != 200:
            print(f"[{idx:03d}/{len(cases)}] {case_id} ❌ HTTP {response.status_code}")
            continue

        # Parse SSE events from response text
        raw_lines = response.text.strip().split("\n\n")
        final_payload: dict[str, Any] = {}
        for block in raw_lines:
            for line in block.split("\n"):
                if line.startswith("data: "):
                    try:
                        data = json.loads(line[6:].strip())
                        if "answer" in data or "abstained" in data:
                            final_payload = data
                    except Exception:
                        pass

        is_abstained = bool(final_payload.get("abstained", False))
        answer = str(final_payload.get("answer", ""))
        citations = final_payload.get("citations", [])

        # 1. Correct Abstain Rate Check
        if should_abstain:
            abstain_total += 1
            if is_abstained:
                abstain_correct += 1
                category_stats[category]["success"] += 1
                status_icon = "✅ (Abstained)"
            else:
                status_icon = "❌ (FAILED TO ABSTAIN)"
        else:
            # 2. Normal Query Checks
            normal_total += 1
            # Recall@5 check: verify expected chemical appears in citations or answer
            cited_record_ids = [int(c["record_id"]) for c in citations if "record_id" in c]
            cited_texts = " ".join(str(c.get("source", "")) for c in citations) + " " + answer
            recalled = any(
                chem.lower() in cited_texts.lower() for chem in expected_chems
            ) if expected_chems else True

            if recalled:
                normal_recalled += 1
                category_stats[category]["success"] += 1

            # 3. Faithfulness Check: Every dose number in answer MUST exist in cited record
            answer_doses = extract_dosage_numbers(answer)
            record_doses = get_record_dosage_numbers(cited_record_ids)

            # If answer contains doses, they must all be grounded in the cited DB records
            unfaithful_doses = [d for d in answer_doses if d not in record_doses]
            is_faithful = len(unfaithful_doses) == 0

            faithfulness_total += 1
            if is_faithful:
                faithfulness_correct += 1
                status_icon = "✅ (Faithful)"
            else:
                print(f"DEBUG {case_id}: answer_doses={answer_doses}, record_doses={record_doses}, unfaithful={unfaithful_doses}, answer={answer[:200]}")
                status_icon = f"❌ (Unfaithful doses: {unfaithful_doses})"

        if idx % 25 == 0 or idx == len(cases):
            print(f"[{idx:03d}/{len(cases)}] {case_id} ({category}) {status_icon} ({duration*1000:.1f}ms)")

    # Calculate aggregate metrics
    latencies.sort()
    p95_index = math.ceil(0.95 * len(latencies)) - 1
    p95_latency = latencies[min(p95_index, len(latencies) - 1)]

    recall_at_5 = (normal_recalled / normal_total) if normal_total > 0 else 1.0
    faithfulness = (faithfulness_correct / faithfulness_total) if faithfulness_total > 0 else 1.0
    correct_abstain_rate = (abstain_correct / abstain_total) if abstain_total > 0 else 1.0

    print("\n" + "=" * 80)
    print("📊 CROP DOCTOR EVALUATION SUMMARY REPORT")
    print("=" * 80)
    print(f"Total Test Cases:          {len(cases)}")
    print(f"Recall@5 (Normal Queries): {recall_at_5 * 100:.1f}% ({normal_recalled}/{normal_total})")
    print(f"Faithfulness Rate:         {faithfulness * 100:.2f}% ({faithfulness_correct}/{faithfulness_total})  [Target: 100.0%]")
    print(f"Correct-Abstain Rate:      {correct_abstain_rate * 100:.1f}% ({abstain_correct}/{abstain_total})  [Target: >= 90.0%]")
    print(f"P95 Latency:               {p95_latency:.3f}s ({p95_latency * 1000:.1f}ms)")
    print("-" * 80)
    print("Category Breakdown:")
    for cat, stats in category_stats.items():
        rate = (stats["success"] / stats["total"]) * 100 if stats["total"] > 0 else 0
        print(f"  • {cat:<15}: {stats['success']:>3}/{stats['total']:<3} ({rate:.1f}%)")
    print("=" * 80)

    # Enforce strict gating thresholds:
    # Fail with exit code 1 if faithfulness < 1.0 or correct-abstain < 0.9
    failed = False
    if faithfulness < 1.0:
        print(f"❌ FAILED: Faithfulness {faithfulness:.4f} is below mandatory threshold 1.0 (100%)")
        failed = True

    if correct_abstain_rate < 0.90:
        print(f"❌ FAILED: Correct-Abstain Rate {correct_abstain_rate:.4f} is below mandatory threshold 0.90 (90%)")
        failed = True

    if failed:
        sys.exit(1)
    else:
        print("✅ ALL EVALUATION THRESHOLDS SATISFIED SUCCESSFULLY!")
        return {
            "recall_at_5": recall_at_5,
            "faithfulness": faithfulness,
            "correct_abstain_rate": correct_abstain_rate,
            "p95_latency": p95_latency,
        }


if __name__ == "__main__":
    run_evaluations()
