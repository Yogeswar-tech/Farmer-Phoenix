"""Pydantic Models and Data Contracts for Kisan Sethu Database Entities."""

from datetime import date, datetime
from typing import Any, Optional
from pydantic import BaseModel, Field


class MandiPriceRecord(BaseModel):
    id: Optional[int] = None
    state: str
    district: str
    market: str
    commodity: str
    variety: str = "FAQ"
    grade: str = "Standard"
    arrival_date: str
    arrival_quintals: float = 0.0
    min_price_qtl: float
    max_price_qtl: float
    modal_price_qtl: float
    modal_price_kg: float
    source: str = "AGMARKNET_SCRAPER"
    raw_payload: dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None


class WeatherAdvisoryRecord(BaseModel):
    id: Optional[int] = None
    location_id: str
    location_name: str
    district: str
    state: str
    pincode: Optional[str] = None
    forecast_date: str
    temp_max_c: float
    temp_min_c: float
    rain_chance_pct: int = 0
    wind_speed_kmh: float = 10.0
    condition_text: str = "Sunny"
    risk_level: str = "safe"
    spray_status: str = "SAFE"
    spray_advice: Optional[str] = None
    drying_window: str = "Optimum 10 AM - 3 PM"
    radar_synced: bool = True
    source: str = "IMD_OPEN_METEO"
    radar_data: dict[str, Any] = Field(default_factory=dict)


class ColdStorageRecord(BaseModel):
    id: Optional[int] = None
    facility_id: str
    name: str
    district: str
    state: str
    latitude: float
    longitude: float
    capacity_mt: int = 5000
    available_mt: int = 1200
    monthly_rent_per_qtl: float = 120.0
    contact_phone: Optional[str] = None
    is_active: bool = True
    facility_meta: dict[str, Any] = Field(default_factory=dict)


class GovtSchemeRecord(BaseModel):
    id: Optional[int] = None
    scheme_id: str
    category: str  # LOAN, SUBSIDY, INSURANCE, POLICY, SOLAR
    title_en: str
    title_hi: str
    title_te: str
    benefit_amount: str
    interest_rate: Optional[str] = None
    max_limit: Optional[str] = None
    eligibility_en: str
    eligibility_hi: str
    eligibility_te: str
    short_desc_en: str
    short_desc_hi: str
    short_desc_te: str
    helpline: str
    apply_url: str
    source_portal: str = "myscheme.gov.in"
    raw_criteria: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True


class ScraperAuditLogRecord(BaseModel):
    id: Optional[int] = None
    source_name: str
    target_commodity: Optional[str] = None
    records_scraped: int = 0
    records_upserted: int = 0
    duration_seconds: float = 0.0
    status: str = "SUCCESS"
    error_message: Optional[str] = None
    execution_log: dict[str, Any] = Field(default_factory=dict)
