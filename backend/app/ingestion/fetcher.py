"""Mandi price data fetcher supporting data.gov.in AGMARKNET API and local fallbacks."""

import datetime
import logging
from typing import Any

import httpx

from app.ingestion.models import MandiPriceRecord
from app.settings import settings

logger = logging.getLogger(__name__)

# Sample data for offline / fallback testing when API key is not yet configured
SAMPLE_MANDI_DATA: list[dict[str, Any]] = [
    # 1. Tomato
    {
        "state": "Tamil Nadu",
        "district": "Chennai",
        "market": "Koyambedu",
        "commodity": "Tomato",
        "variety": "Hybrid",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 2200.0,
        "max_price": 2800.0,
        "modal_price": 2500.0,
    },
    {
        "state": "Tamil Nadu",
        "district": "Dindigul",
        "market": "Oddanchatram",
        "commodity": "Tomato",
        "variety": "Local",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 1900.0,
        "max_price": 2400.0,
        "modal_price": 2150.0,
    },
    {
        "state": "Maharashtra",
        "district": "Pune",
        "market": "Pune APMC",
        "commodity": "Tomato",
        "variety": "Hybrid",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 2100.0,
        "max_price": 2700.0,
        "modal_price": 2400.0,
    },
    {
        "state": "Karnataka",
        "district": "Kolar",
        "market": "Kolar",
        "commodity": "Tomato",
        "variety": "Local",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 2000.0,
        "max_price": 2600.0,
        "modal_price": 2300.0,
    },
    # 2. Onion
    {
        "state": "Tamil Nadu",
        "district": "Chennai",
        "market": "Koyambedu",
        "commodity": "Onion",
        "variety": "Nasik",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 3200.0,
        "max_price": 3800.0,
        "modal_price": 3500.0,
    },
    {
        "state": "Maharashtra",
        "district": "Pune",
        "market": "Pune APMC",
        "commodity": "Onion",
        "variety": "Red",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 2800.0,
        "max_price": 3400.0,
        "modal_price": 3100.0,
    },
    {
        "state": "Maharashtra",
        "district": "Nashik",
        "market": "Lasalgaon",
        "commodity": "Onion",
        "variety": "Purna",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 2900.0,
        "max_price": 3500.0,
        "modal_price": 3200.0,
    },
    # 3. Potato
    {
        "state": "Tamil Nadu",
        "district": "Chennai",
        "market": "Koyambedu",
        "commodity": "Potato",
        "variety": "Jyoti",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 1800.0,
        "max_price": 2400.0,
        "modal_price": 2100.0,
    },
    {
        "state": "Maharashtra",
        "district": "Pune",
        "market": "Pune APMC",
        "commodity": "Potato",
        "variety": "Local",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 1700.0,
        "max_price": 2300.0,
        "modal_price": 2000.0,
    },
    # 4. Brinjal
    {
        "state": "Tamil Nadu",
        "district": "Chennai",
        "market": "Koyambedu",
        "commodity": "Brinjal",
        "variety": "Round",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 2500.0,
        "max_price": 3200.0,
        "modal_price": 2800.0,
    },
    {
        "state": "Maharashtra",
        "district": "Pune",
        "market": "Pune APMC",
        "commodity": "Brinjal",
        "variety": "Purple",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 2200.0,
        "max_price": 2900.0,
        "modal_price": 2600.0,
    },
    # 5. Green Chilli
    {
        "state": "Tamil Nadu",
        "district": "Chennai",
        "market": "Koyambedu",
        "commodity": "Chilli",
        "variety": "G-4",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 4500.0,
        "max_price": 5500.0,
        "modal_price": 5000.0,
    },
    {
        "state": "Maharashtra",
        "district": "Pune",
        "market": "Pune APMC",
        "commodity": "Chilli",
        "variety": "Jwala",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 4200.0,
        "max_price": 5200.0,
        "modal_price": 4700.0,
    },
    # 6. Cabbage
    {
        "state": "Tamil Nadu",
        "district": "Chennai",
        "market": "Koyambedu",
        "commodity": "Cabbage",
        "variety": "Local",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 1400.0,
        "max_price": 1900.0,
        "modal_price": 1650.0,
    },
    {
        "state": "Maharashtra",
        "district": "Pune",
        "market": "Pune APMC",
        "commodity": "Cabbage",
        "variety": "Green",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 1300.0,
        "max_price": 1800.0,
        "modal_price": 1550.0,
    },
    # 7. Cauliflower
    {
        "state": "Tamil Nadu",
        "district": "Chennai",
        "market": "Koyambedu",
        "commodity": "Cauliflower",
        "variety": "Snowball",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 2200.0,
        "max_price": 3000.0,
        "modal_price": 2600.0,
    },
    {
        "state": "Maharashtra",
        "district": "Pune",
        "market": "Pune APMC",
        "commodity": "Cauliflower",
        "variety": "White",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 2000.0,
        "max_price": 2800.0,
        "modal_price": 2400.0,
    },
    # 8. Carrot
    {
        "state": "Tamil Nadu",
        "district": "Chennai",
        "market": "Koyambedu",
        "commodity": "Carrot",
        "variety": "Ooty",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 3500.0,
        "max_price": 4500.0,
        "modal_price": 4000.0,
    },
    {
        "state": "Maharashtra",
        "district": "Pune",
        "market": "Pune APMC",
        "commodity": "Carrot",
        "variety": "Orange",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 3200.0,
        "max_price": 4200.0,
        "modal_price": 3700.0,
    },
    # 9. Garlic
    {
        "state": "Maharashtra",
        "district": "Pune",
        "market": "Pune APMC",
        "commodity": "Garlic",
        "variety": "Desi",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 12000.0,
        "max_price": 16000.0,
        "modal_price": 14000.0,
    },
    {
        "state": "Tamil Nadu",
        "district": "Chennai",
        "market": "Koyambedu",
        "commodity": "Garlic",
        "variety": "Ooty",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 13000.0,
        "max_price": 17000.0,
        "modal_price": 15000.0,
    },
    # 10. Ginger
    {
        "state": "Maharashtra",
        "district": "Pune",
        "market": "Pune APMC",
        "commodity": "Ginger",
        "variety": "Fresh",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 6000.0,
        "max_price": 8000.0,
        "modal_price": 7000.0,
    },
    {
        "state": "Tamil Nadu",
        "district": "Chennai",
        "market": "Koyambedu",
        "commodity": "Ginger",
        "variety": "Local",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 6500.0,
        "max_price": 8500.0,
        "modal_price": 7500.0,
    },
    # 11. Okra / Bhindi (Ladies Finger)
    {
        "state": "Tamil Nadu",
        "district": "Chennai",
        "market": "Koyambedu",
        "commodity": "Bhindi",
        "variety": "Local",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 2800.0,
        "max_price": 3600.0,
        "modal_price": 3200.0,
    },
    {
        "state": "Maharashtra",
        "district": "Pune",
        "market": "Pune APMC",
        "commodity": "Bhindi",
        "variety": "Green",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 2600.0,
        "max_price": 3400.0,
        "modal_price": 3000.0,
    },
    # 12. Green Peas (Matar)
    {
        "state": "Maharashtra",
        "district": "Pune",
        "market": "Pune APMC",
        "commodity": "Matar",
        "variety": "Fresh",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 4000.0,
        "max_price": 5200.0,
        "modal_price": 4600.0,
    },
    {
        "state": "Tamil Nadu",
        "district": "Chennai",
        "market": "Koyambedu",
        "commodity": "Matar",
        "variety": "Ooty",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 4200.0,
        "max_price": 5500.0,
        "modal_price": 4800.0,
    },
    # 13. Capsicum (Shimla Mirch)
    {
        "state": "Tamil Nadu",
        "district": "Chennai",
        "market": "Koyambedu",
        "commodity": "Capsicum",
        "variety": "Green",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 3500.0,
        "max_price": 4800.0,
        "modal_price": 4100.0,
    },
    {
        "state": "Maharashtra",
        "district": "Pune",
        "market": "Pune APMC",
        "commodity": "Capsicum",
        "variety": "Local",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 3300.0,
        "max_price": 4500.0,
        "modal_price": 3900.0,
    },
    # 14. Cucumber
    {
        "state": "Tamil Nadu",
        "district": "Chennai",
        "market": "Koyambedu",
        "commodity": "Cucumber",
        "variety": "Desi",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 1600.0,
        "max_price": 2400.0,
        "modal_price": 2000.0,
    },
    {
        "state": "Maharashtra",
        "district": "Pune",
        "market": "Pune APMC",
        "commodity": "Cucumber",
        "variety": "Green",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 1500.0,
        "max_price": 2200.0,
        "modal_price": 1850.0,
    },
    # 15. Bottle Gourd (Lauki)
    {
        "state": "Maharashtra",
        "district": "Pune",
        "market": "Pune APMC",
        "commodity": "Bottle Gourd",
        "variety": "Long",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 1200.0,
        "max_price": 1800.0,
        "modal_price": 1500.0,
    },
    {
        "state": "Tamil Nadu",
        "district": "Chennai",
        "market": "Koyambedu",
        "commodity": "Bottle Gourd",
        "variety": "Local",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 1300.0,
        "max_price": 1900.0,
        "modal_price": 1600.0,
    },
    # 16. Bitter Gourd (Karela)
    {
        "state": "Tamil Nadu",
        "district": "Chennai",
        "market": "Koyambedu",
        "commodity": "Bitter Gourd",
        "variety": "Small",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 3000.0,
        "max_price": 4000.0,
        "modal_price": 3500.0,
    },
    {
        "state": "Maharashtra",
        "district": "Pune",
        "market": "Pune APMC",
        "commodity": "Bitter Gourd",
        "variety": "Green",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 2800.0,
        "max_price": 3800.0,
        "modal_price": 3300.0,
    },
    # 17. Spinach (Palak)
    {
        "state": "Maharashtra",
        "district": "Pune",
        "market": "Pune APMC",
        "commodity": "Palak",
        "variety": "Desi",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 1000.0,
        "max_price": 1600.0,
        "modal_price": 1300.0,
    },
    {
        "state": "Tamil Nadu",
        "district": "Chennai",
        "market": "Koyambedu",
        "commodity": "Palak",
        "variety": "Local",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 1100.0,
        "max_price": 1700.0,
        "modal_price": 1400.0,
    },
    # 18. Lemon
    {
        "state": "Maharashtra",
        "district": "Pune",
        "market": "Pune APMC",
        "commodity": "Lemon",
        "variety": "Yellow",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 5000.0,
        "max_price": 7000.0,
        "modal_price": 6000.0,
    },
    {
        "state": "Tamil Nadu",
        "district": "Chennai",
        "market": "Koyambedu",
        "commodity": "Lemon",
        "variety": "Kagzi",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 5200.0,
        "max_price": 7200.0,
        "modal_price": 6200.0,
    },
    # 19. Coriander
    {
        "state": "Maharashtra",
        "district": "Pune",
        "market": "Pune APMC",
        "commodity": "Coriander",
        "variety": "Local",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 2500.0,
        "max_price": 3800.0,
        "modal_price": 3100.0,
    },
    {
        "state": "Tamil Nadu",
        "district": "Chennai",
        "market": "Koyambedu",
        "commodity": "Coriander",
        "variety": "Fresh",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 2600.0,
        "max_price": 4000.0,
        "modal_price": 3300.0,
    },
    # 20. Beetroot
    {
        "state": "Tamil Nadu",
        "district": "Chennai",
        "market": "Koyambedu",
        "commodity": "Beetroot",
        "variety": "Ooty",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 2400.0,
        "max_price": 3400.0,
        "modal_price": 2900.0,
    },
    {
        "state": "Maharashtra",
        "district": "Pune",
        "market": "Pune APMC",
        "commodity": "Beetroot",
        "variety": "Local",
        "arrival_date": datetime.date.today().isoformat(),
        "min_price": 2200.0,
        "max_price": 3200.0,
        "modal_price": 2700.0,
    },
]


def normalize_record(raw: dict[str, Any]) -> MandiPriceRecord:
    """Normalize fields from data.gov.in (or community API) into MandiPriceRecord.

    data.gov.in uses varying casing (e.g. 'State' vs 'state', 'Modal_Price' vs 'modal_price').
    """
    clean_keys = {str(k).strip().lower().replace(" ", "_"): v for k, v in raw.items()}

    def get_val(*keys: str, default: Any = "") -> Any:
        for k in keys:
            if k in clean_keys and clean_keys[k] is not None:
                return clean_keys[k]
        return default

    def to_float(val: Any) -> float:
        try:
            if isinstance(val, (int, float)):
                return float(val)
            cleaned = str(val).replace(",", "").strip()
            return float(cleaned) if cleaned else 0.0
        except (ValueError, TypeError):
            return 0.0

    commodity = str(get_val("commodity", "commodity_name", default="Vegetable")).strip().title()
    variety = str(get_val("variety", default="Other")).strip().title()
    market = str(get_val("market", "market_name", default="Mandi")).strip().title()
    district = str(get_val("district", default="Unknown")).strip().title()
    state = str(get_val("state", default="Unknown")).strip().title()

    arrival_raw = str(get_val("arrival_date", "date", default=datetime.date.today().isoformat()))
    # Handle dates like '11/10/2026' or '2026-10-11'
    arrival_date = arrival_raw.strip()
    if "/" in arrival_date:
        parts = arrival_date.split("/")
        if len(parts) == 3:
            # DD/MM/YYYY -> YYYY-MM-DD
            arrival_date = f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"

    min_p = to_float(get_val("min_price", "min"))
    max_p = to_float(get_val("max_price", "max"))
    modal_p = to_float(get_val("modal_price", "modal"))

    # If modal price is 0, estimate from min and max if available
    if modal_p == 0.0 and (min_p > 0 or max_p > 0):
        modal_p = (min_p + max_p) / 2 if (min_p > 0 and max_p > 0) else max(min_p, max_p)

    return MandiPriceRecord(
        commodity=commodity,
        variety=variety,
        market=market,
        district=district,
        state=state,
        min_price=min_p,
        max_price=max_p,
        modal_price=modal_p,
        arrival_date=arrival_date,
        source="data.gov.in (AGMARKNET)",
    )


class AgmarknetFetcher:
    """Fetches daily wholesale vegetable and crop prices from AGMARKNET via data.gov.in."""

    def __init__(
        self,
        api_key: str | None = None,
        resource_id: str | None = None,
    ) -> None:
        self.api_key = api_key if api_key is not None else settings.data_gov_api_key
        self.resource_id = resource_id or settings.data_gov_resource_id
        self.base_url = f"https://api.data.gov.in/resource/{self.resource_id}"

    async def fetch_prices(
        self,
        state: str | None = None,
        commodity: str | None = None,
        limit: int = 100,
        offset: int = 0,
        fallback_to_sample: bool = True,
    ) -> list[MandiPriceRecord]:
        """Fetch prices from data.gov.in API with query parameters."""
        if not self.api_key:
            logger.warning("No data.gov.in API key configured (KS_DATA_GOV_API_KEY).")
            if fallback_to_sample:
                logger.info("Using sample mock mandi data for local testing.")
                return self._get_sample_records(state=state, commodity=commodity)
            return []

        params: dict[str, str | int] = {
            "api-key": self.api_key,
            "format": "json",
            "offset": offset,
            "limit": limit,
        }
        if state:
            params["filters[state]"] = state
        if commodity:
            params["filters[commodity]"] = commodity

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(self.base_url, params=params)
                response.raise_for_status()
                data = response.json()

            records_raw = data.get("records", [])
            results = [normalize_record(r) for r in records_raw]
            logger.info("Successfully fetched %d records from AGMARKNET API", len(results))
            return results

        except Exception as exc:
            logger.error("Failed to fetch from data.gov.in: %s", exc)
            if fallback_to_sample:
                logger.info("Falling back to sample mock mandi data.")
                return self._get_sample_records(state=state, commodity=commodity)
            raise

    def _get_sample_records(
        self,
        state: str | None = None,
        commodity: str | None = None,
    ) -> list[MandiPriceRecord]:
        """Filter and return static sample records for offline development."""
        records = [normalize_record(r) for r in SAMPLE_MANDI_DATA]
        if state:
            records = [r for r in records if r.state.lower() == state.lower()]
        if commodity:
            records = [r for r in records if r.commodity.lower() == commodity.lower()]
        return records

    @classmethod
    def load_from_local_dump(
        cls,
        file_path: str,
        state: str | None = None,
        commodity: str | None = None,
        limit: int | None = None,
    ) -> list[MandiPriceRecord]:
        """Load records from a local historical CSV or JSON dump for fast backfilling."""
        import csv
        import json
        from pathlib import Path

        path = Path(file_path)
        if not path.exists():
            logger.warning("Local dump file %s does not exist", file_path)
            return []

        raw_records: list[dict[str, Any]] = []
        if path.suffix.lower() == ".csv":
            with open(path, encoding="utf-8", errors="replace") as f:
                reader = csv.DictReader(f)
                raw_records = list(reader)
        elif path.suffix.lower() == ".json":
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    raw_records = data
                elif isinstance(data, dict) and "records" in data:
                    raw_records = data["records"]
        else:
            logger.error("Unsupported dump format for %s (must be .csv or .json)", file_path)
            return []

        results: list[MandiPriceRecord] = []
        for r in raw_records:
            rec = normalize_record(r)
            if state and rec.state.lower() != state.lower():
                continue
            if commodity and rec.commodity.lower() != commodity.lower():
                continue
            results.append(rec)
            if limit and len(results) >= limit:
                break

        logger.info("Loaded %d records from local dump %s", len(results), file_path)
        return results
