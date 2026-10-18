import os

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="KS_", env_file=".env", extra="ignore")

    env: str = "production"
    gemini_api_key: str = ""
    model_fast: str = "gemini-2.5-flash"
    model_strong: str = "gemini-2.5-pro"
    admin_api_key: str = ""
    allowed_origins: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000,http://127.0.0.1:8000"

    # Database (PostgreSQL 16+ Primary, fallback SQLite)
    database_url: str = ""
    cloud_sql_connection_name: str = ""  # KS_CLOUD_SQL_CONNECTION_NAME for Cloud Run Unix socket

    # Redis Cache Server
    redis_url: str = "redis://localhost:6379/0"
    redis_ttl_mandi: int = 900          # 15 minutes for live mandi arrivals
    redis_ttl_weather: int = 3600       # 1 hour for operational weather & spray advisories
    redis_ttl_storage: int = 21600      # 6 hours for cold storage facilities
    redis_ttl_schemes: int = 43200      # 12 hours for government loan & subsidy schemes

    # Location Services & Climate APIs
    google_maps_api_key: str = ""
    google_weather_api_key: str = ""

    # Ingestion & External APIs
    data_gov_api_key: str = ""
    data_gov_resource_id: str = "9ef84268-d588-465a-a308-a864a43d0070"
    google_sheets_spreadsheet_id: str = ""
    google_service_account_path: str = ""
    gcp_project_id: str = ""
    gcp_location: str = "asia-south1"
    embedding_model: str = "text-embedding-004"

    # RAG & Vector Store
    vector_store_type: str = "local"  # 'local', 'vertex', or 'bigquery'
    vector_store_path: str = "data/rag_docs/vector_store.json"
    bigquery_dataset: str = ""
    bigquery_table: str = ""
    vertex_index_id: str = ""
    vertex_endpoint_id: str = ""
    vertex_deployed_index_id: str = ""
    gcs_staging_bucket: str = ""

    @model_validator(mode="after")
    def validate_production_env(self) -> "Settings":
        # GitHub Actions and other CI systems set CI=true — skip strict validation there
        if os.getenv("CI"):
            return self
        has_db = bool(self.database_url or self.cloud_sql_connection_name)
        if self.env == "production" and (not self.admin_api_key or not has_db):
            raise ValueError(
                "CRITICAL: Missing KS_ADMIN_API_KEY or database config "
                "(set KS_DATABASE_URL or KS_CLOUD_SQL_CONNECTION_NAME) in production!"
            )
        return self


settings = Settings()

KS_ENV = settings.env
KS_ADMIN_API_KEY = settings.admin_api_key
KS_DATABASE_URL = settings.database_url
KS_GCP_PROJECT_ID = settings.gcp_project_id

