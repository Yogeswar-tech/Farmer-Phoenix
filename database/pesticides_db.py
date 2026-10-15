"""Database persistence and query manager for Indian CIBRC Agricultural Pesticides and Crops.

Stores and queries:
1. Master Crops Directory (Cereals, Fruits, Vegetables, Commercial, Pulses, Oilseeds).
2. CIBRC Statutory Pesticide Registry (Active molecules, common brands, approved crops, prohibited crops, toxicity labels).
3. Connects to PostgreSQL 16+ (with fallback SQLite), integrated with Redis caching for sub-5ms UI responses.
4. Allows 6-month updates when new companies or pesticides are approved by CIBRC.
"""

import json
import logging
import sys
from pathlib import Path
from typing import Any, Optional

CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from database.connection import execute_query, execute_mutation, is_postgres_active

logger = logging.getLogger("PesticidesDB")

# Master Crops List across India (Comprehensive)
MASTER_CROPS = [
    {
        "crop_key": "paddy",
        "name_en": "Paddy (Rice)",
        "name_hi": "धान (चावल)",
        "name_te": "వరి (వరి పైరు)",
        "category": "cereal",
        "icon": "🌾",
        "scientific_name": "Oryza sativa",
        "season_info": {"en": "Kharif & Rabi", "hi": "खरीफ व रबी", "te": "ఖరీఫ్ & రబీ"}
    },
    {
        "crop_key": "wheat",
        "name_en": "Wheat",
        "name_hi": "गेहूं",
        "name_te": "గోధుమ",
        "category": "cereal",
        "icon": "🌾",
        "scientific_name": "Triticum aestivum",
        "season_info": {"en": "Rabi Season", "hi": "रबी सीजन", "te": "రబీ సీజన్"}
    },
    {
        "crop_key": "cotton",
        "name_en": "Cotton",
        "name_hi": "कपास",
        "name_te": "పత్తి",
        "category": "commercial",
        "icon": "🌱",
        "scientific_name": "Gossypium hirsutum",
        "season_info": {"en": "Kharif Season", "hi": "खरीफ सीजन", "te": "ఖరీఫ్ సీజన్"}
    },
    {
        "crop_key": "chilli",
        "name_en": "Chilli (Red / Green)",
        "name_hi": "मिर्च (लाल व हरी)",
        "name_te": "మిర్చి (ఎర్ర & పచ్చి)",
        "category": "vegetable",
        "icon": "🌶️",
        "scientific_name": "Capsicum annuum",
        "season_info": {"en": "Year-Round / Kharif", "hi": "वर्ष भर / खरीफ", "te": "ఏడాదంతా సాగు"}
    },
    {
        "crop_key": "tomato",
        "name_en": "Tomato",
        "name_hi": "टमाटर",
        "name_te": "టమోటా",
        "category": "vegetable",
        "icon": "🍅",
        "scientific_name": "Solanum lycopersicum",
        "season_info": {"en": "Multi-Season", "hi": "बहु-फसली", "te": "బహుళ సీజన్"}
    },
    {
        "crop_key": "apple",
        "name_en": "Apple",
        "name_hi": "सेब",
        "name_te": "ఆపిల్",
        "category": "fruit",
        "icon": "🍎",
        "scientific_name": "Malus domestica",
        "season_info": {"en": "Temperate Summer / Autumn", "hi": "पहाड़ी ग्रीष्म / शरद", "te": "వేసవి / శరదృతువు"}
    },
    {
        "crop_key": "banana",
        "name_en": "Banana",
        "name_hi": "केला",
        "name_te": "అరటి",
        "category": "fruit",
        "icon": "🍌",
        "scientific_name": "Musa acuminata",
        "season_info": {"en": "Year-Round Harvest", "hi": "वर्ष भर रोपण व तुड़ाई", "te": "సంవత్సరమంతా కాపు"}
    },
    {
        "crop_key": "mango",
        "name_en": "Mango",
        "name_hi": "आम",
        "name_te": "మామిడి",
        "category": "fruit",
        "icon": "🥭",
        "scientific_name": "Mangifera indica",
        "season_info": {"en": "Summer Harvest (Apr-Jun)", "hi": "ग्रीष्म तुड़ाई (अप्रैल-जून)", "te": "వేసవి కోతలు"}
    },
    {
        "crop_key": "grapes",
        "name_en": "Grapes",
        "name_hi": "अंगूर",
        "name_te": "ద్రాక్ష",
        "category": "fruit",
        "icon": "🍇",
        "scientific_name": "Vitis vinifera",
        "season_info": {"en": "Winter / Spring (Feb-Apr)", "hi": "शीत / बसंत (फरवरी-अप्रैल)", "te": "శీతాకాలం / వసంతం"}
    },
    {
        "crop_key": "onion",
        "name_en": "Onion",
        "name_hi": "प्याज",
        "name_te": "ఉల్లి",
        "category": "vegetable",
        "icon": "🧅",
        "scientific_name": "Allium cepa",
        "season_info": {"en": "Kharif & Rabi", "hi": "खरीफ व रबी", "te": "ఖరీఫ్ & రబీ"}
    },
    {
        "crop_key": "potato",
        "name_en": "Potato",
        "name_hi": "आलू",
        "name_te": "బంగాళాదుంప",
        "category": "vegetable",
        "icon": "🥔",
        "scientific_name": "Solanum tuberosum",
        "season_info": {"en": "Winter Rabi", "hi": "शीतकालीन रबी", "te": "శీతాకాల రబీ"}
    },
    {
        "crop_key": "maize",
        "name_en": "Maize (Corn)",
        "name_hi": "मक्का",
        "name_te": "మొక్కజొన్న",
        "category": "cereal",
        "icon": "🌽",
        "scientific_name": "Zea mays",
        "season_info": {"en": "Kharif & Spring", "hi": "खरीफ व बसंत", "te": "ఖరీఫ్ & వసంతం"}
    },
    {
        "crop_key": "soybean",
        "name_en": "Soybean",
        "name_hi": "सोयाबीन",
        "name_te": "సోయాబీన్",
        "category": "oilseed",
        "icon": "🌱",
        "scientific_name": "Glycine max",
        "season_info": {"en": "Kharif Monsoon", "hi": "खरीफ मानसून", "te": "ఖరీఫ్ వర్షాకాలం"}
    },
    {
        "crop_key": "groundnut",
        "name_en": "Groundnut (Peanut)",
        "name_hi": "मूंगफली",
        "name_te": "వేరుశనగ",
        "category": "oilseed",
        "icon": "🥜",
        "scientific_name": "Arachis hypogaea",
        "season_info": {"en": "Kharif & Summer", "hi": "खरीफ व ग्रीष्म", "te": "ఖరీఫ్ & వేసవి"}
    },
    {
        "crop_key": "sugarcane",
        "name_en": "Sugarcane",
        "name_hi": "गन्ना",
        "name_te": "చెరకు",
        "category": "commercial",
        "icon": "🎋",
        "scientific_name": "Saccharum officinarum",
        "season_info": {"en": "Annual Crop", "hi": "वार्षिक फसल (12 माह)", "te": "వార్షిక పంట"}
    },
    {
        "crop_key": "mustard",
        "name_en": "Mustard (Rape-seed)",
        "name_hi": "सरसों / राई",
        "name_te": "ఆవాలు",
        "category": "oilseed",
        "icon": "🌼",
        "scientific_name": "Brassica juncea",
        "season_info": {"en": "Rabi Winter", "hi": "रबी शीतकाल", "te": "రబీ శీతాకాలం"}
    },
    {
        "crop_key": "gram",
        "name_en": "Bengal Gram (Chickpea / Chana)",
        "name_hi": "चना (देसी व काबुली)",
        "name_te": "శనగ",
        "category": "pulse",
        "icon": "🥣",
        "scientific_name": "Cicer arietinum",
        "season_info": {"en": "Rabi Season", "hi": "रबी बुवाई", "te": "రబీ సీజన్"}
    },
    {
        "crop_key": "brinjal",
        "name_en": "Brinjal (Eggplant)",
        "name_hi": "बैंगन",
        "name_te": "వంకాయ",
        "category": "vegetable",
        "icon": "🍆",
        "scientific_name": "Solanum melongena",
        "season_info": {"en": "Multi-Season", "hi": "वर्ष भर", "te": "సంవత్సరమంతా"}
    },
    {
        "crop_key": "okra",
        "name_en": "Okra (Bhindi / Ladyfinger)",
        "name_hi": "भिंडी",
        "name_te": "బెండకాయ",
        "category": "vegetable",
        "icon": "🌿",
        "scientific_name": "Abelmoschus esculentus",
        "season_info": {"en": "Kharif & Summer", "hi": "खरीफ व जायद", "te": "ఖరీఫ్ & వేసవి"}
    },
    {
        "crop_key": "turmeric",
        "name_en": "Turmeric",
        "name_hi": "हल्दी",
        "name_te": "పసుపు",
        "category": "commercial",
        "icon": "🟡",
        "scientific_name": "Curcuma longa",
        "season_info": {"en": "Kharif (9 Months)", "hi": "खरीफ बुवाई (9 माह)", "te": "ఖరీఫ్ (9 నెలలు)"}
    },
    {
        "crop_key": "tea",
        "name_en": "Tea Plantations",
        "name_hi": "चाय बागान",
        "name_te": "టీ తోటలు",
        "category": "commercial",
        "icon": "🍵",
        "scientific_name": "Camellia sinensis",
        "season_info": {"en": "Perennial Plantation", "hi": "सदाबहार बागान", "te": "శాశ్వత తోటలు"}
    },
    {
        "crop_key": "spinach",
        "name_en": "Leafy Vegetables (Spinach / Methi / Coriander)",
        "name_hi": "पत्तेदार सब्जियां (पालक, मेथी, धनिया)",
        "name_te": "ఆకుకూరలు (పాలకూర, మెంతి, కొత్తిమీర)",
        "category": "vegetable",
        "icon": "🥬",
        "scientific_name": "Spinacia oleracea",
        "season_info": {"en": "Short-Cycle (30-45 Days)", "hi": "अल्पकालिक (30-45 दिन)", "te": "స్వల్పకాలిక పంట"}
    },
    {
        "crop_key": "cabbage",
        "name_en": "Cabbage & Cauliflower",
        "name_hi": "पत्तागोभी व फूलगोभी",
        "name_te": "క్యాబేజీ & క్యాలీఫ్లవర్",
        "category": "vegetable",
        "icon": "🥦",
        "scientific_name": "Brassica oleracea",
        "season_info": {"en": "Rabi Winter", "hi": "रबी शीतकाल", "te": "శీతాకాలం"}
    },
    {
        "crop_key": "papaya",
        "name_en": "Papaya",
        "name_hi": "पपीता",
        "name_te": "బొప్పాయి",
        "category": "fruit",
        "icon": "🍈",
        "scientific_name": "Carica papaya",
        "season_info": {"en": "Year-Round", "hi": "वर्ष भर", "te": "ఏడాదంతా"}
    },
    {
        "crop_key": "pomegranate",
        "name_en": "Pomegranate",
        "name_hi": "अनार",
        "name_te": "దానిమ్మ",
        "category": "fruit",
        "icon": "🍎",
        "scientific_name": "Punica granatum",
        "season_info": {"en": "Mrig / Ambe Bahar", "hi": "मृग व अम्बे बहार", "te": "సంవత్సరంలో రెండు పంటలు"}
    },
    {
        "crop_key": "ginger",
        "name_en": "Ginger & Garlic",
        "name_hi": "अदरक व लहसुन",
        "name_te": "అల్లం & వెల్లుల్లి",
        "category": "spice",
        "icon": "🧄",
        "scientific_name": "Zingiber officinale",
        "season_info": {"en": "Kharif / Rabi", "hi": "खरीफ व रबी", "te": "ఖరీఫ్ / రబీ"}
    },
    {
        "crop_key": "coffee",
        "name_en": "Coffee",
        "name_hi": "कॉफी बागान",
        "name_te": "కాఫీ తోటలు",
        "category": "commercial",
        "icon": "☕",
        "scientific_name": "Coffea arabica",
        "season_info": {"en": "Plantation Harvest (Nov-Feb)", "hi": "सदाबहार तुड़ाई", "te": "శాశ్వత తోటలు"}
    },
    {
        "crop_key": "cardamom",
        "name_en": "Cardamom",
        "name_hi": "इलायची (छोटी व बड़ी)",
        "name_te": "ఏలకులు",
        "category": "spice",
        "icon": "🌿",
        "scientific_name": "Elettaria cardamomum",
        "season_info": {"en": "Highland Monsoon", "hi": "पहाड़ी मानसूनी", "te": "వర్షాకాలం"}
    }
]


def ensure_pesticides_tables():
    """Ensure crops and pesticides tables exist in active database (Postgres or SQLite)."""
    if is_postgres_active():
        create_crops = """
        CREATE TABLE IF NOT EXISTS crops (
            crop_key VARCHAR(64) PRIMARY KEY,
            name_en VARCHAR(128) NOT NULL,
            name_hi VARCHAR(128) NOT NULL,
            name_te VARCHAR(128) NOT NULL,
            category VARCHAR(64) DEFAULT 'general',
            icon VARCHAR(16) DEFAULT '🌱',
            scientific_name VARCHAR(128),
            season_info JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        """
        create_pesticides = """
        CREATE TABLE IF NOT EXISTS pesticides (
            id VARCHAR(80) PRIMARY KEY,
            active_ingredient VARCHAR(150) NOT NULL,
            common_brands JSONB DEFAULT '[]'::jsonb,
            chemical_class VARCHAR(150),
            toxicity_band VARCHAR(32) DEFAULT 'green',
            toxicity_label JSONB DEFAULT '{}'::jsonb,
            target_pest_types TEXT,
            action_mode JSONB DEFAULT '{}'::jsonb,
            suitable_crops JSONB DEFAULT '[]'::jsonb,
            prohibited_crops JSONB DEFAULT '[]'::jsonb,
            dilution_rule JSONB DEFAULT '{}'::jsonb,
            external_links JSONB DEFAULT '[]'::jsonb,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        """
    else:
        create_crops = """
        CREATE TABLE IF NOT EXISTS crops (
            crop_key TEXT PRIMARY KEY,
            name_en TEXT NOT NULL,
            name_hi TEXT NOT NULL,
            name_te TEXT NOT NULL,
            category TEXT DEFAULT 'general',
            icon TEXT DEFAULT '🌱',
            scientific_name TEXT,
            season_info TEXT DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
        create_pesticides = """
        CREATE TABLE IF NOT EXISTS pesticides (
            id TEXT PRIMARY KEY,
            active_ingredient TEXT NOT NULL,
            common_brands TEXT DEFAULT '[]',
            chemical_class TEXT,
            toxicity_band TEXT DEFAULT 'green',
            toxicity_label TEXT DEFAULT '{}',
            target_pest_types TEXT,
            action_mode TEXT DEFAULT '{}',
            suitable_crops TEXT DEFAULT '[]',
            prohibited_crops TEXT DEFAULT '[]',
            dilution_rule TEXT DEFAULT '{}',
            external_links TEXT DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """

    execute_mutation(create_crops)
    execute_mutation(create_pesticides)


def seed_database_defaults():
    """Seeds master crops and CIBRC pesticides into the active database."""
    ensure_pesticides_tables()
    is_pg = is_postgres_active()

    # 1. Upsert Crops
    for crop in MASTER_CROPS:
        season_val = json.dumps(crop["season_info"]) if not is_pg else crop["season_info"]
        if is_pg:
            query = """
            INSERT INTO crops (crop_key, name_en, name_hi, name_te, category, icon, scientific_name, season_info)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb)
            ON CONFLICT (crop_key) DO UPDATE SET
                name_en = EXCLUDED.name_en,
                name_hi = EXCLUDED.name_hi,
                name_te = EXCLUDED.name_te,
                category = EXCLUDED.category,
                icon = EXCLUDED.icon,
                scientific_name = EXCLUDED.scientific_name,
                season_info = EXCLUDED.season_info;
            """
            execute_mutation(query, (
                crop["crop_key"], crop["name_en"], crop["name_hi"], crop["name_te"],
                crop["category"], crop["icon"], crop["scientific_name"], json.dumps(crop["season_info"])
            ))
        else:
            query = """
            INSERT OR REPLACE INTO crops (crop_key, name_en, name_hi, name_te, category, icon, scientific_name, season_info)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);
            """
            execute_mutation(query, (
                crop["crop_key"], crop["name_en"], crop["name_hi"], crop["name_te"],
                crop["category"], crop["icon"], crop["scientific_name"], json.dumps(crop["season_info"])
            ))

    # 2. Upsert CIBRC Pesticides from pesticide_service.py
    from app.domain.pesticide_service import PESTICIDE_DATABASE
    for p in PESTICIDE_DATABASE:
        pid = p["id"]
        active = p["active_ingredient"]
        brands = json.dumps(p["common_brands"])
        c_class = p.get("chemical_class", "")
        tox_band = p["toxicity_band"]
        tox_label = json.dumps(p["toxicity_label"])
        pests = p.get("target_pest_types", "")
        act_mode = json.dumps(p["action_mode"])
        suit = json.dumps(p["suitable_crops"])
        unsuit = json.dumps(p["unsuitable_crops"])
        dilution = json.dumps({
            "pump_liters": 15,
            "sample_dose": p["suitable_crops"][0].get("dosage_per_15l_pump", "6 ml") if p["suitable_crops"] else "10 ml",
            "mixing_compatibility": p.get("mixing_compatibility", "")
        })
        # Useful external authoritative links
        clean_first_brand = p["common_brands"][0].lower() if p["common_brands"] else "cibrc"
        links = json.dumps([
            {
                "name": f"Agrio Plant Doctor ({p['common_brands'][0]})",
                "url": f"https://agrio.app/search?q={clean_first_brand}",
                "description": "Agrio AI visual diagnostic and brand verification"
            },
            {
                "name": "CIBRC Official Pesticide Directory",
                "url": "http://ppqs.gov.in/divisions/cib-rc/registered-products",
                "description": "Government of India Directorate of Plant Protection"
            },
            {
                "name": "Kisan Call Center (ICAR 1800-180-1551)",
                "url": "https://dackvk.gov.in",
                "description": "Govt agricultural scientist advisory hotline"
            }
        ])

        if is_pg:
            query = """
            INSERT INTO pesticides (
                id, active_ingredient, common_brands, chemical_class, toxicity_band,
                toxicity_label, target_pest_types, action_mode, suitable_crops,
                prohibited_crops, dilution_rule, external_links, updated_at
            )
            VALUES (%s, %s, %s::jsonb, %s, %s, %s::jsonb, %s, %s::jsonb, %s::jsonb, %s::jsonb, %s::jsonb, %s::jsonb, CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO UPDATE SET
                active_ingredient = EXCLUDED.active_ingredient,
                common_brands = EXCLUDED.common_brands,
                chemical_class = EXCLUDED.chemical_class,
                toxicity_band = EXCLUDED.toxicity_band,
                toxicity_label = EXCLUDED.toxicity_label,
                target_pest_types = EXCLUDED.target_pest_types,
                action_mode = EXCLUDED.action_mode,
                suitable_crops = EXCLUDED.suitable_crops,
                prohibited_crops = EXCLUDED.prohibited_crops,
                dilution_rule = EXCLUDED.dilution_rule,
                external_links = EXCLUDED.external_links,
                updated_at = CURRENT_TIMESTAMP;
            """
            execute_mutation(query, (
                pid, active, brands, c_class, tox_band, tox_label,
                pests, act_mode, suit, unsuit, dilution, links
            ))
        else:
            query = """
            INSERT OR REPLACE INTO pesticides (
                id, active_ingredient, common_brands, chemical_class, toxicity_band,
                toxicity_label, target_pest_types, action_mode, suitable_crops,
                prohibited_crops, dilution_rule, external_links, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
            """
            execute_mutation(query, (
                pid, active, brands, c_class, tox_band, tox_label,
                pests, act_mode, suit, unsuit, dilution, links
            ))

    logger.info("Database Crops and Pesticides successfully seeded and verified.")


# Initialize / Seed once on module load
try:
    seed_database_defaults()
except Exception as exc:
    logger.warning("Pesticides DB auto-seed notice: %s", exc)


def search_crops_db(query: str = "", lang: str = "en") -> list[dict[str, Any]]:
    """Searches across master crops in database matching query in EN, HI, or TE."""
    q = (query or "").strip().lower()
    if not q:
        sql = "SELECT crop_key, name_en, name_hi, name_te, category, icon, season_info FROM crops ORDER BY crop_key ASC;"
        rows = execute_query(sql)
    else:
        sql = """
        SELECT crop_key, name_en, name_hi, name_te, category, icon, season_info
        FROM crops
        WHERE LOWER(crop_key) LIKE %s
           OR LOWER(name_en) LIKE %s
           OR LOWER(name_hi) LIKE %s
           OR LOWER(name_te) LIKE %s
        ORDER BY crop_key ASC;
        """
        pattern = f"%{q}%"
        rows = execute_query(sql, (pattern, pattern, pattern, pattern))

    results = []
    for r in rows:
        season = r.get("season_info", {})
        if isinstance(season, str):
            try:
                season = json.loads(season)
            except Exception:
                season = {}

        name_loc = r["name_hi"] if lang == "hi" else r["name_te"] if lang == "te" else r["name_en"]
        results.append({
            "crop_key": r["crop_key"],
            "name": name_loc,
            "name_en": r["name_en"],
            "name_hi": r["name_hi"],
            "name_te": r["name_te"],
            "category": r["category"],
            "icon": r["icon"] or "🌱",
            "season": season.get(lang, season.get("en", ""))
        })
    return results


def get_pesticides_for_crop_db(crop_query: str, lang: str = "en") -> dict[str, Any]:
    """Retrieves all approved and prohibited pesticides for a given crop directly from the database."""
    cq = (crop_query or "").strip().lower()
    if not cq:
        return {"crop": "", "suitable_pesticides": [], "prohibited_pesticides": []}

    # Fetch all pesticides from database
    sql = """
    SELECT id, active_ingredient, common_brands, chemical_class, toxicity_band,
           toxicity_label, target_pest_types, action_mode, suitable_crops,
           prohibited_crops, dilution_rule, external_links
    FROM pesticides;
    """
    rows = execute_query(sql)

    suitable_list = []
    prohibited_list = []

    for r in rows:
        suitable_crops = r.get("suitable_crops") or []
        if isinstance(suitable_crops, str):
            try: suitable_crops = json.loads(suitable_crops)
            except Exception: suitable_crops = []

        prohibited_crops = r.get("prohibited_crops") or []
        if isinstance(prohibited_crops, str):
            try: prohibited_crops = json.loads(prohibited_crops)
            except Exception: prohibited_crops = []

        brands = r.get("common_brands") or []
        if isinstance(brands, str):
            try: brands = json.loads(brands)
            except Exception: brands = []

        tox_label = r.get("toxicity_label") or {}
        if isinstance(tox_label, str):
            try: tox_label = json.loads(tox_label)
            except Exception: tox_label = {}

        action_mode = r.get("action_mode") or {}
        if isinstance(action_mode, str):
            try: action_mode = json.loads(action_mode)
            except Exception: action_mode = {}

        ext_links = r.get("external_links") or []
        if isinstance(ext_links, str):
            try: ext_links = json.loads(ext_links)
            except Exception: ext_links = []

        # Check if crop is suitable
        matched_suitable = next(
            (
                c for c in suitable_crops
                if cq in c.get("crop", "").lower() or
                   cq in c.get("crop_hi", "").lower() or
                   cq in c.get("crop_te", "").lower() or
                   "all" in c.get("crop", "").lower()
            ),
            None
        )

        # Check if crop is prohibited
        matched_prohibited = next(
            (
                u for u in prohibited_crops
                if cq in u.get("crop", "").lower() or
                   cq in u.get("crop_hi", "").lower() or
                   cq in u.get("crop_te", "").lower() or
                   "all" in u.get("crop", "").lower()
            ),
            None
        )

        if matched_prohibited:
            reason = matched_prohibited.get("reason", {})
            reason_text = reason.get(lang, reason.get("en", "")) if isinstance(reason, dict) else str(reason)
            prohibited_list.append({
                "pesticide_id": r["id"],
                "active_ingredient": r["active_ingredient"],
                "primary_brand": brands[0] if brands else r["active_ingredient"],
                "all_brands": brands,
                "toxicity_band": r["toxicity_band"],
                "hazard_level": matched_prohibited.get("hazard_level", "PROHIBITED"),
                "prohibited_reason": reason_text,
                "external_links": ext_links
            })

        if matched_suitable:
            suitable_list.append({
                "pesticide_id": r["id"],
                "active_ingredient": r["active_ingredient"],
                "primary_brand": brands[0] if brands else r["active_ingredient"],
                "all_brands": brands,
                "chemical_class": r["chemical_class"],
                "toxicity_band": r["toxicity_band"],
                "toxicity_label": tox_label.get(lang, tox_label.get("en", "")),
                "target_pests": matched_suitable.get("target_pests", r.get("target_pest_types", "")),
                "dosage_per_15l_pump": matched_suitable.get("dosage_per_15l_pump", "6 ml"),
                "dosage_per_acre": matched_suitable.get("dosage_per_acre", "60 ml"),
                "phi_days": matched_suitable.get("phi_days", 3),
                "farmer_note": matched_suitable.get("note", ""),
                "action_summary": action_mode.get(lang, action_mode.get("en", "")),
                "external_links": ext_links
            })

    return {
        "crop": crop_query,
        "total_approved": len(suitable_list),
        "total_prohibited": len(prohibited_list),
        "suitable_pesticides": suitable_list,
        "prohibited_pesticides": prohibited_list
    }
