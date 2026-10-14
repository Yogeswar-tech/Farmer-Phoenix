"""Forwarding module for scrapers.scheduler (Backward compatibility)."""

import warnings
warnings.warn("database.scheduler has been moved to scrapers.scheduler", DeprecationWarning, stacklevel=2)

from scrapers.scheduler import run_forever

if __name__ == "__main__":
    run_forever()
