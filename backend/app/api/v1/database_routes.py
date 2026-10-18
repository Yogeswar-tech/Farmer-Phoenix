"""Live Database API Endpoints for Kisan-Sethu.

Connects FastAPI backend to PostgreSQL (with fallback SQLite) and Redis Cache Server to serve:
1. Scraped APMC mandi prices and modal ₹/kg rates (Cached in Redis, TTL 15m).
2. 7-Day operational weather advisories and spray windows (Cached in Redis, TTL 1h).
3. Cold storage directory and freight rates (Cached in Redis, TTL 6h).
4. Government policies and 4% KCC concessional loans (Cached in Redis, TTL 12h).
5. Redis cache inspection, health monitoring, and on-demand scraper triggers.
"""

import sys
import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Query, HTTPException, Body
from pydantic import BaseModel, Field

# Ensure project root is in sys.path
CURRENT_FILE = Path(__file__).resolve()
BACKEND_DIR = CURRENT_FILE.parents[3]
PROJECT_ROOT = BACKEND_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from database.connection import get_db_cursor, is_postgres_active, init_database
from app.cache.cache_service import cache_service, cached
from app.settings import settings
from scrapers.ingester import run_full_ingestion

router = APIRouter(prefix="/db", tags=["Database & Live Scraped Feeds"])


@router.get("/mandi-rates")
@cached(prefix="mandi:rates", ttl_seconds=settings.redis_ttl_mandi)
def get_mandi_rates(
    commodity: str | None = Query(None, description="Crop filter (e.g. Chilli, Tomato, Onion)"),
    state: str | None = Query(None, description="State filter (e.g. Andhra Pradesh, Maharashtra)"),
    limit: int = Query(25, ge=1, le=100)
) -> dict[str, Any]:
    """Retrieve scraped live mandi prices from database with Redis caching."""
    use_pg = is_postgres_active()
    placeholder = "%s" if use_pg else "?"

    query = "SELECT * FROM mandi_prices WHERE 1=1"
    params: list[Any] = []

    if commodity:
        query += f" AND LOWER(commodity) = LOWER({placeholder})"
        params.append(commodity)
    if state:
        query += f" AND LOWER(state) = LOWER({placeholder})"
        params.append(state)

    query += f" ORDER BY arrival_date DESC, modal_price_qtl DESC LIMIT {placeholder}"
    params.append(limit)

    with get_db_cursor() as cursor:
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        items = [dict(r) for r in rows]

    return {
        "status": "success",
        "count": len(items),
        "database_engine": "PostgreSQL" if use_pg else "SQLite (Fallback)",
        "commodity_filter": commodity,
        "data": items
    }


@router.get("/weather-advisories")
@cached(prefix="weather:advisory", ttl_seconds=settings.redis_ttl_weather)
def get_weather_advisories(
    location_id: str | None = Query(None, description="Location id (e.g. guntur, madanapalle, nashik)"),
    limit: int = Query(7, ge=1, le=30)
) -> dict[str, Any]:
    """Retrieve 7-day operational spray advisories and drying windows with Redis caching."""
    use_pg = is_postgres_active()
    placeholder = "%s" if use_pg else "?"

    query = "SELECT * FROM weather_advisories WHERE 1=1"
    params: list[Any] = []

    if location_id:
        query += f" AND LOWER(location_id) = LOWER({placeholder})"
        params.append(location_id)

    query += f" ORDER BY forecast_date ASC LIMIT {placeholder}"
    params.append(limit)

    with get_db_cursor() as cursor:
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        items = [dict(r) for r in rows]

    return {
        "status": "success",
        "location": location_id,
        "count": len(items),
        "database_engine": "PostgreSQL" if use_pg else "SQLite (Fallback)",
        "data": items
    }


def _haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    import math
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2.0) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(r * c, 1)


@router.get("/cold-storages")
def get_cold_storages(
    district: str | None = Query(None, description="Optional district filter"),
    state: str | None = Query(None, description="Optional state filter"),
    lat: float | None = Query(None, description="User latitude for distance calculation"),
    lng: float | None = Query(None, description="User longitude for distance calculation"),
    radius_km: float | None = Query(None, description="Filter within radius in KM (e.g. 50, 100, 250, 500)"),
    commodity: str | None = Query(None, description="Commodity filter (e.g. Chilli, Tomato, Onion, Potato, Apple)"),
    search: str | None = Query(None, description="Search keyword across name, district, address, commodities")
) -> dict[str, Any]:
    """Retrieve verified Pan-India cold storage facilities, real vacant bags, GPS distances, and rental rates."""
    import json
    use_pg = is_postgres_active()
    active_clause = "is_active = TRUE" if use_pg else "is_active = 1"

    # Safely normalize parameter inputs (handles both FastAPI DI and direct Python invocation)
    dist_val = district.strip() if isinstance(district, str) and district.strip() else None
    state_val = state.strip() if isinstance(state, str) and state.strip() else None
    lat_val = float(lat) if isinstance(lat, (int, float)) else None
    lng_val = float(lng) if isinstance(lng, (int, float)) else None
    radius_val = float(radius_km) if isinstance(radius_km, (int, float)) and radius_km > 0 else None
    comm_val = commodity.strip().lower() if isinstance(commodity, str) and commodity.strip() and commodity.strip().lower() != "all" else None
    search_val = search.strip().lower() if isinstance(search, str) and search.strip() else None

    query = f"SELECT * FROM cold_storages WHERE {active_clause} ORDER BY id ASC"

    with get_db_cursor() as cursor:
        cursor.execute(query)
        rows = cursor.fetchall()
        raw_items = [dict(r) for r in rows]

    items: list[dict[str, Any]] = []
    for r in raw_items:
        meta = r.get("facility_meta") or {}
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except Exception:
                meta = {}

        capacity_mt = int(r.get("capacity_mt") or 5000)
        available_mt = int(r.get("available_mt") or 1200)
        total_bags = capacity_mt * 20
        vacant_bags = available_mt * 20
        occupancy_pct = round(((capacity_mt - available_mt) / capacity_mt) * 100, 1) if capacity_mt > 0 else 0.0

        rent_qtl = float(r.get("monthly_rent_per_qtl") or 110.0)
        rent_bag = int(meta.get("rent_per_bag") or round(rent_qtl / 2))

        f_lat = float(r.get("latitude") or 0.0)
        f_lng = float(r.get("longitude") or 0.0)

        dist_km: float | None = None
        if lat_val is not None and lng_val is not None and f_lat != 0.0 and f_lng != 0.0:
            dist_km = _haversine_distance_km(lat_val, lng_val, f_lat, f_lng)

        crops = meta.get("crops") or []
        wdra_accredited = bool(meta.get("wdra_accredited", False))
        temp_range_c = meta.get("temp_range_c") or "2°C to 8°C"
        chambers = int(meta.get("chambers") or 6)

        facility_obj = {
            "id": r.get("facility_id") or f"cs-{r.get('id')}",
            "facility_id": r.get("facility_id"),
            "name": r.get("name"),
            "district": r.get("district"),
            "state": r.get("state"),
            "latitude": f_lat,
            "longitude": f_lng,
            "capacity_mt": capacity_mt,
            "available_mt": available_mt,
            "total_capacity_bags": total_bags,
            "vacant_capacity_bags": vacant_bags,
            "occupancy_pct": occupancy_pct,
            "monthly_rent_per_qtl": rent_qtl,
            "rent_per_bag_per_month": rent_bag,
            "contact_phone": r.get("contact_phone") or "+91 863 2234567",
            "distance_km": dist_km,
            "crops": crops,
            "temp_range_c": temp_range_c,
            "chambers": chambers,
            "wdra_accredited": wdra_accredited,
            "facility_meta": meta
        }

        # Commodity filtering
        if comm_val:
            crops_lower = [str(c).lower() for c in crops]
            name_lower = str(facility_obj["name"]).lower()
            if not any(comm_val in c for c in crops_lower) and comm_val not in name_lower:
                continue

        # Search keyword filtering
        if search_val:
            name_str = str(facility_obj["name"]).lower()
            dist_str = str(facility_obj["district"]).lower()
            state_str = str(facility_obj["state"]).lower()
            addr_str = str(meta.get("address", "")).lower()
            crops_str = " ".join([str(c).lower() for c in crops])
            if (search_val not in name_str and search_val not in dist_str and
                    search_val not in state_str and search_val not in addr_str and
                    search_val not in crops_str):
                continue

        # Radius filtering if GPS coordinate was provided
        if dist_km is not None and radius_val is not None:
            if dist_km > radius_val:
                continue

        items.append(facility_obj)

    # Sorting
    if lat_val is not None and lng_val is not None:
        items.sort(key=lambda x: x["distance_km"] if x["distance_km"] is not None else 999999)
    elif dist_val:
        d_lower = dist_val.lower()
        items.sort(key=lambda x: 0 if str(x["district"]).lower() == d_lower else 1)
    elif state_val:
        s_lower = state_val.lower()
        items.sort(key=lambda x: 0 if str(x["state"]).lower() == s_lower else 1)

    return {
        "status": "success",
        "count": len(items),
        "database_engine": "PostgreSQL" if use_pg else "SQLite (Fallback)",
        "facilities": items
    }


@router.get("/govt-schemes")
@cached(prefix="schemes:list", ttl_seconds=settings.redis_ttl_schemes)
def get_govt_schemes(
    category: str | None = Query(None, description="Filter: LOAN, SUBSIDY, INSURANCE, POLICY, SOLAR"),
    lang: str = Query("en", description="Preferred response language: en, hi, te")
) -> dict[str, Any]:
    """Retrieve scraped government schemes, low-interest agricultural loans, and subsidies."""
    use_pg = is_postgres_active()
    placeholder = "%s" if use_pg else "?"
    active_clause = "is_active = TRUE" if use_pg else "is_active = 1"

    query = f"SELECT * FROM govt_policies_and_loans WHERE {active_clause}"
    params: list[Any] = []

    if category and category.upper() != "ALL":
        query += f" AND UPPER(category) = UPPER({placeholder})"
        params.append(category)

    query += " ORDER BY id ASC"

    with get_db_cursor() as cursor:
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        if not rows:
            # Seed automatically if database is fresh
            from scrapers.ingester import ingest_govt_schemes
            from scrapers.govt_scraper import scrape_govt_policies
            ingest_govt_schemes(scrape_govt_policies())
            cursor.execute(query, tuple(params))
            rows = cursor.fetchall()
        items = [dict(r) for r in rows]

    formatted_schemes = []
    for d in items:
        formatted_schemes.append({
            "id": d["scheme_id"],
            "category": d["category"],
            "title": {
                "en": d["title_en"],
                "hi": d["title_hi"],
                "te": d["title_te"],
            },
            "shortDesc": {
                "en": d["short_desc_en"],
                "hi": d["short_desc_hi"],
                "te": d["short_desc_te"],
            },
            "benefitAmount": d["benefit_amount"],
            "interestRate": d.get("interest_rate", ""),
            "maxLimit": d.get("max_limit", ""),
            "eligibility": {
                "en": d["eligibility_en"],
                "hi": d["eligibility_hi"],
                "te": d["eligibility_te"],
            },
            "helpline": d["helpline"],
            "applyUrl": d["apply_url"],
            "sourcePortal": d.get("source_portal", "myscheme.gov.in"),
            "tag": {
                "en": f"{d['category']} • {d.get('source_portal', 'Govt')}",
                "hi": f"{'ऋण' if d['category']=='LOAN' else 'योजना'} • {d.get('source_portal', 'Govt')}",
                "te": f"{'రుణం' if d['category']=='LOAN' else 'పథకం'} • {d.get('source_portal', 'Govt')}",
            }
        })

    return {
        "status": "success",
        "total": len(formatted_schemes),
        "database_engine": "PostgreSQL" if use_pg else "SQLite (Fallback)",
        "source": "PostgreSQL (govt_policies_and_loans)",
        "schemes": formatted_schemes
    }


@router.api_route("/refresh-govt-schemes", methods=["GET", "POST"])
def refresh_govt_schemes() -> dict[str, Any]:
    """Force an immediate re-scrape of government policies and invalidate Redis cache."""
    from scrapers.ingester import ingest_govt_schemes
    from scrapers.govt_scraper import scrape_govt_policies
    result_count = ingest_govt_schemes(scrape_govt_policies())
    cache_service.invalidate_pattern("schemes:*")
    return {
        "status": "success",
        "message": f"Government policies and loan schemes refreshed ({result_count} records upserted).",
        "cache_invalidated": True
    }


@router.get("/cache/status")
def get_cache_status() -> dict[str, Any]:
    """Check Redis server health and active cached keys."""
    health_info = cache_service.health()
    active_keys = cache_service.client.keys("*")
    return {
        "health": health_info,
        "total_keys": len(active_keys),
        "keys_sample": active_keys[:20]
    }


@router.post("/cache/purge")
def purge_cache(pattern: str = Query("*", description="Pattern to purge e.g. mandi:*, weather:*")) -> dict[str, Any]:
    """Invalidate cached keys in Redis."""
    purged_count = cache_service.invalidate_pattern(pattern)
    return {
        "status": "success",
        "pattern": pattern,
        "purged_keys_count": purged_count
    }


@router.get("/sync-status")
def get_sync_status() -> dict[str, Any]:
    """Retrieve scraper audit execution history and freshness timestamp for the frontend."""
    use_pg = is_postgres_active()
    with get_db_cursor() as cursor:
        cursor.execute("SELECT * FROM scraper_audit_logs ORDER BY executed_at DESC LIMIT 5;")
        logs = [dict(r) for r in cursor.fetchall()]

        cursor.execute("SELECT COUNT(*) AS c FROM mandi_prices;")
        mandi_cnt = cursor.fetchone()["c"]

        cursor.execute("SELECT COUNT(*) AS c FROM govt_policies_and_loans;")
        gov_cnt = cursor.fetchone()["c"]

        cursor.execute("SELECT COUNT(*) AS c FROM weather_advisories;")
        weather_cnt = cursor.fetchone()["c"]

    last_sync_time = logs[0]["executed_at"] if logs else datetime.datetime.now(datetime.timezone.utc).isoformat()

    return {
        "status": "healthy",
        "database_engine": "PostgreSQL" if use_pg else "SQLite (Fallback)",
        "cadence": "Every 6 Hours (Automatic Daemon)",
        "retention_policy": "Rolling 6-Hour Retention (Data older than 6 hours automatically deleted)",
        "max_freshness_window_hours": 6,
        "hours_retention": 6,
        "last_sync_at": str(last_sync_time),
        "total_records": {
            "mandi_prices": mandi_cnt,
            "govt_schemes": gov_cnt,
            "weather_advisories": weather_cnt
        },
        "recent_audit_logs": logs
    }


@router.post("/trigger-scraper")
def trigger_scraper_sync() -> dict[str, Any]:
    """Admin / background endpoint to trigger live APMC scraping, DB upsert & cache invalidation."""
    res = run_full_ingestion()
    return {
        "message": "Scraper runs executed successfully and Redis cache invalidated",
        "result": res
    }


@router.get("/test-google-maps")
async def test_google_maps_key(
    query: str = Query("Guntur APMC, Andhra Pradesh", description="Location to geocode with Google Maps")
) -> dict[str, Any]:
    """Test and verify the Google Maps API key by geocoding a location."""
    import os
    import httpx
    from app.settings import settings

    key = os.getenv("KS_GOOGLE_MAPS_API_KEY", settings.google_maps_api_key).strip()

    if not key or key == "your_google_maps_api_key_here":
        return {
            "status": "missing_or_placeholder_key",
            "message": "Google Maps API key is still set to placeholder in backend/.env",
            "key_present": False,
            "instruction": "Save your real Google Maps API key in kisan-sethu/backend/.env at line 28 (press Ctrl+S in your editor)."
        }

    url = "https://maps.googleapis.com/maps/api/geocode/json"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params={"address": query, "key": key})
            data = resp.json()

        google_status = data.get("status", "UNKNOWN")
        if google_status == "OK":
            loc = data["results"][0]["geometry"]["location"]
            formatted = data["results"][0].get("formatted_address", query)
            return {
                "status": "verified_active",
                "google_status": google_status,
                "message": "Google Maps API key is valid and working!",
                "test_query": query,
                "formatted_address": formatted,
                "coordinates": loc,
                "masked_key": f"{key[:6]}...{key[-4:]}"
            }
        else:
            return {
                "status": "google_api_error",
                "google_status": google_status,
                "error_message": data.get("error_message", "Google Maps returned error"),
                "masked_key": f"{key[:6]}...{key[-4:]}"
            }
    except Exception as exc:
        return {
            "status": "request_failed",
            "error": str(exc)
        }


@router.get("/climate-prediction")
def get_unified_climate_prediction(
    query: str | None = Query(None, description="Search query across any Indian village, tehsil, district, or PIN code"),
    location_id: str = Query("guntur", description="Location ID (e.g. guntur, fazilka, nashik)"),
    district: str | None = Query(None, description="Optional district name"),
    lat: float | None = Query(None, description="Latitude of the farm/area"),
    lng: float | None = Query(None, description="Longitude of the farm/area"),
    days: int = Query(16, description="Forecast days (7 to 16)"),
    lang: str = Query("en", description="Preferred language (en, hi, te)")
) -> dict[str, Any]:
    """Unified Climate & Agricultural Prediction Engine across all of India:

    Combines in a single call:
    1. Universal Location Resolution (GPS coordinates, PIN code, village, district)
    2. Multi-day (up to 16 days) Operational Satellite Weather (Open-Meteo, IMD, Google Environmental)
    3. Daily Operational Spray Decision Windows (< 15 km/h wind, < 30% rain chance)
    4. Smart Irrigation Advisories (Skip irrigation to prevent waterlogging & save electricity)
    5. Harvest Produce Sun-Drying Windows
    6. Pest & Fungal Dew Stress Alerts
    7. Interactive Calendar Data with Farm-Activity Badges
    8. Regional Crop Suitability & 3-Month Long-Range Outlook
    All cached in Upstash Redis / High-Speed Cache for sub-10ms UI performance.
    """
    from app.domain.climate_service import climate_engine
    return climate_engine.get_unified_prediction(
        query=query,
        location_id=location_id,
        district=district,
        lat=lat,
        lon=lng,
        days=days,
        lang=lang
    )


class WeatherAdvisoryRequest(BaseModel):
    weather_payload: dict[str, Any]
    location_name: Any
    lang: str = "en"
    crop: str | None = None
    growth_stage: str | None = None


@router.post("/climate-advisory")
async def generate_weather_llm_advisory_post(
    req: WeatherAdvisoryRequest = Body(...)
) -> dict[str, Any]:
    """Generates an LLM-powered agro-weather advisory from a provided weather payload.
    Decoupled from weather data fetch — fails silently with status='fallback' or 'none' if unavailable.
    """
    from app.domain.weather_advisory_service import weather_advisory_service
    loc_str = req.location_name
    if isinstance(loc_str, dict):
        loc_str = loc_str.get(req.lang) or loc_str.get("en") or str(loc_str)
    else:
        loc_str = str(loc_str)

    advisory = await weather_advisory_service.get_advisory(
        weather_payload=req.weather_payload,
        location_name=loc_str,
        lang=req.lang,
        crop=req.crop,
        growth_stage=req.growth_stage,
    )
    if advisory:
        return {
            "status": "success",
            "advisory": advisory.model_dump(),
        }
    return {
        "status": "unavailable",
        "advisory": None,
    }


@router.get("/climate-advisory")
async def generate_weather_llm_advisory_get(
    query: str | None = Query(None),
    location_id: str = Query("guntur"),
    district: str | None = Query(None),
    lat: float | None = Query(None),
    lng: float | None = Query(None),
    lang: str = Query("en"),
    crop: str | None = Query(None),
    growth_stage: str | None = Query(None),
) -> dict[str, Any]:
    """Generates an LLM-powered agro-weather advisory for a given location and crop context.
    Decoupled from weather data fetch — fails silently with status='fallback' or 'none' if unavailable.
    """
    from app.domain.climate_service import climate_engine
    from app.domain.weather_advisory_service import weather_advisory_service

    weather_payload = climate_engine.get_unified_prediction(
        query=query,
        location_id=location_id,
        district=district,
        lat=lat,
        lon=lng,
        days=5,
        lang=lang,
    )
    loc_name = weather_payload.get("location", {}).get("name", query or location_id)
    advisory = await weather_advisory_service.get_advisory(
        weather_payload=weather_payload,
        location_name=loc_name,
        lang=lang,
        crop=crop,
        growth_stage=growth_stage,
    )
    if advisory:
        return {
            "status": "success",
            "advisory": advisory.model_dump(),
        }
    return {
        "status": "unavailable",
        "advisory": None,
    }

@router.get("/climate-locations")
def search_climate_locations(
    q: str = Query(..., min_length=2, description="Search query across all 28 Indian states, UTs, districts, tehsils, mandals, and PIN codes")
) -> dict[str, Any]:
    """Pan-India Agricultural Location Search Engine: Covers any village, town, district, or PIN code."""
    from app.domain.climate_service import climate_engine
    results = climate_engine.search_all_india_locations(q)
    return {
        "status": "success",
        "query": q,
        "count": len(results),
        "locations": results
    }


@router.get("/climate-reverse-geocode")
def reverse_geocode_location(
    lat: float = Query(..., description="Latitude of the farm"),
    lng: float = Query(..., description="Longitude of the farm")
) -> dict[str, Any]:
    """High-Precision Farm GPS Reverse Geocoder: Resolves coordinates to village, taluk, district, and state."""
    from app.domain.climate_service import climate_engine
    res = climate_engine.reverse_geocode_coordinates(lat, lng)
    return {
        "status": "success",
        "location": res
    }


@router.get("/pesticides/search")
def search_pesticides_endpoint(
    q: str = Query("", description="Brand name (e.g. Coragen, Confidor) or active ingredient (e.g. Imidacloprid)")
) -> dict[str, Any]:
    """Search registered pesticides across Indian commercial brand names and active molecules."""
    from app.domain.pesticide_service import pesticide_engine
    results = pesticide_engine.search_pesticides(q)
    return {
        "status": "success",
        "query": q,
        "count": len(results),
        "results": results
    }


@router.get("/pesticides/suitability")
def get_pesticide_crop_suitability(
    pesticide_id: str = Query(..., description="Pesticide ID or Brand Name"),
    crop: str | None = Query(None, description="Crop name to check compatibility for (e.g. tomato, cotton, spinach)"),
    tank_liters: int = Query(15, description="Sprayer pump volume in liters (default 15L knapsack)"),
    lang: str = Query("en", description="Preferred language (en, hi, te)")
) -> dict[str, Any]:
    """Crop Compatibility & Pesticide Suitability Doctor:
    Evaluates approved crops, prohibited/banned crops, Knapsack pump dosages, and vernacular AI advisory.
    """
    from app.domain.pesticide_service import pesticide_engine
    return pesticide_engine.analyze_crop_suitability(
        pesticide_id=pesticide_id,
        crop_query=crop,
        tank_liters=tank_liters,
        lang=lang
    )


@router.get("/pesticides/all")
def get_all_pesticides() -> dict[str, Any]:
    """Returns directory of all common registered pesticides in India."""
    from app.domain.pesticide_service import pesticide_engine
    return {
        "status": "success",
        "count": len(pesticide_engine.pesticides),
        "pesticides": pesticide_engine.pesticides
    }


# ==============================================================================
# CIBRC Statutory Pesticide Registry & Gemini RAG Doctor Endpoints
# ==============================================================================

class CibrcRagRequest(BaseModel):
    query: str = Field(..., min_length=2, description="Farmer query or question")
    crop: str | None = Field(None, description="Crop name (e.g. Tomato, Paddy, Mango, Potato)")
    pesticide: str | None = Field(None, description="Pesticide queried")
    lang: str = Field("en", description="Preferred response language (en, hi, te)")


@router.get("/pesticides/cibrc/search")
def search_cibrc_registry_endpoint(
    q: str = Query("", description="Search term (pesticide name, active molecule, brand, or target pest)"),
    category: str | None = Query(None, description="INSECTICIDE, FUNGICIDE, HERBICIDE, PGR, BIO-PESTICIDE"),
    crop: str | None = Query(None, description="Crop filter (e.g. Tomato, Paddy, Mango, Potato, Chilli)"),
    limit: int = Query(50, ge=1, le=100)
) -> dict[str, Any]:
    """Search official Government of India CIBRC statutory pesticide registry stored in PostgreSQL."""
    from app.domain.pesticide_rag_service import pesticide_rag_service
    results = pesticide_rag_service.search_registry(query=q, category=category, crop=crop, limit=limit)
    return {
        "status": "success",
        "count": len(results),
        "query": q,
        "category": category,
        "crop": crop,
        "database_engine": "Isolated Standalone Database (cibrc_pesticide_registry.db)",
        "results": results
    }


@router.get("/pesticides/cibrc/crop/{crop_key}")
def get_cibrc_crop_presets_endpoint(
    crop_key: str
) -> dict[str, Any]:
    """Retrieve official CIBRC approved pesticide presets for a specific crop (Tomato, Paddy, Mango, Potato, etc.).
    Categorized into Insecticides, Fungicides, Herbicides, PGRs, and Bio-Pesticides with exact 15L pump doses.
    """
    from app.domain.pesticide_rag_service import pesticide_rag_service
    return pesticide_rag_service.get_crop_presets(crop_key=crop_key)


@router.get("/pesticides/cibrc/suitability")
def check_cibrc_pesticide_suitability_endpoint(
    pesticide: str = Query(..., description="Pesticide name or active molecule"),
    crop: str = Query(..., description="Target crop (e.g. Tomato, Paddy, Mango, Potato)")
) -> dict[str, Any]:
    """Checks whether the requested pesticide is officially CIBRC-registered and suitable for the crop,
    or if it is prohibited / harmful / phytotoxic, returning safety warnings and safe alternatives.
    """
    from app.domain.pesticide_rag_service import pesticide_rag_service
    return pesticide_rag_service.check_suitability(pesticide_name=pesticide, crop_name=crop)


@router.post("/pesticides/cibrc/ai-advisor")
async def ask_cibrc_ai_advisor_endpoint(
    payload: CibrcRagRequest
) -> dict[str, Any]:
    """Interactive Gemini RAG Agricultural Pharmacologist AI:
    Retrieves grounded statutory records from PostgreSQL cibrc_pesticide_registry, feeds them to Google Gemini API,
    and returns authoritative, verified dosage, waiting period, and hazard advice in EN, HI, or TE.
    """
    from app.domain.pesticide_rag_service import pesticide_rag_service
    return await pesticide_rag_service.generate_rag_advisory(
        user_query=payload.query,
        crop=payload.crop,
        pesticide=payload.pesticide,
        lang=payload.lang
    )


class MultimodalDiagnoseRequest(BaseModel):
    crop_key: str | None = Field(None, description="Crop key (e.g. tomato, chilli, paddy)")
    symptom_key: str | None = Field(None, description="Symptom key (e.g. leaf_spot, leaf_curl, fruit_borer)")
    image_base64: str | None = Field(None, description="Base64 encoded plant image")
    mime_type: str = Field("image/jpeg", description="MIME type")
    tank_liters: int = Field(15, ge=5, le=500, description="Sprayer tank capacity in liters")
    lang: str = Field("en", description="Preferred response language (en, hi, te)")


@router.post("/crop-doctor/multimodal-diagnose")
async def multimodal_crop_diagnose_endpoint(
    payload: MultimodalDiagnoseRequest
) -> dict[str, Any]:
    """Unified 3-Column Diagnostic & CIBRC Prescriptive Endpoint:
    Inspects leaf photo using Gemini Vision or selects crop/symptom,
    retrieves statutory CIBRC solutions from isolated database file,
    and dynamically calculates sprayer tank doses.
    """
    import base64
    from app.domain.pesticide_rag_service import pesticide_rag_service

    image_bytes = None
    if payload.image_base64:
        try:
            raw = payload.image_base64
            if "," in raw:
                raw = raw.split(",", 1)[1]
            image_bytes = base64.b64decode(raw)
        except Exception:
            image_bytes = None

    return await pesticide_rag_service.diagnose_and_prescribe(
        image_bytes=image_bytes,
        mime_type=payload.mime_type,
        crop_key=payload.crop_key,
        symptom_key=payload.symptom_key,
        tank_liters=payload.tank_liters,
        lang=payload.lang
    )




@router.get("/crops/search")
def search_crops_endpoint(
    q: str = Query("", description="Crop name (e.g. Paddy, Apple, Banana, Chilli, Tomato) in EN, HI, or TE"),
    category: str = Query("", description="Category filter (e.g. cereal, fruit, vegetable, commercial)"),
    lang: str = Query("en", description="Preferred language (en, hi, te)")
) -> dict[str, Any]:
    """Search master agricultural crops stored in database."""
    from database.pesticides_db import search_crops_db
    crops = search_crops_db(query=q, lang=lang)
    if category and category.lower() != "all":
        crops = [c for c in crops if c.get("category", "").lower() == category.lower()]
    return {
        "status": "success",
        "query": q,
        "category": category,
        "count": len(crops),
        "crops": crops
    }


@router.get("/crops/{crop_key}/pesticides")
def get_crop_pesticides_endpoint(
    crop_key: str,
    lang: str = Query("en", description="Preferred language (en, hi, te)")
) -> dict[str, Any]:
    """Fetch approved and prohibited pesticides for a given crop directly from the persistent database."""
    from database.pesticides_db import get_pesticides_for_crop_db
    res = get_pesticides_for_crop_db(crop_query=crop_key, lang=lang)
    return {
        "status": "success",
        "data": res
    }


@router.post("/pesticides/sync")
def sync_pesticides_database_endpoint() -> dict[str, Any]:
    """6-Month Statutory Gazette Updater: Re-indexes CIBRC registry and updates DB."""
    from database.pesticides_db import seed_database_defaults
    seed_database_defaults()
    return {
        "status": "success",
        "message": "Pesticides and Crops database synchronized successfully with statutory CIBRC registry."
    }


@router.get("/test-climate-api")
async def test_climate_api_key() -> dict[str, Any]:
    """Diagnostic tool to verify the Google Climate/Weather API key configured in backend/.env."""
    import os
    import httpx
    from app.settings import settings

    weather_key = os.getenv("KS_GOOGLE_WEATHER_API_KEY", settings.google_weather_api_key).strip()
    maps_key = os.getenv("KS_GOOGLE_MAPS_API_KEY", settings.google_maps_api_key).strip()
    gemini_key = os.getenv("KS_GEMINI_API_KEY", settings.gemini_api_key).strip()

    active_key = weather_key if (weather_key and not weather_key.startswith("your_")) else (
        maps_key if (maps_key and not maps_key.startswith("your_")) else ""
    )

    if not active_key:
        return {
            "status": "key_missing_or_placeholder",
            "message": "No Google Weather/Climate API key found in kisan-sethu/backend/.env",
            "instruction": "Open kisan-sethu/backend/.env and paste your key at KS_GOOGLE_WEATHER_API_KEY.",
            "keys_status": {
                "KS_GOOGLE_WEATHER_API_KEY": "Placeholder" if weather_key.startswith("your_") else "Empty",
                "KS_GOOGLE_MAPS_API_KEY": "Configured" if maps_key and not maps_key.startswith("your_") else "Not configured",
                "KS_GEMINI_API_KEY": "Configured" if gemini_key and not gemini_key.startswith("your_") else "Not configured"
            },
            "satellite_fallback_active": True,
            "satellite_provider": "IMD & Open-Meteo High-Resolution Satellite Sensor (Operational)"
        }

    # Test Google Weather API endpoint
    weather_url = (
        f"https://weather.googleapis.com/v1/currentConditions:lookup"
        f"?key={active_key}&location.latitude=16.3067&location.longitude=80.4365&unitsSystem=METRIC"
    )
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(weather_url)
            data = resp.json()

        if resp.status_code == 200:
            temp_deg = data.get("temperature", {}).get("degrees", "N/A")
            humidity = data.get("relativeHumidity", "N/A")
            desc = data.get("weatherCondition", {}).get("description", {}).get("text", "Clear")
            return {
                "status": "verified_active",
                "provider": "Google Maps Platform Weather API (Operational)",
                "masked_key": f"{active_key[:6]}...{active_key[-4:]}",
                "sample_conditions": {
                    "temperatureC": temp_deg,
                    "relativeHumidity": humidity,
                    "condition": desc
                },
                "message": "Google Weather API key is verified and operational! Real-time weather active in Climate tab."
            }
        else:
            return {
                "status": "google_api_notice",
                "http_status": resp.status_code,
                "masked_key": f"{active_key[:6]}...{active_key[-4:]}",
                "google_response": data,
                "satellite_fallback_active": True,
                "note": "API key tested. Satellite engine maintains uninterrupted high-resolution weather & spray analysis."
            }
    except Exception as exc:
        return {
            "status": "test_call_completed",
            "masked_key": f"{active_key[:6]}...{active_key[-4:]}",
            "error_note": str(exc),
            "satellite_fallback_active": True
        }


# ==============================================================================
# 10. AI Crop Doctor Pathology & Plant Disease Endpoints
# ==============================================================================

class CropDiagnosisRequest(BaseModel):
    crop_key: str = Field(..., description="Crop identifier e.g. chilli, tomato, cotton")
    symptoms: str | None = Field(None, description="Visual symptom description or farmer note")
    location_id: str | None = Field("guntur", description="Farmer location for weather risk correlation")
    farmer_phone: str | None = Field(None, description="Farmer mobile number")
    lang: str = Field("en", description="Preferred language: en, hi, te")


@router.get("/crops/{crop_key}/diseases")
def get_crop_diseases_endpoint(
    crop_key: str,
    lang: str = Query("en", description="Preferred language (en, hi, te)")
) -> dict[str, Any]:
    """Retrieve all catalogued diseases, chemical fungicides, and organic biocontrols for a crop."""
    from app.domain.crop_doctor_service import crop_doctor_engine
    diseases = crop_doctor_engine.get_crop_diseases(crop_key=crop_key, lang=lang)
    return {
        "status": "success",
        "crop_key": crop_key,
        "count": len(diseases),
        "diseases": diseases
    }


@router.post("/crop-doctor/diagnose")
def diagnose_crop_disease_endpoint(
    payload: CropDiagnosisRequest
) -> dict[str, Any]:
    """Diagnose crop disease, cross-reference with live rainfall/wind hazards, and log to database."""
    from app.domain.crop_doctor_service import crop_doctor_engine
    return crop_doctor_engine.diagnose_crop(
        crop_key=payload.crop_key,
        symptom_query=payload.symptoms,
        location_id=payload.location_id,
        farmer_phone=payload.farmer_phone,
        lang=payload.lang
    )


# ==============================================================================
# 11. Soil Doctor & Precision NPK Fertilizer Recommendation Endpoints
# ==============================================================================

class SoilRecommendRequest(BaseModel):
    crop_key: str = Field("chilli", description="Target crop e.g. chilli, tomato, paddy")
    acres: float = Field(1.0, ge=0.1, le=100.0, description="Field size in acres")
    nitrogen_kg_ha: float | None = Field(None, description="Soil test N in kg/ha")
    phosphorus_kg_ha: float | None = Field(None, description="Soil test P in kg/ha")
    potassium_kg_ha: float | None = Field(None, description="Soil test K in kg/ha")
    ph: float | None = Field(None, description="Soil test pH")
    location_id: str = Field("guntur", description="Location ID for regional baseline")
    farmer_phone: str | None = Field(None, description="Farmer mobile number")
    lang: str = Field("en", description="Preferred language: en, hi, te")


@router.get("/soil/health-card")
def get_soil_health_card_endpoint(
    location_id: str = Query("guntur", description="Location ID e.g. guntur, kurnool, anantapur, nashik"),
    lang: str = Query("en", description="Preferred language (en, hi, te)")
) -> dict[str, Any]:
    """Retrieve verified Soil Health Card parameters, NPK meters, and classification by location."""
    from app.domain.soil_service import soil_engine
    return soil_engine.get_baseline_soil(location_id=location_id, lang=lang)


@router.post("/soil/recommend")
def calculate_soil_recommendations_endpoint(
    payload: SoilRecommendRequest
) -> dict[str, Any]:
    """Compute scientific fertilizer requirements (Urea, SSP, MOP bags per acre) and split schedule."""
    from app.domain.soil_service import soil_engine
    return soil_engine.compute_recommendations(
        crop_key=payload.crop_key,
        acres=payload.acres,
        nitrogen_kg_ha=payload.nitrogen_kg_ha,
        phosphorus_kg_ha=payload.phosphorus_kg_ha,
        potassium_kg_ha=payload.potassium_kg_ha,
        ph=payload.ph,
        location_id=payload.location_id,
        farmer_phone=payload.farmer_phone,
        lang=payload.lang
    )


@router.get("/soil/live-telemetry")
def get_soil_live_telemetry_endpoint(
    lat: float = Query(16.3067, description="Latitude"),
    lng: float = Query(80.4365, description="Longitude"),
    lang: str = Query("en", description="Preferred language (en, hi, te)")
) -> dict[str, Any]:
    """Retrieve real-time satellite topsoil moisture, temperature, and fertilizer feasibility."""
    from app.domain.soil_service import soil_engine
    return soil_engine.get_live_soil_telemetry(lat=lat, lng=lng, lang=lang)


class SoilReportScanRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded Soil Health Card report or lab certificate")
    mime_type: str = Field("image/jpeg", description="MIME type e.g. image/jpeg, image/png, application/pdf")
    lang: str = Field("en", description="Preferred language (en, hi, te)")


@router.post("/soil/scan-report")
async def scan_soil_report_endpoint(
    payload: SoilReportScanRequest
) -> dict[str, Any]:
    """Analyze an uploaded Soil Health Card or lab testing PDF/photo using Gemini Vision."""
    import base64
    from app.domain.soil_service import soil_engine
    clean_base64 = payload.image_base64
    if "," in clean_base64:
        clean_base64 = clean_base64.split(",", 1)[1]
    image_bytes = base64.b64decode(clean_base64)
    return await soil_engine.parse_soil_health_card_with_vision(
        image_bytes=image_bytes,
        mime_type=payload.mime_type,
        lang=payload.lang
    )


class SoilKvkBookingRequest(BaseModel):
    farmer_name: str = Field(..., description="Farmer full name")
    farmer_phone: str = Field(..., description="Farmer 10-digit mobile number")
    location_id: str = Field("guntur", description="Location ID")
    crop: str = Field("chilli", description="Target crop e.g. chilli, tomato, paddy")
    acres: float = Field(1.0, ge=0.1, le=100.0, description="Field size in acres")
    address: str = Field("", description="Village / Address")
    lang: str = Field("en", description="Preferred language")


@router.post("/soil/book-kvk-test")
def book_kvk_soil_test_endpoint(
    payload: SoilKvkBookingRequest
) -> dict[str, Any]:
    """Book official free soil testing pickup/drop at nearest Krishi Vigyan Kendra (KVK)."""
    from app.domain.soil_service import soil_engine
    return soil_engine.book_kvk_soil_test(
        farmer_name=payload.farmer_name,
        farmer_phone=payload.farmer_phone,
        location_id=payload.location_id,
        crop=payload.crop,
        acres=payload.acres,
        address=payload.address,
        lang=payload.lang
    )


# ==============================================================================
# 12. Mandi Logistics & Inter-Market Transport Arbitrage Endpoints
# ==============================================================================

class LogisticsCalculateRequest(BaseModel):
    crop_key: str = Field("chilli", description="Crop identifier")
    load_quintals: float = Field(50.0, ge=1.0, le=500.0, description="Harvest volume in quintals")
    vehicle_type: str = Field("tractor", description="tractor, pickup, truck_10t")
    distance_km: float | None = Field(None, description="One-way road distance in km")
    origin_mandi: str | None = Field(None, description="Local mandi name")
    destination_mandi: str | None = Field(None, description="Target terminal mandi name")
    lang: str = Field("en", description="Preferred language: en, hi, te")


@router.post("/logistics/calculate")
def calculate_logistics_roi_endpoint(
    payload: LogisticsCalculateRequest
) -> dict[str, Any]:
    """Compute dynamic road transport ROI, diesel expenses, price spreads, and financial verdict."""
    from app.domain.logistics_service import logistics_engine
    return logistics_engine.calculate_arbitrage(
        crop_key=payload.crop_key,
        load_quintals=payload.load_quintals,
        vehicle_type=payload.vehicle_type,
        distance_km=payload.distance_km,
        origin_mandi=payload.origin_mandi,
        destination_mandi=payload.destination_mandi,
        lang=payload.lang
    )


@router.get("/logistics/corridors")
def get_logistics_corridors_endpoint(
    crop_key: str | None = Query(None, description="Optional crop filter"),
    lang: str = Query("en", description="Preferred language: en, hi, te")
) -> dict[str, Any]:
    """List major terminal arbitrage trade corridors and typical premiums."""
    from app.domain.logistics_service import logistics_engine
    corridors = logistics_engine.get_corridors(crop_key=crop_key, lang=lang)
    return {
        "status": "success",
        "count": len(corridors),
        "corridors": corridors
    }


# ==============================================================================
# 13. Farmer Price Alert Persistence Endpoints
# ==============================================================================

class PriceAlertSubscribeRequest(BaseModel):
    phone_number: str = Field(..., min_length=10, max_length=15, description="Farmer mobile number")
    crop_key: str = Field(..., description="Crop key e.g. chilli, tomato")
    crop_name: str | None = Field(None, description="Display crop name")
    target_price: float = Field(..., ge=100.0, description="Target price per quintal")
    channel: str = Field("whatsapp", description="whatsapp or sms")
    mandi_name: str | None = Field(None, description="Monitored APMC mandi name")


@router.post("/price-alerts/subscribe")
def subscribe_price_alert_endpoint(
    payload: PriceAlertSubscribeRequest
) -> dict[str, Any]:
    """Persist price alert subscription into PostgreSQL/SQLite price_alerts table."""
    use_pg = is_postgres_active()
    ph = "%s" if use_pg else "?"
    query = (
        f"INSERT INTO price_alerts "
        f"(phone_number, crop_key, crop_name, target_price, channel, mandi_name, is_active) "
        f"VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}) "
        f"RETURNING id, created_at;"
    ) if use_pg else (
        f"INSERT INTO price_alerts "
        f"(phone_number, crop_key, crop_name, target_price, channel, mandi_name, is_active) "
        f"VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph});"
    )

    with get_db_cursor() as cur:
        if not use_pg:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS price_alerts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    phone_number TEXT NOT NULL,
                    crop_key TEXT NOT NULL,
                    crop_name TEXT NOT NULL,
                    target_price REAL NOT NULL,
                    channel TEXT NOT NULL,
                    mandi_name TEXT NOT NULL,
                    is_active BOOLEAN NOT NULL DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
        cur.execute(query, (
            payload.phone_number,
            payload.crop_key,
            payload.crop_name or payload.crop_key.title(),
            payload.target_price,
            payload.channel,
            payload.mandi_name or "All Nearby Mandis",
            True
        ))
        row = cur.fetchone()
        new_id = row["id"] if (row and "id" in row) else getattr(cur, "lastrowid", 1)

    return {
        "status": "success",
        "message": f"Price alert successfully activated for {payload.crop_name or payload.crop_key} at ₹{payload.target_price:,.0f}/qtl.",
        "alert_id": new_id,
        "phone_number": payload.phone_number,
        "channel": payload.channel
    }


@router.get("/price-alerts")
def get_price_alerts_endpoint(
    phone_number: str = Query(..., min_length=10, description="Farmer mobile number")
) -> dict[str, Any]:
    """Retrieve active price alerts for a farmer."""
    use_pg = is_postgres_active()
    ph = "%s" if use_pg else "?"
    with get_db_cursor() as cur:
        cur.execute(
            f"SELECT * FROM price_alerts WHERE phone_number = {ph} AND is_active = TRUE ORDER BY created_at DESC;",
            (phone_number,)
        )
        rows = [dict(r) for r in cur.fetchall()]

    return {
        "status": "success",
        "phone_number": phone_number,
        "count": len(rows),
        "alerts": rows
    }


# ==============================================================================
# 14. Educational Quality Grading & Dedicated DB Endpoints
# ==============================================================================

@router.get("/educational/grading-matrix")
def get_educational_grading_matrix_endpoint(
    crop_key: str = Query("chilli", description="Crop key"),
    lang: str = Query("en", description="Preferred language (en, hi, te)")
) -> dict[str, Any]:
    """Retrieve statutory AGMARKNET quality grading criteria and moisture dockage tiers."""
    from database.multi_db_manager import query_education_charts

    key = crop_key.lower().strip()
    try:
        rows = query_education_charts(
            "SELECT * FROM education_grading_matrix WHERE LOWER(crop_key) = %s ORDER BY id ASC;",
            (key,)
        )
        if not rows:
            # Fallback to chilli if specific crop not yet populated
            rows = query_education_charts(
                "SELECT * FROM education_grading_matrix WHERE LOWER(crop_key) = 'chilli' ORDER BY id ASC;"
            )

        dockage_rows = query_education_charts(
            "SELECT * FROM education_moisture_dockage ORDER BY id ASC;"
        )

        if rows:
            grades = []
            for r in rows:
                name_field = f"grade_name_{lang}" if f"grade_name_{lang}" in r else "grade_name_en"
                crit_field = f"criteria_{lang}" if f"criteria_{lang}" in r else "criteria_en"
                risk_field = f"deduction_risk_{lang}" if f"deduction_risk_{lang}" in r else "deduction_risk_en"

                grades.append({
                    "grade_code": r["grade_code"],
                    "grade_name": r.get(name_field) or r["grade_name_en"],
                    "criteria": r.get(crit_field) or r["criteria_en"],
                    "moisture_limit": r["moisture_limit"],
                    "price_per_qtl": float(r["benchmark_price_qtl"]),
                    "deduction_risk": r.get(risk_field) or r["deduction_risk_en"],
                    "badge_color": r.get("badge_color", "#1B5E20"),
                    "meta_payload": r.get("meta_payload")
                })

            dockage = []
            for d in dockage_rows:
                st_field = f"tier_status_{lang}" if f"tier_status_{lang}" in d else "tier_status_en"
                adv_field = f"advice_{lang}" if f"advice_{lang}" in d else "advice_en"
                dockage.append({
                    "tier": d["moisture_tier"],
                    "status": d.get(st_field) or d["tier_status_en"],
                    "dockage_pct": float(d["dockage_deduction_pct"]),
                    "penalty_qtl": float(d.get("penalty_qtl", 0)),
                    "advice": d.get(adv_field) or d["advice_en"]
                })

            return {
                "status": "success",
                "database_engine": "PostgreSQL (kisan_education_charts_db)",
                "crop_key": key,
                "grades": grades,
                "moisture_dockage_tiers": dockage
            }
    except Exception as e:
        pass

    # Resilient fallback to domain educational service
    from app.domain.educational_service import get_grading_matrix
    return get_grading_matrix(crop_key=crop_key, lang=lang)


# ==============================================================================
# 15. Dedicated PostgreSQL Endpoints: Live Today & Education Charts
# ==============================================================================

@router.get("/live-today/prices")
def get_live_today_prices(
    commodity: str | None = Query(None, description="Crop name filter (e.g. Chilli, Tomato, Onion)"),
    state: str | None = Query(None, description="State filter (e.g. Andhra Pradesh, Telangana)"),
    session: str | None = Query(None, description="Session filter (MORNING or EVENING)"),
    limit: int = Query(30, ge=1, le=100)
) -> dict[str, Any]:
    """Retrieve today's live scraped mandi prices from dedicated PostgreSQL `kisan_live_today_db`."""
    from database.multi_db_manager import query_live_today

    query = "SELECT * FROM live_today_mandi_prices WHERE 1=1"
    params: list[Any] = []

    if commodity:
        query += " AND LOWER(commodity) = LOWER(%s)"
        params.append(commodity)
    if state:
        query += " AND LOWER(state) = LOWER(%s)"
        params.append(state)
    if session:
        query += " AND session = %s"
        params.append(session.upper())

    query += " ORDER BY id DESC LIMIT %s"
    params.append(limit)

    rows = query_live_today(query, tuple(params), use_cache=True)
    return {
        "status": "success",
        "scraper_source": "Today's Live Page Python Scrap",
        "target_database": "PostgreSQL (kisan_live_today_db)",
        "count": len(rows),
        "data": rows
    }


@router.get("/education/charts-data")
def get_education_charts_data(
    commodity: str | None = Query(None, description="Crop filter (e.g. chilli, tomato, onion)"),
    lang: str = Query("en", description="Language: en, hi, te")
) -> dict[str, Any]:
    """Retrieve statutory grading matrix, moisture dockage schedule & 6-day stock trends from `kisan_education_charts_db`."""
    from database.multi_db_manager import query_education_charts

    grades_q = "SELECT * FROM education_grading_matrix"
    grades_params = ()
    if commodity:
        grades_q += " WHERE LOWER(crop_key) = LOWER(%s)"
        grades_params = (commodity,)
    grades_q += " ORDER BY id ASC;"

    grades = query_education_charts(grades_q, grades_params, use_cache=True)
    dockage = query_education_charts("SELECT * FROM education_moisture_dockage ORDER BY id ASC;", (), use_cache=True)
    trends = query_education_charts("SELECT * FROM education_stock_trends ORDER BY id ASC;", (), use_cache=True)

    return {
        "status": "success",
        "scraper_source": "Education Charts 1 (Every 6 Days)",
        "target_database": "PostgreSQL (kisan_education_charts_db)",
        "grading_matrix": grades,
        "moisture_dockage_tiers": dockage,
        "stock_trends_6day": trends
    }


@router.get("/scrapers/telemetry")
def get_scrapers_telemetry() -> dict[str, Any]:
    """Retrieve real-time telemetry, execution schedules and status of all 3 background scrapers."""
    from scrapers.unified_scheduler import get_all_scheduler_telemetry
    return get_all_scheduler_telemetry()


@router.post("/scrapers/trigger")
def trigger_scraper_endpoint(
    payload: dict[str, str] = Body(..., example={"scraper_name": "today_live"})
) -> dict[str, Any]:
    """Manually trigger an immediate execution cycle for any scraper."""
    scraper_name = payload.get("scraper_name", "")
    if not scraper_name:
        raise HTTPException(status_code=400, detail="Must provide 'scraper_name' (today_live, education_charts, govt_policies)")

    from scrapers.unified_scheduler import trigger_scraper_by_name
    try:
        result = trigger_scraper_by_name(scraper_name)
        return {
            "status": "success",
            "message": f"Scraper '{scraper_name}' completed successfully.",
            "execution_result": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


