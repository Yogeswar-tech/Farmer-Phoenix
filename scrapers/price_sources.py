"""Multi-Source APMC Mandi Price Ingestion & Validation Architecture.

Supports:
1. DataGovInSource: Official data.gov.in daily APMC price feeds (when KS_DATA_GOV_API_KEY is configured).
2. OpenMandiApiSource: Keyless fallback from open Mandi API with rate-limiting, retries, and in-run caching.

Strict Validation Rules:
- modal_price >= 50 and <= 500,000 per quintal.
- min_price <= modal_price <= max_price (when both min and max are provided).
- Arrival date must be parseable and not older than 7 days from UTC today.
- Rejections are tracked and logged with reason codes.
- NEVER returns synthetic or random prices in production.
"""

from __future__ import annotations

import os
import time
import json
import logging
import urllib.request
import urllib.error
import urllib.parse
from dataclasses import dataclass, field
from datetime import datetime, date, timezone, timedelta
from typing import Any, Protocol

logger = logging.getLogger("PriceSources")

# Default Tracked Crops and States
DEFAULT_TRACKED_CROPS = [
    "Tomato", "Onion", "Potato", "Red Chilli", "Brinjal",
    "Cabbage", "Cauliflower", "Okra", "Garlic", "Ginger",
    "Maize", "Paddy", "Cotton", "Groundnut", "Turmeric"
]

DEFAULT_TRACKED_STATES = [
    "Andhra Pradesh", "Telangana", "Karnataka", "Tamil Nadu", "Maharashtra"
]

# Map user-facing crop names to Agmarknet commodity strings used by Open Mandi API
COMMODITY_SEARCH_MAP: dict[str, list[str]] = {
    "Red Chilli": ["Dry Chillies", "Chilli Red"],
    "Okra": ["Bhindi(Ladies Finger)", "Bhindi"],
    "Ginger": ["Ginger(Green)", "Ginger(Dry)", "Ginger"],
    "Paddy": ["Rice", "Paddy(Dhan)(Common)", "Paddy(Dhan)"],
    "Groundnut": ["Groundnut", "Groundnut pods (raw)"],
}


@dataclass
class PriceRecord:
    market: str
    district: str
    state: str
    commodity: str
    variety: str
    grade: str
    arrival_date: str
    min_price_qtl: float
    max_price_qtl: float
    modal_price_qtl: float
    modal_price_kg: float
    arrival_quintals: float
    source: str
    fetched_at: str
    raw_payload: dict[str, Any] = field(default_factory=dict)


@dataclass
class ValidationStats:
    total_received: int = 0
    valid_count: int = 0
    rejected_count: int = 0
    rejections_by_reason: dict[str, int] = field(default_factory=dict)

    def record_reject(self, reason: str) -> None:
        self.rejected_count += 1
        self.rejections_by_reason[reason] = self.rejections_by_reason.get(reason, 0) + 1


def validate_price_record(raw: dict[str, Any], stats: ValidationStats, today_utc: date | None = None) -> PriceRecord | None:
    """Validates raw mandi price row according to strict data fidelity rules."""
    stats.total_received += 1
    today = today_utc or datetime.now(timezone.utc).date()

    # 1. Market and Commodity must be non-empty strings
    market = str(raw.get("market") or "").strip()
    commodity = str(raw.get("commodity") or "").strip()
    if not market or not commodity:
        stats.record_reject("REJECT_MISSING_MARKET_OR_COMMODITY")
        return None

    # 2. Parse and Validate Modal Price (50 <= modal <= 500,000)
    try:
        raw_modal = raw.get("modal_price") if "modal_price" in raw else raw.get("modal_price_qtl")
        modal_price = float(raw_modal)
    except (TypeError, ValueError):
        stats.record_reject("REJECT_INVALID_MODAL_PRICE")
        return None

    if modal_price < 50.0 or modal_price > 500000.0:
        stats.record_reject("REJECT_PRICE_OUT_OF_BOUNDS")
        return None

    # 3. Parse Min and Max Price if present
    try:
        raw_min = raw.get("min_price") if "min_price" in raw else raw.get("min_price_qtl")
        min_price = float(raw_min) if raw_min is not None else modal_price
    except (TypeError, ValueError):
        min_price = modal_price

    try:
        raw_max = raw.get("max_price") if "max_price" in raw else raw.get("max_price_qtl")
        max_price = float(raw_max) if raw_max is not None else modal_price
    except (TypeError, ValueError):
        max_price = modal_price

    # Validate min <= modal <= max
    if min_price > modal_price or modal_price > max_price:
        stats.record_reject("REJECT_MIN_MAX_INVERTED")
        return None

    # 4. Parse Arrival Date and verify not older than 7 days
    raw_date = raw.get("arrival_date") or raw.get("date")
    if not raw_date:
        stats.record_reject("REJECT_MISSING_DATE")
        return None

    try:
        # Accepts 'YYYY-MM-DD' or 'DD/MM/YYYY'
        date_str = str(raw_date).strip()
        if "/" in date_str:
            parsed_date = datetime.strptime(date_str, "%d/%m/%Y").date()
        else:
            parsed_date = datetime.strptime(date_str[:10], "%Y-%m-%d").date()
    except Exception:
        stats.record_reject("REJECT_UNPARSEABLE_DATE")
        return None

    # Check 7-day freshness limit
    age_days = (today - parsed_date).days
    if age_days < 0:
        # Small future skew (timezone differences within 1 day are tolerated)
        if age_days < -1:
            stats.record_reject("REJECT_FUTURE_DATE")
            return None
    elif age_days > 7:
        stats.record_reject("REJECT_STALE_DATE_OVER_7D")
        return None

    # 5. Arrival Quintals
    try:
        raw_arr = raw.get("arrival_quintals") or raw.get("arrival") or 0.0
        arrival_qtl = float(raw_arr)
    except (TypeError, ValueError):
        arrival_qtl = 0.0

    state = str(raw.get("state") or "India").strip()
    district = str(raw.get("district") or "Generic").strip()
    variety = str(raw.get("variety") or "FAQ").strip()
    grade = str(raw.get("grade") or "Standard").strip()
    source = str(raw.get("source") or "OPEN_MANDI_API").strip()
    fetched_at = str(raw.get("fetched_at") or datetime.now(timezone.utc).isoformat())

    stats.valid_count += 1
    return PriceRecord(
        market=market,
        district=district,
        state=state,
        commodity=commodity,
        variety=variety,
        grade=grade,
        arrival_date=parsed_date.isoformat(),
        min_price_qtl=round(min_price, 2),
        max_price_qtl=round(max_price, 2),
        modal_price_qtl=round(modal_price, 2),
        modal_price_kg=round(modal_price / 100.0, 2),
        arrival_quintals=round(arrival_qtl, 2),
        source=source,
        fetched_at=fetched_at,
        raw_payload=raw
    )


class RateLimiter:
    """Enforces shared rate limit: max 90 requests per 15 minutes (900 seconds)."""

    def __init__(self, max_requests: int = 90, window_seconds: int = 900) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.timestamps: list[float] = []

    def acquire(self) -> None:
        now = time.time()
        # Filter timestamps outside the rolling window
        self.timestamps = [t for t in self.timestamps if now - t < self.window_seconds]

        if len(self.timestamps) >= self.max_requests:
            oldest = self.timestamps[0]
            sleep_duration = (oldest + self.window_seconds) - now + 0.5
            if sleep_duration > 0:
                logger.info(
                    "Rate limit reached (%d reqs in %ds). Sleeping for %.1fs...",
                    len(self.timestamps), self.window_seconds, sleep_duration
                )
                time.sleep(sleep_duration)
                now = time.time()
                self.timestamps = [t for t in self.timestamps if now - t < self.window_seconds]

        self.timestamps.append(time.time())


class PriceSource(Protocol):
    """Protocol interface for APMC Mandi Price Sources."""
    name: str

    def fetch(self, commodity: str, state: str | None = None) -> list[PriceRecord]:
        """Fetch and validate price records for a commodity."""
        ...


class DataGovInSource:
    """Official data.gov.in APMC Daily Price Resource API.
    Used ONLY when KS_DATA_GOV_API_KEY and KS_DATA_GOV_RESOURCE_ID are provided.
    """
    name = "DATA_GOV_IN"

    def __init__(
        self,
        api_key: str | None = None,
        resource_id: str | None = None,
        stats: ValidationStats | None = None
    ) -> None:
        self.api_key = api_key or os.getenv("KS_DATA_GOV_API_KEY", "")
        self.resource_id = resource_id or os.getenv("KS_DATA_GOV_RESOURCE_ID", "9ef84268-d588-465a-a308-a864a43d0070")
        self.stats = stats or ValidationStats()

    def is_configured(self) -> bool:
        return bool(self.api_key and not self.api_key.startswith("your_") and "placeholder" not in self.api_key.lower())

    def fetch(self, commodity: str, state: str | None = None) -> list[PriceRecord]:
        if not self.is_configured():
            return []

        url = f"https://api.data.gov.in/resource/{self.resource_id}?api-key={self.api_key}&format=json&limit=100"
        if commodity:
            url += f"&filters[commodity]={urllib.parse.quote(commodity)}"
        if state:
            url += f"&filters[state]={urllib.parse.quote(state)}"

        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "KisanSethu-AgriScraper/1.0 (contact: admin@kisansethu.in)",
                "Accept": "application/json"
            }
        )
        try:
            with urllib.request.urlopen(req, timeout=10.0) as resp:
                if resp.status == 200:
                    payload = json.loads(resp.read().decode("utf-8"))
                    records = payload.get("records", [])
                    validated: list[PriceRecord] = []
                    for r in records:
                        r["source"] = "DATA_GOV_IN"
                        rec = validate_price_record(r, self.stats)
                        if rec:
                            validated.append(rec)
                    return validated
        except Exception as exc:
            logger.warning("DataGovInSource query failed for %s (%s): %s", commodity, state, exc)
            return []

        return []


class OpenMandiApiSource:
    """Keyless Open Mandi API (mandi-api.onrender.com).
    - Base URL from KS_OPEN_MANDI_API_BASE
    - Timeout: 10s
    - 2 Retries with backoff
    - Rate limit: max 90 requests per 15 minutes shared across run
    - Contact User-Agent
    - In-run raw response caching
    """
    name = "OPEN_MANDI_API"

    def __init__(
        self,
        base_url: str | None = None,
        rate_limiter: RateLimiter | None = None,
        stats: ValidationStats | None = None
    ) -> None:
        self.base_url = (
            base_url
            or os.getenv("KS_OPEN_MANDI_API_BASE")
            or "https://mandi-api.onrender.com/v1/prices"
        ).rstrip("/")
        self.rate_limiter = rate_limiter or RateLimiter(max_requests=90, window_seconds=900)
        self.stats = stats or ValidationStats()
        self._cache: dict[str, list[dict[str, Any]]] = {}

    def fetch(self, commodity: str, state: str | None = None) -> list[PriceRecord]:
        clean_comm = commodity.strip()
        search_terms = COMMODITY_SEARCH_MAP.get(clean_comm, [clean_comm])

        all_raw_rows: list[dict[str, Any]] = []

        for term in search_terms:
            cache_key = f"{term.lower()}|{state.lower() if state else ''}"
            if cache_key in self._cache:
                raw_rows = self._cache[cache_key]
            else:
                raw_rows = self._query_with_retry(term, state)
                self._cache[cache_key] = raw_rows

            all_raw_rows.extend(raw_rows)
            if all_raw_rows:
                break

        validated: list[PriceRecord] = []
        for r in all_raw_rows:
            # Map canonical commodity name back if it was an alias search
            r_copy = dict(r)
            r_copy["source"] = "OPEN_MANDI_API"
            # Normalize target commodity label for consistency
            if clean_comm in COMMODITY_SEARCH_MAP:
                r_copy["canonical_commodity"] = clean_comm
            rec = validate_price_record(r_copy, self.stats)
            if rec:
                validated.append(rec)

        return validated

    def _query_with_retry(self, term: str, state: str | None) -> list[dict[str, Any]]:
        url = f"{self.base_url}?commodity={urllib.parse.quote(term)}"
        if state:
            url += f"&state={urllib.parse.quote(state)}"

        for attempt in range(3):  # Initial + 2 retries
            self.rate_limiter.acquire()
            req = urllib.request.Request(
                url,
                headers={
                    "Accept": "application/json",
                    "User-Agent": "KisanSethu-PriceIngester/1.0 (contact: admin@kisansethu.in)"
                }
            )
            try:
                with urllib.request.urlopen(req, timeout=5.0) as resp:
                    if resp.status == 200:
                        payload = json.loads(resp.read().decode("utf-8"))
                        if payload.get("success") and isinstance(payload.get("data"), list):
                            return payload["data"]
                        return []
            except urllib.error.HTTPError as http_err:
                if http_err.code == 404:
                    # 404 indicates state or commodity not indexed in upstream DB (e.g. state not in supported list)
                    logger.debug("Open Mandi API returned 404 for %s (%s). No data.", term, state)
                    return []
                if http_err.code == 429:
                    wait_time = 2.0 ** (attempt + 1)
                    logger.warning("Open Mandi API rate-limited (429). Retrying in %.1fs...", wait_time)
                    time.sleep(wait_time)
                    continue
                logger.warning("Open Mandi API HTTP %d for %s (attempt %d/3): %s", http_err.code, term, attempt + 1, http_err)
            except Exception as exc:
                if attempt < 2:
                    wait_time = 1.0 * (attempt + 1)
                    logger.warning("Open Mandi API query failed (%s). Retrying in %.1fs...", exc, wait_time)
                    time.sleep(wait_time)
                else:
                    logger.warning("Open Mandi API query failed after 2 retries for %s: %s", term, exc)

        return []


class AgmarknetSource:
    """Agmarknet 2.0 API (api.agmarknet.gov.in/v1/).

    Uses RSA-PKCS1v15-encrypted password login to obtain a Bearer token.
    No API key purchase required — just a free account at agmarknet.gov.in.

    Configure via:
        KS_AGMARKNET_USERNAME  (email or mobile registered at agmarknet.gov.in)
        KS_AGMARKNET_PASSWORD  (plaintext; encrypted with embedded RSA key before send)
    """

    name = "AGMARKNET"
    API_BASE = "https://api.agmarknet.gov.in/v1"
    ORIGIN = "https://agmarknet.gov.in"

    # Agmarknet 2.0 RSA-2048 public key (embedded in JS bundle)
    _RSA_PEM = (
        "-----BEGIN PUBLIC KEY-----\n"
        "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAp19WAKQeaQRWZrPoL/S/\n"
        "1ScKAArO02n9A2ANcTsAq7jBCPfBx60lUWveuYF8f2g+S9//KH5jOVSXVXMBEfNM\n"
        "dWJRmPQaUORbISRYR0BurtEhC89SFdZzxqvYP/LAjAkWlh3uevIdIHAD9LmU+fxP\n"
        "lCjCD1vsgO0Q9I59vlmSYwvSWHEsLyjlfAO4CLAICNp9i1wwH2eS3+eXtmSqngRC\n"
        "M/AhzjVeUbEe+BQacwDdqlHVATM8tonHDkICnpzziQJCJ5/RVaBhMYQknU0dFGL2\n"
        "2tyXF+qZhn1IfMKwZ4HHuNU1Hb7Oes0Q753hNo3wM4cfV+ZIC0m+pJPZ12+zezBF\n"
        "wQIDAQAB\n"
        "-----END PUBLIC KEY-----"
    )

    # Commodity IDs in Agmarknet 2.0 DB
    _COMMODITY_IDS: dict[str, list[int]] = {
        "Red Chilli":   [113, 420],   # Dry Chillies, Bajji chilli
        "Cotton":       [15],
        "Tomato":       [65],
        "Onion":        [23],
        "Paddy":        [2, 343],     # Paddy(Common), Paddy(Basmati)
        "Maize":        [4],
        "Groundnut":    [10, 263],
        "Turmeric":     [35],
        "Banana":       [19],
    }

    # State IDs in Agmarknet 2.0 DB
    _STATE_IDS: dict[str, int] = {
        "Andhra Pradesh": 2,
        "Telangana": 32,
        "Karnataka": 10,
        "Maharashtra": 17,
    }

    def __init__(self, stats: ValidationStats | None = None) -> None:
        self.username = os.getenv("KS_AGMARKNET_USERNAME", "").strip()
        self.password = os.getenv("KS_AGMARKNET_PASSWORD", "").strip()
        self.stats = stats or ValidationStats()
        self._token: str | None = None
        self._token_expiry: float = 0.0

    def is_configured(self) -> bool:
        return bool(self.username and self.password)

    def _encrypt_password(self) -> str:
        """RSA-PKCS1v15 encrypt the password using Agmarknet's embedded public key."""
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import padding as asym_padding
        import base64
        pub_key = serialization.load_pem_public_key(self._RSA_PEM.encode())
        encrypted = pub_key.encrypt(self.password.encode(), asym_padding.PKCS1v15())
        return base64.b64encode(encrypted).decode()

    def _login(self) -> str | None:
        """Login and return a Bearer token; cached until expired."""
        if self._token and time.time() < self._token_expiry:
            return self._token
        try:
            enc_password = self._encrypt_password()
            req = urllib.request.Request(
                f"{self.API_BASE}/auth/login",
                data=json.dumps({"username": self.username, "password": enc_password}).encode(),
                headers={
                    "Content-Type": "application/json",
                    "Origin": self.ORIGIN,
                    "Referer": f"{self.ORIGIN}/",
                    "User-Agent": "KisanSethu-AgriScraper/1.0",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=10.0) as resp:
                payload = json.loads(resp.read().decode())
                token = (
                    payload.get("token")
                    or payload.get("access_token")
                    or (payload.get("data") or {}).get("token")
                    or (payload.get("data") or {}).get("access_token")
                )
                if token:
                    self._token = token
                    self._token_expiry = time.time() + 3600  # assume 1h
                    return token
            logger.warning("AgmarknetSource login: no token in response: %s", payload)
        except Exception as exc:
            logger.warning("AgmarknetSource login failed: %s", exc)
        return None

    def _fetch_prices(
        self,
        cmdt_id: int,
        state_id: int,
        commodity_name: str,
        token: str,
        from_date: str | None = None,
        to_date: str | None = None,
    ) -> list[dict[str, Any]]:
        today = date.today().isoformat()
        from_date = from_date or today
        to_date = to_date or today
        params = urllib.parse.urlencode({
            "cmdt_id": cmdt_id,
            "state_id": state_id,
            "from_date": from_date,
            "to_date": to_date,
        })
        url = f"{self.API_BASE}/prices-and-arrivals/commodity-market/daily-report-state?{params}"
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Origin": self.ORIGIN,
                "Referer": f"{self.ORIGIN}/",
                "User-Agent": "KisanSethu-AgriScraper/1.0",
                "Accept": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=10.0) as resp:
                payload = json.loads(resp.read().decode())
                rows = payload.get("data") or payload.get("records") or []
                if isinstance(rows, dict):
                    rows = rows.get("data") or rows.get("records") or []
                result = []
                for r in rows:
                    result.append({
                        "commodity": r.get("cmdt_name") or commodity_name,
                        "market": r.get("market_name") or r.get("mkt_name") or "",
                        "district": r.get("district_name") or r.get("dist_name") or "",
                        "state": r.get("state_name") or "",
                        "variety": r.get("variety") or "FAQ",
                        "grade": r.get("grade") or "Standard",
                        "arrival_date": str(r.get("arr_date") or r.get("date") or today)[:10],
                        "min_price": float(r.get("min_price") or r.get("min_rate") or 0),
                        "max_price": float(r.get("max_price") or r.get("max_rate") or 0),
                        "modal_price": float(r.get("modal_price") or r.get("modal_rate") or 0),
                        "arrival_quintals": float(r.get("arr_qty") or r.get("arrivals") or 0),
                        "source": "AGMARKNET",
                    })
                return result
        except Exception as exc:
            logger.debug("AgmarknetSource fetch error (%s/state=%s): %s", commodity_name, state_id, exc)
            return []

    def fetch(self, commodity: str, state: str | None = None) -> list[PriceRecord]:
        if not self.is_configured():
            return []
        token = self._login()
        if not token:
            return []

        cmdt_ids = self._COMMODITY_IDS.get(commodity, [])
        if not cmdt_ids:
            clean = commodity.strip().title()
            for k, v in self._COMMODITY_IDS.items():
                if k.lower() in clean.lower() or clean.lower() in k.lower():
                    cmdt_ids = v
                    break
        if not cmdt_ids:
            return []

        state_id = self._STATE_IDS.get(state or "", 0) if state else 0
        if not state_id:
            state_id = None

        records: list[PriceRecord] = []
        for cmdt_id in cmdt_ids:
            raw_rows = self._fetch_prices(cmdt_id, state_id or 0, commodity, token)
            for r in raw_rows:
                r["source"] = "AGMARKNET"
                rec = validate_price_record(r, self.stats)
                if rec:
                    records.append(rec)
            if records:
                break  # found data with first commodity ID, skip aliases

        return records


def get_tracked_crops() -> list[str]:
    """Retrieve list of crops to track, configurable via KS_TRACKED_CROPS."""
    raw = os.getenv("KS_TRACKED_CROPS")
    if raw:
        return [c.strip() for c in raw.split(",") if c.strip()]
    return list(DEFAULT_TRACKED_CROPS)


def get_tracked_states() -> list[str]:
    """Retrieve list of states to track, configurable via KS_TRACKED_STATES."""
    raw = os.getenv("KS_TRACKED_STATES")
    if raw:
        return [s.strip() for s in raw.split(",") if s.strip()]
    return list(DEFAULT_TRACKED_STATES)


def get_active_price_source(stats: ValidationStats | None = None) -> PriceSource:
    """Priority: DataGovInSource → AgmarknetSource → OpenMandiApiSource.
    NEVER falls back to sample or synthetic data.
    """
    datagov = DataGovInSource(stats=stats)
    if datagov.is_configured():
        logger.info("Using primary PriceSource: DataGovInSource (data.gov.in)")
        return datagov

    agmarknet = AgmarknetSource(stats=stats)
    if agmarknet.is_configured():
        logger.info("Using primary PriceSource: AgmarknetSource (agmarknet.gov.in)")
        return agmarknet

    logger.info("Using secondary PriceSource: OpenMandiApiSource (mandi-api.onrender.com)")
    return OpenMandiApiSource(stats=stats)

