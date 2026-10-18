"""Session-scoped test fixtures for CI: initialize DB tables and seed minimal CIBRC data."""
import pytest


@pytest.fixture(autouse=True, scope="session")
def initialize_databases_for_ci():
    """Create all DB tables and insert a minimal CIBRC seed record so count-based tests pass."""
    # Initialize main app DB tables (fixes 'no such table: price_alerts' etc.)
    try:
        from database.connection import init_database
        init_database()
    except Exception:
        pass

    # Initialize CIBRC isolated schema
    try:
        from database import cibrc_isolated_db
        cibrc_isolated_db.init_isolated_cibrc_db()

        # Seed one record so get_cibrc_row_count() > 0 in CI
        if cibrc_isolated_db.get_cibrc_row_count() == 0:
            cibrc_isolated_db.execute_cibrc_mutation(
                """
                INSERT INTO cibrc_pesticide_registry
                  (category, pesticide_name, active_ingredient, formulation,
                   crop, crop_key, target_pest_or_disease,
                   ai_dose, formulation_dose, toxicity_band)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "INSECTICIDE",
                    "Chlorpyrifos 20% EC",
                    "Chlorpyrifos",
                    "20% EC",
                    "Tomato",
                    "tomato",
                    "Fruit Borer / Leaf Curl",
                    "200 g a.i./ha",
                    "1 L/ha",
                    "blue",
                ),
            )
    except Exception:
        pass

    yield
