"""
Populates the isolated, standalone CIBRC pesticide database file:
`database/cibrc_pesticide_registry.db`

Ensures the module has an independent, unlinked database file for 100% strict grounding.
"""

import json
import sys
from pathlib import Path

CURRENT_FILE = Path(__file__).resolve()
BACKEND_DIR = CURRENT_FILE.parents[1]
PROJECT_ROOT = BACKEND_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.scripts.seed_cibrc_full_dataset import CIBRC_FULL_DATASET
from database.cibrc_isolated_db import (
    get_cibrc_cursor,
    get_cibrc_db_path,
    init_isolated_cibrc_db,
)


def seed_isolated_cibrc_db():
    print(f"[*] Initializing isolated CIBRC database file: {get_cibrc_db_path()}")
    init_isolated_cibrc_db()

    insert_sql = """
    INSERT INTO cibrc_pesticide_registry (
        category, pesticide_name, active_ingredient, formulation,
        crop, crop_key, target_pest_or_disease, ai_dose,
        formulation_dose, dilution_water_liters, waiting_period_days,
        pump_dose_15l, application_method, toxicity_band, toxicity_label,
        safety_warnings, is_approved, payload
    ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
    );
    """

    count = 0
    with get_cibrc_cursor() as cursor:
        cursor.execute("DELETE FROM cibrc_pesticide_registry;")

        for item in CIBRC_FULL_DATASET:
            payload_data = {
                "common_brands": item.get("common_brands", []),
                "pesticide_name": item["pesticide_name"],
                "active_ingredient": item["active_ingredient"],
                "formulation": item["formulation"],
                "crop": item["crop"],
                "target_pest_or_disease": item["target_pest_or_disease"],
                "waiting_period_days": item["waiting_period_days"],
                "pump_dose_15l": item["pump_dose_15l"]
            }
            payload_str = json.dumps(payload_data)

            params = (
                item["category"],
                item["pesticide_name"],
                item["active_ingredient"],
                item["formulation"],
                item["crop"],
                item["crop_key"],
                item["target_pest_or_disease"],
                item["ai_dose"],
                item["formulation_dose"],
                item["dilution_water_liters"],
                item["waiting_period_days"],
                item["pump_dose_15l"],
                item["application_method"],
                item["toxicity_band"],
                item["toxicity_label"],
                item["safety_warnings"],
                1,
                payload_str
            )
            cursor.execute(insert_sql, params)
            count += 1

    print(f"[+] Successfully seeded {count} records into isolated CIBRC database: {get_cibrc_db_path()}!")


if __name__ == "__main__":
    seed_isolated_cibrc_db()
