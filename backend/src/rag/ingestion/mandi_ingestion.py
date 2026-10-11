"""Forwarding module for src.rag.ingestion.mandi_ingestion CLI."""

import sys
from pathlib import Path

# Add backend directory to sys.path so app imports work seamlessly
backend_dir = Path(__file__).resolve().parents[3]
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.ingestion.mandi_ingestion import main  # noqa: E402

if __name__ == "__main__":
    main()
