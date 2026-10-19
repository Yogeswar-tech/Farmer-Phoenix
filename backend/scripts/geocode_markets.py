"""Geocode APMC Mandis into market_coordinates table.

1. Reads distinct (market, state) pairs from mandi_prices and mandi_price_history.
2. Resolves coordinates against built-in KNOWN_LOCATIONS from app/location/geocoder.py first.
3. If not found in built-in catalog, attempts Google Geocoding API ONLY if KS_GOOGLE_MAPS_API_KEY is configured.
4. Stores resolved coordinates in `market_coordinates` table with unique constraint on (market, state).
5. Reports markets without coordinates.
"""

from __future__ import annotations

import json
import logging
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from database.connection import get_db_cursor, init_database, is_postgres_active

from app.location.geocoder import KNOWN_LOCATIONS

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("GeocodeMarkets")


def find_known_location_coords(market_name: str, state_name: str) -> tuple[float, float] | None:
    """Finds coordinates from geocoder.py's KNOWN_LOCATIONS built-in catalog."""
    market_clean = market_name.lower().strip()
    state_clean = state_name.lower().strip()

    # Direct check against known locations (longest first)
    for name in sorted(KNOWN_LOCATIONS.keys(), key=len, reverse=True):
        if name in market_clean or name == state_clean:
            coords = KNOWN_LOCATIONS[name]
            return (float(coords.latitude), float(coords.longitude))

    # Strip common suffixes like APMC, Yard, Mandi, Market and re-test
    stripped = market_clean
    for suffix in ["apmc yard", "apmc", "market yard", "mandi", "market", "(f&v)", "(frui & veg. market)"]:
        stripped = stripped.replace(suffix, "").strip()

    for token in stripped.split():
        clean_token = token.strip(" ,.-()")
        if len(clean_token) >= 3 and clean_token in KNOWN_LOCATIONS:
            coords = KNOWN_LOCATIONS[clean_token]
            return (float(coords.latitude), float(coords.longitude))

    return None


def fetch_google_maps_coords(market: str, state: str, api_key: str) -> tuple[float, float] | None:
    """Calls Google Geocoding API if key configured."""
    query = f"{market}, {state}, India"
    url = f"https://maps.googleapis.com/maps/api/geocode/json?address={urllib.parse.quote(query)}&key={api_key}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "KisanSethu-Geocoder/1.0"})
        with urllib.request.urlopen(req, timeout=8.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("status") == "OK" and data.get("results"):
                loc = data["results"][0]["geometry"]["location"]
                return (float(loc["lat"]), float(loc["lng"]))
    except Exception as exc:
        logger.warning("Google Geocoding failed for '%s': %s", query, exc)
    return None


def geocode_all_markets() -> dict[str, Any]:
    init_database()
    use_pg = is_postgres_active()
    placeholder = "%s" if use_pg else "?"

    # 1. Fetch distinct markets across live prices and history
    distinct_markets: list[tuple[str, str]] = []
    with get_db_cursor() as cur:
        cur.execute("""
        SELECT DISTINCT market, state FROM mandi_prices
        UNION
        SELECT DISTINCT market, state FROM mandi_price_history;
        """)
        rows = cur.fetchall()
        for r in rows:
            m = r["market"] if isinstance(r, dict) else r[0]
            s = r["state"] if isinstance(r, dict) else r[1]
            if m and s:
                distinct_markets.append((m.strip(), s.strip()))

    logger.info("Found %d distinct markets to evaluate for coordinates.", len(distinct_markets))

    google_api_key = os.getenv("KS_GOOGLE_MAPS_API_KEY", "")
    has_google_key = bool(
        google_api_key
        and not google_api_key.startswith("your_")
        and "placeholder" not in google_api_key.lower()
    )

    geocoded_count = 0
    unmapped_markets: list[tuple[str, str]] = []

    with get_db_cursor() as cur:
        for market, state in distinct_markets:
            coords = find_known_location_coords(market, state)
            source_tag = "KNOWN_LOCATIONS"

            if not coords and has_google_key:
                coords = fetch_google_maps_coords(market, state, google_api_key)
                source_tag = "GOOGLE_MAPS"

            if coords:
                lat, lon = coords
                if use_pg:
                    cur.execute(f"""
                    INSERT INTO market_coordinates (market, state, lat, lon, source, updated_at)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, CURRENT_TIMESTAMP)
                    ON CONFLICT (market, state) DO UPDATE SET
                        lat = EXCLUDED.lat,
                        lon = EXCLUDED.lon,
                        source = EXCLUDED.source,
                        updated_at = CURRENT_TIMESTAMP;
                    """, (market, state, lat, lon, source_tag))
                else:
                    cur.execute(f"""
                    INSERT INTO market_coordinates (market, state, lat, lon, source, updated_at)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, datetime('now'))
                    ON CONFLICT(market, state) DO UPDATE SET
                        lat = excluded.lat,
                        lon = excluded.lon,
                        source = excluded.source,
                        updated_at = datetime('now');
                    """, (market, state, lat, lon, source_tag))
                geocoded_count += 1
            else:
                unmapped_markets.append((market, state))

    logger.info("Geocoding run finished: %d markets mapped, %d unmapped.", geocoded_count, len(unmapped_markets))
    if unmapped_markets:
        print("\n" + "="*70)
        print("[MARKETS WITHOUT COORDINATES]:")
        print("="*70)
        for m, s in unmapped_markets[:50]:
            print(f"  - Market: {m:<35} State: {s}")
        if len(unmapped_markets) > 50:
            print(f"  ... and {len(unmapped_markets) - 50} more unmapped markets.")
        print("="*70 + "\n")

    return {
        "total_markets": len(distinct_markets),
        "geocoded_count": geocoded_count,
        "unmapped_count": len(unmapped_markets),
        "unmapped_markets": unmapped_markets
    }


if __name__ == "__main__":
    res = geocode_all_markets()
    print("Geocode summary:", res)
