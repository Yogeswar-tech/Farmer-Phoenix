import sys
import json
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from scrapers.todays_live_page_scraper import MASTER_AGRICULTURAL_CATALOG

clean_catalog = []
for c in MASTER_AGRICULTURAL_CATALOG:
    clean_catalog.append({
        "commodity": c["commodity"],
        "crop_key": c.get("crop_key", c["commodity"].lower().replace(" ", "_")),
        "icon": c.get("icon", "🌱"),
        "aliases": c.get("aliases", []),
        "category": c.get("category", "General")
    })

out_file = PROJECT_ROOT / "scrapers" / "clean_catalog.json"
with open(out_file, "w", encoding="utf-8") as f:
    json.dump(clean_catalog, f, indent=2, ensure_ascii=False)

print(f"Exported {len(clean_catalog)} clean crops to {out_file}")
