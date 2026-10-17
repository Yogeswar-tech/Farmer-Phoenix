"""Industry Standard Agricultural Search Engine & Scraper Pipeline Test Suite.

Standards Covered:
1. Hallucination Quarantine & Gatekeeping (Negative inputs, gibberish, hardware, SQLi, XSS)
2. Earth Agricultural Produce Coverage (Vegetables, Fruits, Mushrooms, Grains, Pulses, Spices, Cash Crops)
3. Boundary & Invariance (Case-insensitivity, Hindi/Telugu aliases, plurals, whitespace)
4. Stress, Load & Concurrency (Concurrent threads, latency p95/p99)
5. Data Integrity & Database Quarantine (Ensuring no junk data in PostgreSQL/SQLite)
"""

import sys
import time
import statistics
import concurrent.futures
from pathlib import Path
from typing import Any

# Path setup
CURRENT_FILE = Path(__file__).resolve()
BACKEND_DIR = CURRENT_FILE.parents[1]
PROJECT_ROOT = BACKEND_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Ensure utf-8 stdout on windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from scrapers.todays_live_page_scraper import search_live_today_crop
from database.multi_db_manager import query_live_today

# Color formatting
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"


class TestReport:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []

    def record(self, category: str, test_name: str, passed: bool, details: str = ""):
        if passed:
            self.passed += 1
            status = f"{GREEN}[PASS]{RESET}"
        else:
            self.failed += 1
            status = f"{RED}[FAIL]{RESET}"
        self.results.append({
            "category": category,
            "test_name": test_name,
            "passed": passed,
            "details": details
        })
        print(f"  {status} {category} -> {test_name}: {details}")


def run_gatekeeping_tests(report: TestReport):
    """Category 1: Hallucination Gatekeeping (Negative Inputs)."""
    print(f"\n{BOLD}{CYAN}=== 1. HALLUCINATION GATEKEEPING & NEGATIVE INPUT TESTS ==={RESET}")
    
    negative_inputs = [
        ("abcd", "Pure random alphabetic gibberish"),
        ("xyz123", "Alphanumeric noise"),
        ("laptop", "Consumer electronics / non-farm commodity"),
        ("plastic chair", "Industrial manufactured product"),
        ("car", "Automobile"),
        ("12345", "Pure digits"),
        ("!@#$%^", "Special symbols"),
        ("<script>alert(1)</script>", "XSS Script payload"),
        ("' OR '1'='1", "SQL injection vector"),
    ]

    for query, description in negative_inputs:
        try:
            res = search_live_today_crop(query)
            # Industry Standard: Must identify that query is NOT an agricultural commodity
            # If status == 'success' and it synthesized a fake commodity like 'Abcd', that is a Hallucination FAIL!
            is_hallucinated = (
                res.get("status") == "success" and 
                res.get("commodity", "").lower() == query.lower() and
                res.get("grade_a", {}).get("min_qtl", 0) > 0
            )
            
            if is_hallucinated:
                report.record(
                    "Gatekeeping",
                    f"Reject '{query}' ({description})",
                    False,
                    f"HALLUCINATION DETECTED! Fabricated prices for non-farm item '{res.get('commodity')}' (Min Grade A: ₹{res.get('grade_a', {}).get('min_qtl')})"
                )
            elif res.get("status") == "not_found":
                report.record(
                    "Gatekeeping",
                    f"Reject '{query}' ({description})",
                    True,
                    f"Correctly rejected with 'not_found' status: {res.get('message')}"
                )
            else:
                report.record(
                    "Gatekeeping",
                    f"Reject '{query}' ({description})",
                    False,
                    f"Unexpected response: {res}"
                )
        except Exception as e:
            report.record("Gatekeeping", f"Query '{query}'", False, f"Exception raised: {e}")


def run_earth_produce_coverage_tests(report: TestReport):
    """Category 2: Comprehensive Earth Produce Coverage."""
    print(f"\n{BOLD}{CYAN}=== 2. COMPREHENSIVE EARTH AGRICULTURAL PRODUCE TESTS ==={RESET}")
    
    test_crops = [
        # (Query, Category, Min Expected Grade A Quintal Rate)
        ("Tomato", "Vegetable", 1000),
        ("Potato", "Vegetable", 800),
        ("Onion", "Vegetable", 1200),
        ("Red Chilli", "Spice", 10000),
        ("Wheat", "Grain", 2000),
        ("Paddy", "Grain", 1800),
        ("Cotton", "Cash Crop", 6000),
        ("Mushroom", "Fungus/Produce", 8000),
        ("Button Mushroom", "Fungus/Produce", 8000),
        ("Oyster Mushroom", "Fungus/Produce", 9000),
        ("Dragon Fruit", "Exotic Fruit", 8000),
        ("Avocado", "Exotic Fruit", 10000),
        ("Custard Apple", "Native Fruit", 3000),
        ("Guava", "Fruit", 2000),
        ("Papaya", "Fruit", 1200),
        ("Mango", "Fruit", 4000),
        ("Banana", "Fruit", 1500),
        ("Pomegranate", "Fruit", 6000),
        ("Turmeric", "Spice", 8000),
        ("Ginger", "Spice", 5000),
        ("Garlic", "Spice", 6000),
        ("Soybean", "Oilseed", 3500),
        ("Groundnut", "Oilseed", 5000),
        ("Sugarcane", "Commercial", 300),
    ]

    for crop, cat, min_expected in test_crops:
        try:
            res = search_live_today_crop(crop)
            is_success = res.get("status") == "success"
            commodity = res.get("commodity", "")
            grade_a = res.get("grade_a", {})
            grade_b = res.get("grade_b", {})
            grade_c = res.get("grade_c", {})
            
            # Mathematical consistency checks
            a_min = grade_a.get("min_qtl", 0)
            a_max = grade_a.get("max_qtl", 0)
            b_min = grade_b.get("min_qtl", 0)
            c_min = grade_c.get("min_qtl", 0)
            
            has_valid_grades = (a_min > 0 and a_max >= a_min and a_min >= b_min and b_min >= c_min)
            is_genuine_catalog = not ("Standard / Premium" in res.get("variety", ""))

            if is_success and has_valid_grades:
                if is_genuine_catalog:
                    report.record("Earth Produce", f"Search '{crop}' ({cat})", True, 
                                  f"Found '{commodity}' | Grade A: ₹{a_min}-₹{a_max}/qtl | Variety: {res.get('variety')} | Market: {res.get('market')}")
                else:
                    report.record("Earth Produce", f"Search '{crop}' ({cat})", False, 
                                  f"MISSING AUTHENTIC DATA: Hit generic fallback synthesizer! Variety: {res.get('variety')}")
            else:
                report.record("Earth Produce", f"Search '{crop}' ({cat})", False, 
                              f"Inconsistent or failed response: success={is_success}, grades valid={has_valid_grades}")
        except Exception as e:
            report.record("Earth Produce", f"Search '{crop}'", False, f"Exception: {e}")


def run_linguistic_invariance_tests(report: TestReport):
    """Category 3: Boundary & Linguistic Invariance (Case, Aliases, Whitespace)."""
    print(f"\n{BOLD}{CYAN}=== 3. BOUNDARY & LINGUISTIC INVARIANCE TESTS ==={RESET}")

    invariance_cases = [
        ("  tomato  ", "Tomato", "Whitespace trimming"),
        ("tOmAtO", "Tomato", "Mixed case"),
        ("MUSHROOM", "Mushroom", "All uppercase"),
        ("mirchi", "Red Chilli", "Hindi/Telugu alias for Chilli"),
        ("aloo", "Potato", "Hindi alias for Potato"),
        ("pyaz", "Onion", "Hindi alias for Onion"),
        ("sitaphal", "Custard Apple", "Indian alias for Custard Apple"),
        ("chikoo", "Sapota", "Indian alias for Sapota"),
        ("tomatoes", "Tomato", "Plural form"),
        ("mushrooms", "Mushroom", "Plural form"),
    ]

    for query, expected_target, desc in invariance_cases:
        try:
            res = search_live_today_crop(query)
            comm = res.get("commodity", "").lower()
            target = expected_target.lower()
            matched = (target in comm or comm in target)
            if matched and res.get("status") == "success":
                report.record("Invariance", f"'{query}' -> {expected_target} ({desc})", True, f"Resolved to '{res.get('commodity')}'")
            else:
                report.record("Invariance", f"'{query}' -> {expected_target} ({desc})", False, f"Failed to resolve. Got: '{res.get('commodity')}', status: {res.get('status')}")
        except Exception as e:
            report.record("Invariance", f"'{query}'", False, f"Exception: {e}")


def run_stress_concurrency_tests(report: TestReport):
    """Category 4: Stress, Load & Concurrency (Industry Standard Latency & Stability)."""
    print(f"\n{BOLD}{CYAN}=== 4. STRESS & CONCURRENCY BENCHMARK TESTS ==={RESET}")
    
    test_queries = [
        "Tomato", "Red Chilli", "Wheat", "Cotton", "Mushroom",
        "Potato", "Onion", "Dragon Fruit", "Mango", "Soybean"
    ] * 5  # 50 total queries

    latencies = []
    errors = 0

    def query_worker(q):
        t0 = time.perf_counter()
        res = search_live_today_crop(q)
        t1 = time.perf_counter()
        return (t1 - t0), res

    start_bench = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(query_worker, q) for q in test_queries]
        for f in concurrent.futures.as_completed(futures):
            try:
                lat, res = f.result()
                latencies.append(lat * 1000)  # ms
            except Exception:
                errors += 1

    total_bench_time = time.perf_counter() - start_bench
    avg_latency = statistics.mean(latencies) if latencies else 0
    p95_latency = statistics.quantiles(latencies, n=20)[18] if len(latencies) >= 20 else avg_latency
    p99_latency = max(latencies) if latencies else 0
    rps = len(test_queries) / total_bench_time if total_bench_time > 0 else 0

    stress_passed = (errors == 0 and avg_latency < 100.0)
    report.record(
        "Stress & Load",
        "50 Concurrent Multi-Threaded Searches (10 workers)",
        stress_passed,
        f"Completed in {total_bench_time:.2f}s | Avg Latency: {avg_latency:.2f}ms | P95: {p95_latency:.2f}ms | P99: {p99_latency:.2f}ms | Errors: {errors} | Throughput: {rps:.1f} req/s"
    )


def run_database_integrity_tests(report: TestReport):
    """Category 5: Database Quarantine & Data Integrity."""
    print(f"\n{BOLD}{CYAN}=== 5. DATABASE QUARANTINE & DATA INTEGRITY TESTS ==={RESET}")
    
    try:
        # Check if any fabricated commodities are polluting the database
        junk_rows = query_live_today(
            "SELECT id, commodity, market, modal_price_qtl FROM live_today_mandi_prices WHERE LOWER(commodity) IN ('abcd', 'laptop', 'car', 'xyz123', 'plastic chair')",
            (),
            use_cache=False
        )
        if len(junk_rows) > 0:
            commodities = [r.get('commodity') for r in junk_rows]
            report.record(
                "Data Integrity",
                "Database Quarantine against Non-Farm Commodities",
                False,
                f"DATABASE POLLUTION FOUND! Found {len(junk_rows)} junk records stored in DB: {commodities}"
            )
        else:
            report.record(
                "Data Integrity",
                "Database Quarantine against Non-Farm Commodities",
                True,
                "Clean database: 0 non-farm commodities found in live_today_mandi_prices."
            )
    except Exception as e:
        report.record("Data Integrity", "Database Quarantine Check", False, f"Exception: {e}")


def main():
    report = TestReport()
    print(f"{BOLD}Starting Industry Standard Agricultural Search & Scraper Test Suite...{RESET}")
    
    run_gatekeeping_tests(report)
    run_earth_produce_coverage_tests(report)
    run_linguistic_invariance_tests(report)
    run_stress_concurrency_tests(report)
    run_database_integrity_tests(report)

    print(f"\n{BOLD}======================================================{RESET}")
    print(f"{BOLD}TEST SUMMARY:{RESET}")
    print(f"Total Tests Run : {report.passed + report.failed}")
    print(f"{GREEN}Total Passed    : {report.passed}{RESET}")
    print(f"{RED}Total Failed    : {report.failed}{RESET}")
    pass_pct = (report.passed / (report.passed + report.failed)) * 100 if (report.passed + report.failed) > 0 else 0
    print(f"Pass Rate       : {pass_pct:.1f}%")
    print(f"{BOLD}======================================================{RESET}")


if __name__ == "__main__":
    main()
