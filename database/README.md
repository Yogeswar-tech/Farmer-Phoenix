# Kisan Sethu Database Architecture

This directory contains the database connection layer, schemas, migrations, and seeds for Kisan Sethu.

## 1. Directory Structure

```
kisan-sethu/database/
├── schema.sql           # Human-readable PostgreSQL 16+ DDL with JSONB & pgvector
├── seed.sql             # Production-grade seed data for Mandis, Storages & Policies
├── connection.py        # Resilient PostgreSQL connection pool + SQLite fallback
├── db.py                # Backward-compatible database query interface
├── models.py            # Typed Pydantic models for database contracts
├── archive/             # Archived raw legacy SQLite database files
│   ├── kisan_sethu_legacy.db
│   └── kisan_sethu_raw_dump.db
└── README.md            # Database architecture documentation
```

## 2. Why PostgreSQL for Unstructured Data in Kisan Sethu?

Kisan Sethu handles both highly structured tabular data (mandi arrival records, daily modal ₹/kg prices) and fast-evolving unstructured/semi-structured data:

1. **`JSONB` Column Support**:
   - `mandi_prices.raw_payload`: Stores dynamic scraper metadata, commodity moisture content, grading deductions, and arrival slip images.
   - `weather_advisories.radar_data`: Stores complex multi-hour radar reflectivity and humidity time-series.
   - `govt_policies_and_loans.raw_criteria`: Accommodates arbitrarily nested rule trees for loan eligibility, subsidies, and required land records.
2. **High-Speed GIN Indexing**:
   - PostgreSQL GIN (Generalized Inverted Index) indexes allow querying nested keys inside JSONB columns in `< 1ms` (e.g. `WHERE raw_payload @> '{"moisture_pct": 10.5}'`).
3. **`pgvector` AI Retrieval**:
   - Directly indexes vector embeddings (`vector(768)`) inside `rag_knowledge_chunks` for fast semantic similarity search in the AI Crop Doctor and multilingual farmer assistant.
4. **Trilingual Full-Text Search**:
   - Multi-language search capabilities across English, Hindi, and Telugu without separate search engines.

## 3. How to Initialize PostgreSQL

### Option A: Using Docker Compose (Recommended)
```bash
cd kisan-sethu/backend
docker compose up -d postgres redis
```

### Option B: Using psql CLI
```bash
createdb kisan_sethu
psql -d kisan_sethu -f database/schema.sql
psql -d kisan_sethu -f database/seed.sql
```

## 4. Environment Variables
Add to `kisan-sethu/backend/.env`:
```env
KS_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kisan_sethu
```
If PostgreSQL is offline or running locally without Docker, the connection manager automatically falls back to the embedded SQLite database at `database/archive/kisan_sethu_legacy.db` without crashing the application.
