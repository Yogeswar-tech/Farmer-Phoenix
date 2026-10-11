from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="KS_", env_file=".env", extra="ignore")

    env: str = "local"
    gemini_api_key: str = ""
    model_fast: str = ""      # set via env; verify current model names on Day 1
    model_strong: str = ""


settings = Settings()
