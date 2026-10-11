from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="KS_", env_file=".env", extra="ignore")

    env: str = "local"
    gemini_api_key: str = ""
    model_fast: str = "gemini-2.5-flash"
    model_strong: str = "gemini-2.5-pro"

    # Location Services
    google_maps_api_key: str = ""

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


settings = Settings()
