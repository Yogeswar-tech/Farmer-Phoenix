"""Configuration module alias for app.settings."""
from app.settings import (
    KS_ADMIN_API_KEY,
    KS_DATABASE_URL,
    KS_ENV,
    KS_GCP_PROJECT_ID,
    Settings,
    settings,
)

__all__ = [
    "Settings",
    "settings",
    "KS_ENV",
    "KS_ADMIN_API_KEY",
    "KS_DATABASE_URL",
    "KS_GCP_PROJECT_ID",
]
