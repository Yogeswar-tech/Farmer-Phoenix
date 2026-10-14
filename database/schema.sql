-- ==============================================================================
-- Kisan Sethu Production Database Schema (PostgreSQL 16+)
-- Supports: Relational Data + Unstructured JSONB Payloads + pgvector RAG Embeddings
-- ==============================================================================

-- Enable essential PostgreSQL extensions for unstructured & vector search
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- Enable pgvector for AI semantic similarity and multilingual Crop Doctor RAG
CREATE EXTENSION IF NOT EXISTS "vector";

-- ------------------------------------------------------------------------------
-- 1. Scraped Live Mandi Arrivals & Real-Time Prices
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mandi_prices (
    id BIGSERIAL PRIMARY KEY,
    state VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    market VARCHAR(150) NOT NULL,
    commodity VARCHAR(100) NOT NULL,
    variety VARCHAR(100) DEFAULT 'FAQ',
    grade VARCHAR(50) DEFAULT 'Standard',
    arrival_date DATE NOT NULL,
    arrival_quintals NUMERIC(12, 2) DEFAULT 0.00,
    min_price_qtl NUMERIC(10, 2) NOT NULL,
    max_price_qtl NUMERIC(10, 2) NOT NULL,
    modal_price_qtl NUMERIC(10, 2) NOT NULL,
    modal_price_kg NUMERIC(8, 2) NOT NULL,
    source VARCHAR(100) DEFAULT 'AGMARKNET_SCRAPER',
    -- Unstructured JSONB column for raw scraper payloads, moisture %, quality slips, custom tags
    raw_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Optimized composite B-Tree indexes for fast frontend queries
CREATE INDEX IF NOT EXISTS idx_mandi_commodity_date ON mandi_prices (commodity, arrival_date DESC);
CREATE INDEX IF NOT EXISTS idx_mandi_market_commodity ON mandi_prices (market, commodity);
CREATE INDEX IF NOT EXISTS idx_mandi_state_dist ON mandi_prices (state, district, commodity);

-- GIN Index on JSONB raw_payload for high-speed search inside unstructured JSON fields
CREATE INDEX IF NOT EXISTS idx_mandi_raw_payload_gin ON mandi_prices USING gin (raw_payload);

-- ------------------------------------------------------------------------------
-- 2. Historical Price Trends (180-Day Slicer & Forecasting)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS price_trends (
    id BIGSERIAL PRIMARY KEY,
    commodity VARCHAR(100) NOT NULL,
    market VARCHAR(150) NOT NULL,
    state VARCHAR(100) NOT NULL,
    record_date DATE NOT NULL,
    modal_price_qtl NUMERIC(10, 2) NOT NULL,
    modal_price_kg NUMERIC(8, 2) NOT NULL,
    trend_direction VARCHAR(20) DEFAULT 'STABLE', -- UP, DOWN, STABLE
    confidence_score NUMERIC(4, 2) DEFAULT 0.95,
    -- Unstructured JSONB payload for forecasting weights, moving averages, sentiment tags
    trend_meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trend_commodity_date ON price_trends (commodity, record_date DESC);

-- ------------------------------------------------------------------------------
-- 3. Weather Advisories, Spray Windows & Radar Sensor Feeds
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS weather_advisories (
    id BIGSERIAL PRIMARY KEY,
    location_id VARCHAR(50) NOT NULL,
    location_name VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(10),
    forecast_date DATE NOT NULL,
    temp_max_c NUMERIC(5, 1) NOT NULL,
    temp_min_c NUMERIC(5, 1) NOT NULL,
    rain_chance_pct INT DEFAULT 0,
    wind_speed_kmh NUMERIC(5, 1) DEFAULT 10.0,
    condition_text VARCHAR(100) DEFAULT 'Sunny',
    risk_level VARCHAR(20) DEFAULT 'safe',        -- safe, warning, danger
    spray_status VARCHAR(20) DEFAULT 'SAFE',      -- SAFE, CAUTION, PAUSED
    spray_advice TEXT,
    drying_window VARCHAR(100) DEFAULT 'Optimum 10 AM - 3 PM',
    radar_synced BOOLEAN DEFAULT TRUE,
    source VARCHAR(100) DEFAULT 'IMD_OPEN_METEO',
    -- Unstructured JSONB column for hourly humidity radar slices & rain accumulation
    radar_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_weather_loc_date ON weather_advisories (location_id, forecast_date ASC);
CREATE INDEX IF NOT EXISTS idx_weather_radar_gin ON weather_advisories USING gin (radar_data);

-- ------------------------------------------------------------------------------
-- 4. Cold Storage Facilities & Logistics Cost Mapping
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cold_storages (
    id BIGSERIAL PRIMARY KEY,
    facility_id VARCHAR(80) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    district VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    capacity_mt INT DEFAULT 5000,
    available_mt INT DEFAULT 1200,
    monthly_rent_per_qtl NUMERIC(8, 2) DEFAULT 120.00,
    contact_phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    -- Unstructured JSONB column for amenities (chillers, ripening chambers, subsidy tie-ups)
    facility_meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cold_storages_geo ON cold_storages (state, district);
CREATE INDEX IF NOT EXISTS idx_cold_storages_meta_gin ON cold_storages USING gin (facility_meta);

-- ------------------------------------------------------------------------------
-- 5. Government Policies, Concessional Loans (4% KCC) & Subsidies
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS govt_policies_and_loans (
    id BIGSERIAL PRIMARY KEY,
    scheme_id VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'LOAN', 'SUBSIDY', 'INSURANCE', 'POLICY', 'SOLAR'
    title_en TEXT NOT NULL,
    title_hi TEXT NOT NULL,
    title_te TEXT NOT NULL,
    benefit_amount TEXT NOT NULL,
    interest_rate TEXT,
    max_limit TEXT,
    eligibility_en TEXT NOT NULL,
    eligibility_hi TEXT NOT NULL,
    eligibility_te TEXT NOT NULL,
    short_desc_en TEXT NOT NULL,
    short_desc_hi TEXT NOT NULL,
    short_desc_te TEXT NOT NULL,
    helpline VARCHAR(100) NOT NULL,
    apply_url TEXT NOT NULL,
    source_portal VARCHAR(150) DEFAULT 'myscheme.gov.in / pmkisan.gov.in',
    scraped_date DATE DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT TRUE,
    -- Unstructured JSONB column for flexible scheme criteria, required documents & FAQs
    raw_criteria JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_policies_cat ON govt_policies_and_loans (category, is_active);
CREATE INDEX IF NOT EXISTS idx_policies_criteria_gin ON govt_policies_and_loans USING gin (raw_criteria);

-- ------------------------------------------------------------------------------
-- 6. AI Crop Doctor Diagnoses & Multimodal Plant Disease Logs
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crop_diagnoses (
    id BIGSERIAL PRIMARY KEY,
    farmer_phone VARCHAR(20),
    crop_name VARCHAR(100) NOT NULL,
    image_url TEXT,
    symptom_description TEXT,
    disease_detected VARCHAR(150),
    confidence_score NUMERIC(5, 4),
    recommended_treatment TEXT,
    recommended_fungicide TEXT,
    -- Unstructured JSONB column for AI tokens, full Gemini diagnostics & bounding boxes
    diagnosis_meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crop_diagnoses_crop ON crop_diagnoses (crop_name);

-- ------------------------------------------------------------------------------
-- 7. Soil Health Records & Lab Booking Directory
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS soil_health_records (
    id BIGSERIAL PRIMARY KEY,
    farmer_phone VARCHAR(20),
    location_id VARCHAR(50) NOT NULL,
    district VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    ph_level NUMERIC(4, 2),
    nitrogen_level VARCHAR(50),
    phosphorus_level VARCHAR(50),
    potassium_level VARCHAR(50),
    organic_carbon_pct NUMERIC(4, 2),
    recommended_fertilizer TEXT,
    -- Unstructured JSONB column for micronutrient analysis (Zinc, Boron, Sulphur, Iron)
    soil_report JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_soil_loc ON soil_health_records (location_id, district);

-- ------------------------------------------------------------------------------
-- 8. RAG Knowledge Chunks & Semantic Vector Embeddings
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rag_knowledge_chunks (
    id BIGSERIAL PRIMARY KEY,
    doc_id VARCHAR(100) NOT NULL,
    source_title VARCHAR(255) NOT NULL,
    chunk_index INT NOT NULL,
    chunk_text TEXT NOT NULL,
    language VARCHAR(10) DEFAULT 'en', -- en, hi, te
    -- Vector embedding (1536 dims for text-embedding-3 or 768 dims for Gemini)
    embedding vector(768),
    -- Unstructured JSONB column for chunk metadata, tags, citation URLs
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rag_doc_id ON rag_knowledge_chunks (doc_id);
CREATE INDEX IF NOT EXISTS idx_rag_metadata_gin ON rag_knowledge_chunks USING gin (metadata);

-- ------------------------------------------------------------------------------
-- 9. Scraper Audit Logs (Audit Trail for 6-Hour Scheduler)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scraper_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    source_name VARCHAR(100) NOT NULL,
    target_commodity VARCHAR(100),
    records_scraped INT DEFAULT 0,
    records_upserted INT DEFAULT 0,
    duration_seconds NUMERIC(8, 4) DEFAULT 0.0000,
    status VARCHAR(20) DEFAULT 'SUCCESS', -- SUCCESS, FAILED, WARNING
    error_message TEXT,
    -- Unstructured JSONB column for execution telemetry, HTTP status codes, headers
    execution_log JSONB DEFAULT '{}'::jsonb,
    executed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scraper_logs_date ON scraper_audit_logs (executed_at DESC);
