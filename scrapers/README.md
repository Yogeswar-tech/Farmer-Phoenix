# Kisan Sethu Python Scraper Architecture

Dedicated module for automated web scrapers, data fetchers, and background ingestion pipelines.

## 1. Directory Structure

```
kisan-sethu/scrapers/
├── __init__.py           # Package exports
├── mandi_scraper.py      # Agmarknet & APMC daily market prices & arrival volume
├── govt_scraper.py       # myscheme.gov.in, pmkisan, NABARD 4% KCC loan scraper
├── weather_scraper.py    # Open-Meteo & IMD agricultural forecast & spray analyzer
├── ingester.py           # Unified ingestion pipeline: DB upsert + Redis cache invalidation
├── scheduler.py          # 6-hour cron scheduler background daemon
└── README.md             # Scraper documentation
```

## 2. Scraping Targets & Data Sources

| Scraper | Target Website / API | Data Extracted | Update Cadence |
| :--- | :--- | :--- | :--- |
| **`mandi_scraper.py`** | `agmarknet.gov.in` & `data.gov.in` | Modal ₹/kg, Min/Max ₹/qtl, variety, arrivals | Every 6 Hours |
| **`govt_scraper.py`** | `myscheme.gov.in`, `pmkisan.gov.in`, `nabard.org` | Concessional 4% crop loans, PM-Kisan, PM-KUSUM | Daily / 6 Hours |
| **`weather_scraper.py`**| `api.open-meteo.com` & `mausam.imd.gov.in` | 7-day spray windows, rain risk, drying windows | Every 3 Hours |

## 3. Running Scrapers

### Run Full Ingestion Once (Manual Trigger)
```bash
py scrapers/ingester.py
```

### Run 6-Hour Background Scheduler Daemon
```bash
py scrapers/scheduler.py
```

## 4. Integration with PostgreSQL & Redis
Whenever `ingester.py` runs:
1. It validates the schema using `database.connection`.
2. It upserts the fresh records into PostgreSQL tables (`mandi_prices`, `weather_advisories`, `govt_policies_and_loans`).
3. It captures unstructured attributes into `JSONB` columns (`raw_payload`, `radar_data`, `raw_criteria`).
4. It purges old cache keys in Redis (`mandi:*`, `weather:*`, `schemes:*`) so all frontend users instantly get fresh live rates.
5. It writes execution duration and status to `scraper_audit_logs`.
