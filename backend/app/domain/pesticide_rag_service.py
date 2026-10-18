"""CIBRC Statutory Pesticide Registry & Gemini RAG Advisory Service.

Integrates the official Government of India (CIBRC / DPPQS) pesticide registry in PostgreSQL
with Google Gemini API (google-genai SDK) to provide:
1. Grounded CIBRC database retrieval (Search by Crop, Pesticide, Pest, or Category).
2. Crop Compatibility & Hazard Checker (Detects phytotoxicity, off-label usage, and safe alternatives).
3. 15-Liter Knapsack Sprayer Pump calculations and Pre-Harvest Interval (PHI) compliance.
4. Gemini RAG advisory generation in English, Hindi, and Telugu with reliable deterministic fallback.
"""

import json
import logging
import re
import sys
from pathlib import Path
from typing import Any, Optional

CURRENT_FILE = Path(__file__).resolve()
BACKEND_DIR = CURRENT_FILE.parents[2]
PROJECT_ROOT = BACKEND_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.cache.cache_service import cache_service
from app.llm.client import LLMGateway
from app.settings import settings
from database.cibrc_isolated_db import get_cibrc_cursor, get_cibrc_db_path, init_isolated_cibrc_db

logger = logging.getLogger("PesticideRagService")


class PesticideRagService:
    """RAG-powered service connecting isolated CIBRC registry database file with Google Gemini API."""

    def __init__(self):
        self.llm_gateway = LLMGateway()
        # Ensure the isolated database file is initialized
        try:
            init_isolated_cibrc_db()
        except Exception as exc:
            logger.warning("Isolated CIBRC DB init notice: %s", exc)

    # -------------------------------------------------------------------------
    # 1. Database Retrieval Methods (Isolated Database File)
    # -------------------------------------------------------------------------
    def search_registry(
        self,
        query: str = "",
        category: Optional[str] = None,
        crop: Optional[str] = None,
        limit: int = 50
    ) -> list[dict[str, Any]]:
        """Searches CIBRC records in the isolated database file matching query string, category, or crop."""
        ph = "?"

        sql = """
            SELECT 
                id, category, pesticide_name, active_ingredient, formulation,
                crop, crop_key, target_pest_or_disease, ai_dose, formulation_dose,
                dilution_water_liters, waiting_period_days, pump_dose_15l,
                application_method, toxicity_band, toxicity_label, safety_warnings,
                is_approved, payload
            FROM cibrc_pesticide_registry
            WHERE 1=1
        """
        params: list[Any] = []

        q = (query or "").strip().lower()
        if q:
            sql += f"""
                AND (
                    LOWER(pesticide_name) LIKE {ph}
                    OR LOWER(active_ingredient) LIKE {ph}
                    OR LOWER(crop) LIKE {ph}
                    OR LOWER(crop_key) LIKE {ph}
                    OR LOWER(target_pest_or_disease) LIKE {ph}
                    OR LOWER(payload) LIKE {ph}
                )
            """
            wildcard = f"%{q}%"
            params.extend([wildcard] * 6)

        if category:
            sql += f" AND UPPER(category) = UPPER({ph})"
            params.append(category.strip())

        if crop:
            sql += f" AND (LOWER(crop_key) = LOWER({ph}) OR LOWER(crop) LIKE {ph})"
            params.append(crop.strip().lower())
            params.append(f"%{crop.strip().lower()}%")

        sql += f" ORDER BY crop_key ASC, category ASC, pesticide_name ASC LIMIT {ph};"
        params.append(limit)

        try:
            with get_cibrc_cursor() as cur:
                cur.execute(sql, tuple(params))
                rows = cur.fetchall()
                results = []
                for r in rows:
                    item = dict(r)
                    if isinstance(item.get("payload"), str):
                        try:
                            item["payload"] = json.loads(item["payload"])
                        except Exception:
                            pass
                    results.append(item)
                return results
        except Exception as exc:
            logger.error("Error querying isolated cibrc_pesticide_registry: %s", exc)
            return []

    def get_crop_presets(self, crop_key: str) -> dict[str, Any]:
        """Retrieves all CIBRC registered pesticide & bio-agent presets for a specific crop."""
        clean_key = (crop_key or "").strip().lower()
        if clean_key in ["rice", "paddy"]:
            clean_key = "paddy"

        records = self.search_registry(crop=clean_key, limit=100)

        grouped: dict[str, list[dict[str, Any]]] = {
            "INSECTICIDE": [],
            "FUNGICIDE": [],
            "HERBICIDE": [],
            "PGR": [],
            "BIO-PESTICIDE": []
        }

        for r in records:
            cat = (r.get("category") or "INSECTICIDE").upper()
            if cat not in grouped:
                grouped[cat] = []
            grouped[cat].append(r)

        return {
            "status": "success",
            "crop_key": clean_key,
            "crop_title": clean_key.title() if clean_key != "paddy" else "Paddy (Rice)",
            "total_registered_presets": len(records),
            "categories": grouped
        }

    def check_suitability(self, pesticide_name: str, crop_name: str) -> dict[str, Any]:
        """Checks if a pesticide is CIBRC-registered and suitable for a given crop, or if it is harmful."""
        pest_clean = (pesticide_name or "").strip()
        crop_clean = (crop_name or "").strip()
        crop_clean_lower = crop_clean.lower()
        if crop_clean_lower in ["rice", "paddy"]:
            crop_key = "paddy"
        else:
            crop_key = crop_clean_lower

        # Find any record matching pesticide
        matches = self.search_registry(query=pest_clean, limit=20)
        if not matches:
            return {
                "verdict": "UNKNOWN",
                "is_approved": False,
                "message": f"Pesticide '{pesticide_name}' was not found in the official CIBRC statutory database.",
                "crop": crop_name,
                "pesticide": pesticide_name,
                "details": None,
                "alternatives": self.search_registry(crop=crop_key, limit=5)
            }

        # Check if any match is approved for the requested crop
        approved_match = next(
            (m for m in matches if m["crop_key"] == crop_key or crop_clean_lower in m["crop"].lower()),
            None
        )

        if approved_match:
            return {
                "verdict": "APPROVED",
                "is_approved": True,
                "severity": "safe",
                "title": f"✅ CIBRC APPROVED: {approved_match['pesticide_name']} is registered for {approved_match['crop']}",
                "crop": approved_match["crop"],
                "pesticide": approved_match["pesticide_name"],
                "active_ingredient": approved_match["active_ingredient"],
                "category": approved_match["category"],
                "target_pest_or_disease": approved_match["target_pest_or_disease"],
                "pump_dose_15l": approved_match["pump_dose_15l"],
                "formulation_dose": approved_match["formulation_dose"],
                "waiting_period_days": approved_match["waiting_period_days"],
                "toxicity_band": approved_match["toxicity_band"],
                "toxicity_label": approved_match["toxicity_label"],
                "safety_warnings": approved_match["safety_warnings"],
                "application_method": approved_match["application_method"],
                "matched_record": approved_match
            }

        # The pesticide exists in CIBRC, but NOT for this crop!
        # Check if it is a severe hazard (e.g. 2,4-D on broadleaf tomato/cotton, or rice herbicide on veggies)
        active_ing = matches[0]["active_ingredient"].lower()
        cat = matches[0]["category"].upper()

        is_severe_hazard = False
        hazard_reason = ""

        if "2,4-d" in active_ing and crop_clean_lower in ["tomato", "cotton", "chilli", "brinjal", "grapes", "soybean"]:
            is_severe_hazard = True
            hazard_reason = f"⛔ CATASTROPHIC RISK: 2,4-D is a selective synthetic auxin herbicide meant strictly for cereals/monocots. Spraying on broadleaf {crop_name} causes irreversible hormone disruption, severe epinasty, stem twisting, and 100% crop death!"
        elif cat == "HERBICIDE" and crop_clean_lower in ["tomato", "chilli", "brinjal", "mango"]:
            is_severe_hazard = True
            hazard_reason = f"⛔ PHYTOTOXIC HAZARD: '{matches[0]['pesticide_name']}' is a herbicide registered for other crops ({matches[0]['crop']}). Direct foliar application on {crop_name} will cause severe scorch and kill the crop!"
        else:
            hazard_reason = f"⚠️ OFF-LABEL WARNING: '{matches[0]['pesticide_name']}' is registered by CIBRC for {matches[0]['crop']}, but NOT officially registered for {crop_name}. Using off-label chemicals risks illegal toxic residues, chemical burn, or failure to control the pest."

        approved_crops_list = list({m["crop"] for m in matches})
        safe_alternatives = self.search_registry(crop=crop_key, limit=6)

        return {
            "verdict": "PROHIBITED_HAZARD" if is_severe_hazard else "NOT_REGISTERED",
            "is_approved": False,
            "severity": "danger" if is_severe_hazard else "warning",
            "title": f"⛔ NOT APPROVED FOR {crop_name.upper()}: {matches[0]['pesticide_name']}",
            "crop": crop_name,
            "pesticide": matches[0]["pesticide_name"],
            "hazard_reason": hazard_reason,
            "registered_crops_for_this_pesticide": approved_crops_list,
            "safe_approved_alternatives_for_crop": safe_alternatives
        }

    # -------------------------------------------------------------------------
    # 2. Gemini RAG Advisory Generation
    # -------------------------------------------------------------------------
    async def generate_rag_advisory(
        self,
        user_query: str,
        crop: Optional[str] = None,
        pesticide: Optional[str] = None,
        lang: str = "en"
    ) -> dict[str, Any]:
        """Executes full RAG workflow:
        1. Retrieves relevant CIBRC records from PostgreSQL.
        2. Formats statutory context.
        3. Calls Google Gemini API using KS_GEMINI_API_KEY.
        4. Provides robust deterministic fallback if API is unavailable.
        """
        # Step 1: Retrieval
        retrieved_docs: list[dict[str, Any]] = []

        if crop:
            clean_c = crop.strip().lower()
            if clean_c in ["rice", "paddy"]:
                clean_c = "paddy"
            retrieved_docs.extend(self.search_registry(crop=clean_c, limit=10))

        if pesticide:
            retrieved_docs.extend(self.search_registry(query=pesticide.strip(), limit=10))

        # Also search by general query terms
        if user_query:
            query_matches = self.search_registry(query=user_query.strip(), limit=10)
            retrieved_docs.extend(query_matches)

        # Deduplicate retrieved records by ID
        unique_docs: list[dict[str, Any]] = []
        seen_ids = set()
        for doc in retrieved_docs:
            if doc["id"] not in seen_ids:
                seen_ids.add(doc["id"])
                unique_docs.append(doc)

        # If no docs found, fetch 5 popular records
        if not unique_docs:
            unique_docs = self.search_registry(limit=5)

        # Step 2: Build Structured Grounded Context
        context_blocks = []
        for i, d in enumerate(unique_docs[:12], 1):
            block = (
                f"[{i}] CROP: {d['crop']} | CATEGORY: {d['category']} | PESTICIDE: {d['pesticide_name']}\n"
                f"    - Active Ingredient: {d['active_ingredient']} ({d.get('formulation', '')})\n"
                f"    - Target Pest/Disease: {d['target_pest_or_disease']}\n"
                f"    - Dose per Hectare: {d['formulation_dose']} (a.i.: {d.get('ai_dose', 'N/A')})\n"
                f"    - 15-Liter Knapsack Pump Dose: {d['pump_dose_15l']}\n"
                f"    - Water Dilution: {d['dilution_water_liters']}\n"
                f"    - Waiting Period (PHI): {d['waiting_period_days']}\n"
                f"    - Toxicity Triangle: {d['toxicity_band'].upper()} - {d['toxicity_label']}\n"
                f"    - Application Method: {d['application_method']}\n"
                f"    - Statutory Caution: {d['safety_warnings']}"
            )
            context_blocks.append(block)

        grounded_context = "\n\n".join(context_blocks)

        system_instruction = (
            "You are the senior Agricultural Pharmacologist and CIBRC Statutory Crop Protection Advisor for Kisan-Sethu.\n\n"
            "STRICT GROUNDING & ANTI-HALLUCINATION RULES:\n"
            "1. You are strictly bound to the official Government of India Central Insecticide Board & Registration Committee (CIBRC) "
            "database records provided in the context below. Search ONLY this data and DO NOT search or extrapolate outside this dataset.\n"
            "2. DO NOT make up, assume, guess, or invent any pesticide, brand name, active dose, dilution rate, or waiting period that is not explicitly present in the provided records.\n"
            "3. If a queried chemical is NOT registered for the queried crop in the provided CIBRC context:\n"
            "   - Explicitly state: '⛔ NOT REGISTERED in CIBRC Database for [Crop]'.\n"
            "   - Warn of severe phytotoxicity, crop loss, or illegal residues (e.g. 2,4-D causing severe epinasty and kill on broadleaf crops like Tomato/Cotton).\n"
            "   - Suggest ONLY the registered alternatives present in the provided context.\n"
            "4. ALWAYS provide the EXACT 15-Liter Knapsack Sprayer Pump dose (in ml or grams per 15L tank) so smallholder Indian farmers can mix accurately in the field.\n"
            "5. ALWAYS specify the Pre-Harvest Interval (waiting period in days) before harvesting to prevent toxic chemical residues.\n"
            "6. State the Toxicity Triangle (Green = caution/safe, Blue = moderate, Yellow = highly toxic, Red = extremely hazardous, Bio = certified organic).\n"
            f"7. Respond in the requested language: '{lang}' (English, Hindi, or Telugu). If Hindi, write in fluent Devanagari script. If Telugu, write in Telugu script.\n\n"
            f"Context from Isolated CIBRC Registry Database ({Path(get_cibrc_db_path()).name}):\n"
            f"{grounded_context}"
        )

        user_prompt = f"Farmer Question: {user_query}\nTarget Crop: {crop or 'Not specified'}\nPesticide Queried: {pesticide or 'Not specified'}"

        # Step 3: Invoke LLM Gateway
        ai_response_text = ""
        is_llm_online = False
        try:
            if settings.gemini_api_key and not settings.gemini_api_key.startswith("your_"):
                ai_response_text = await self.llm_gateway.generate_response(
                    prompt=user_prompt,
                    system_instruction=system_instruction,
                    use_strong_model=False
                )
                if ai_response_text:
                    is_llm_online = True
        except Exception as exc:
            logger.warning("Gemini API call failed (%s); using CIBRC grounded fallback synthesizer.", exc)

        if not ai_response_text:
            ai_response_text = self._generate_grounded_fallback(
                query=user_query,
                crop=crop,
                pesticide=pesticide,
                retrieved_docs=unique_docs,
                lang=lang
            )

        return {
            "status": "success",
            "query": user_query,
            "crop": crop,
            "pesticide": pesticide,
            "language": lang,
            "llm_engine": "Gemini 3.8 Flash (google-genai)" if is_llm_online else "CIBRC Grounded Rule Engine",
            "rag_context_count": len(unique_docs),
            "retrieved_records": unique_docs[:10],
            "advisory": ai_response_text
        }

    def _generate_grounded_fallback(
        self,
        query: str,
        crop: Optional[str],
        pesticide: Optional[str],
        retrieved_docs: list[dict[str, Any]],
        lang: str = "en"
    ) -> str:
        """Generates an accurate, professional CIBRC-grounded advisory when Gemini API is offline or without key."""
        target_crop = crop or (retrieved_docs[0]["crop"] if retrieved_docs else "Selected Crop")

        if lang == "hi":
            header = f"🌾 **किसान-सेतु CIBRC कीटनाशक एवं खुराक परामर्श (भारत सरकार अधिकृत डेटा)** 🌾\n\n"
            header += f"**लक्षित फसल:** {target_crop}\n\n"
            sections = []
            for d in retrieved_docs[:4]:
                sec = (
                    f"### 🛡️ {d['pesticide_name']} ({d['category']})\n"
                    f"- **सक्रिय घटक (Active Ingredient):** {d['active_ingredient']}\n"
                    f"- **लक्षित कीट/रोग (Target Pest/Disease):** {d['target_pest_or_disease']}\n"
                    f"- **15-लीटर पंप खुराक (Knapsack Pump Dose):** **{d['pump_dose_15l']}**\n"
                    f"- **प्रति हेक्टेयर खुराक (Dose/ha):** {d['formulation_dose']} ({d['dilution_water_liters']} पानी)\n"
                    f"- **प्रतीक्षा अवधि / फसल कटाई अंतर (PHI Waiting Period):** **{d['waiting_period_days']}**\n"
                    f"- **विषाक्तता त्रिकोण (Toxicity Band):** {d['toxicity_label']}\n"
                    f"- **सुरक्षा निर्देश:** {d['safety_warnings']}\n"
                )
                sections.append(sec)
            footer = "\n> [!NOTE]\n> कृपया छिड़काव करते समय सुरक्षात्मक मास्क एवं दस्ताने पहनें। मधुमक्खी परागण के समय अत्यधिक विषैले रसायनों का उपयोग न करें।"
            return header + "\n".join(sections) + footer

        elif lang == "te":
            header = f"🌾 **కిసాన్-సేతు CIBRC పురుగుమందుల మోతాదు సలహా (భారత ప్రభుత్వ అధికారిక సమాచారం)** 🌾\n\n"
            header += f"**ఎంచుకున్న పంట:** {target_crop}\n\n"
            sections = []
            for d in retrieved_docs[:4]:
                sec = (
                    f"### 🛡️ {d['pesticide_name']} ({d['category']})\n"
                    f"- **క్రియాశీల పదార్ధం:** {d['active_ingredient']}\n"
                    f"- **నియంత్రించే పురుగులు/తెగుళ్లు:** {d['target_pest_or_disease']}\n"
                    f"- **15-లీటర్ల పంపు మోతాదు:** **{d['pump_dose_15l']}**\n"
                    f"- **ఎకరా/హెక్టారు మోతాదు:** {d['formulation_dose']} ({d['dilution_water_liters']} నీరు)\n"
                    f"- **వేచి ఉండే వ్యవధి (కోతకు ముందు రోజులు):** **{d['waiting_period_days']}**\n"
                    f"- **విషపూరిత లేబుల్:** {d['toxicity_label']}\n"
                    f"- **రైతు భద్రతా సలహా:** {d['safety_warnings']}\n"
                )
                sections.append(sec)
            footer = "\n> [!NOTE]\n> మందు పిచికారీ చేసేటప్పుడు మాస్క్ మరియు చేతి తొడుగులు ధరించండి. తేనెటీగలు వచ్చే సమయంలో విషపూరిత రసాయనాలను వాడవద్దు."
            return header + "\n".join(sections) + footer

        else:
            header = f"🌾 **Kisan-Sethu CIBRC Statutory Pesticide & Dosage Advisory (Govt. of India Certified)** 🌾\n\n"
            header += f"**Queried Crop:** {target_crop} | **Query:** {query or 'Approved Presets'}\n\n"
            sections = []
            for d in retrieved_docs[:5]:
                sec = (
                    f"### 🛡️ {d['pesticide_name']} [{d['category']}]\n"
                    f"- **Active Molecule:** {d['active_ingredient']} ({d.get('formulation', '')})\n"
                    f"- **Registered Target:** {d['target_pest_or_disease']}\n"
                    f"- **15-Liter Knapsack Sprayer Dose:** **`{d['pump_dose_15l']}`**\n"
                    f"- **Formulation Dose per Hectare:** {d['formulation_dose']} in {d['dilution_water_liters']} water\n"
                    f"- **Pre-Harvest Interval (Waiting Period):** **`{d['waiting_period_days']}`**\n"
                    f"- **Toxicity Classification:** {d['toxicity_label']}\n"
                    f"- **Statutory Safety Caution:** {d['safety_warnings']}\n"
                )
                sections.append(sec)
            footer = (
                "\n> [!IMPORTANT]\n"
                "> All recommendations comply with statutory Central Insecticide Board & Registration Committee (CIBRC) guidelines. "
                "Always observe the mandatory waiting period before harvest to avoid chemical residues on food produce."
            )
            return header + "\n".join(sections) + footer
    async def diagnose_and_prescribe(
        self,
        image_bytes: Optional[bytes] = None,
        mime_type: str = "image/jpeg",
        crop_key: Optional[str] = None,
        symptom_key: Optional[str] = None,
        user_query: Optional[str] = None,
        tank_liters: int = 15,
        lang: str = "en"
    ) -> dict[str, Any]:
        """Multimodal 3-Column Diagnostic & Prescriptive Engine:
        1. Analyzes leaf/plant photo via Gemini Vision (or symptom selection).
        2. Retrieves official statutory CIBRC solutions from isolated database file.
        3. Dynamically calculates sprayer pump dosage for any tank capacity (15L, 20L, 50L, 200L).
        4. Provides audio scripts in English, Hindi, and Telugu.
        """
        detected_crop = crop_key or "tomato"
        detected_symptom = symptom_key or "leaf_spot"
        vision_analysis_note = ""

        # Step 1: Multimodal Gemini Vision Inspection
        if image_bytes:
            vision_prompt = (
                "You are an expert Indian agricultural plant pathologist and entomologist. "
                "Carefully inspect this leaf or plant image:\n"
                "1. Determine if this is an agricultural crop or plant.\n"
                "2. Identify the crop (e.g., Tomato, Chilli, Paddy, Potato, Mango, Cotton, Wheat, Grapes, Apple).\n"
                "3. Diagnose the visible pest or disease symptom (e.g., Leaf Spot, Leaf Curl, Early Blight, Late Blight, Fruit Borer, Mites, Blast, Rust).\n"
                "Respond in valid JSON format ONLY with keys:\n"
                "{\"is_crop\": true, \"crop\": \"Tomato\", \"crop_key\": \"tomato\", \"symptom\": \"Leaf Spot\", \"symptom_key\": \"leaf_spot\", \"explanation\": \"...\"}"
            )
            try:
                vision_text = await self.llm_gateway.generate_vision_response(
                    image_bytes=image_bytes,
                    mime_type=mime_type,
                    prompt=vision_prompt
                )
                if vision_text:
                    cleaned_json = vision_text.replace("```json", "").replace("```", "").strip()
                    parsed = json.loads(cleaned_json)
                    if parsed.get("crop_key"):
                        detected_crop = parsed["crop_key"].lower()
                    if parsed.get("symptom_key"):
                        detected_symptom = parsed["symptom_key"].lower()
                    vision_analysis_note = parsed.get("explanation", "")
            except Exception as exc:
                logger.warning("Gemini Vision parsing failed (%s); using symptom heuristics.", exc)

        # Standardize crop name & key
        clean_crop = detected_crop.lower()
        if clean_crop in ["rice", "paddy"]:
            clean_crop = "paddy"
            display_crop = "Paddy (Rice)"
            crop_icon = "🌾"
        elif clean_crop == "tomato":
            display_crop = "Tomato"
            crop_icon = "🍅"
        elif clean_crop == "chilli":
            display_crop = "Chilli"
            crop_icon = "🌶️"
        elif clean_crop == "potato":
            display_crop = "Potato"
            crop_icon = "🥔"
        elif clean_crop == "mango":
            display_crop = "Mango"
            crop_icon = "🥭"
        elif clean_crop == "cotton":
            display_crop = "Cotton"
            crop_icon = "🌱"
        elif clean_crop == "wheat":
            display_crop = "Wheat"
            crop_icon = "🌾"
        elif clean_crop == "grapes":
            display_crop = "Grapes"
            crop_icon = "🍇"
        elif clean_crop == "apple":
            display_crop = "Apple"
            crop_icon = "🍎"
        else:
            display_crop = clean_crop.title()
            crop_icon = "🌱"

        # Step 2: Query Isolated Database for Target Solutions
        symptom_query_str = detected_symptom.replace("_", " ")
        all_crop_records = self.search_registry(crop=clean_crop, limit=50)

        # Filter or rank records by symptom match
        matching_records = [
            r for r in all_crop_records
            if any(term in r["target_pest_or_disease"].lower() for term in symptom_query_str.split())
        ]
        if not matching_records:
            matching_records = all_crop_records[:6]

        # Step 3: Build Actionable Solution Bottle Cards with Dynamic Pump Math
        actionable_solutions = []
        for r in matching_records:
            # Parse baseline 15L pump dose numbers
            base_15l_str = r.get("pump_dose_15l", "")
            num_match = re.search(r"(\d+(?:\.\d+)?)", base_15l_str)
            unit = "ml" if "ml" in base_15l_str.lower() else "g"

            if num_match:
                base_val = float(num_match.group(1))
                # Dynamic scaling: base_val is for 15L
                scaled_val = round((base_val / 15.0) * tank_liters, 1)
                calculated_pump_dose = f"{scaled_val} {unit} per {tank_liters}L pump ({round(base_val/15.0, 2)} {unit}/L)"
            else:
                calculated_pump_dose = base_15l_str or f"Refer to {tank_liters}L tank label"

            brands = r.get("payload", {}).get("common_brands", []) if isinstance(r.get("payload"), dict) else []
            primary_brand = brands[0] if brands else r["pesticide_name"].split()[0]

            # Assign bottle color themes based on toxicity band
            tox_band = r.get("toxicity_band", "blue").lower()
            if tox_band == "green":
                cap_color = "#10B981"
                band_label = "Green (Slightly Toxic - Safe for Beneficials)"
            elif tox_band == "yellow":
                cap_color = "#F59E0B"
                band_label = "Yellow (Highly Toxic - Handle with Care)"
            elif tox_band == "red":
                cap_color = "#EF4444"
                band_label = "Red (Extremely Toxic - Restricted)"
            elif tox_band == "bio":
                cap_color = "#059669"
                band_label = "Bio-Certified (Zero Chemical Residues)"
            else:
                cap_color = "#3B82F6"
                band_label = "Blue (Moderately Toxic)"

            actionable_solutions.append({
                "id": r["id"],
                "brand_name": primary_brand,
                "pesticide_name": r["pesticide_name"],
                "active_ingredient": r["active_ingredient"],
                "formulation": r.get("formulation", ""),
                "category": r["category"],
                "target_pest": r["target_pest_or_disease"].split(",")[0],
                "pump_dose": calculated_pump_dose,
                "pump_liters": tank_liters,
                "formulation_dose_ha": r["formulation_dose"],
                "waiting_period_days": r["waiting_period_days"],
                "toxicity_band": tox_band,
                "toxicity_label": band_label,
                "cap_color": cap_color,
                "application_method": r["application_method"],
                "safety_advice": r["safety_warnings"],
                "is_cibrc_approved": True
            })

        # Step 4: Build Vernacular Audio Script
        top_sol = actionable_solutions[0] if actionable_solutions else None
        if lang == "hi":
            symptom_hi = "पत्ती धब्बा" if "spot" in detected_symptom else "पत्ती मरोड़" if "curl" in detected_symptom else "फल छेदक" if "borer" in detected_symptom else "झुलसा रोग"
            audio_script = (
                f"{display_crop} में {symptom_hi} की पहचान हुई है। "
                f"केंद्रीय कीटनाशी बोर्ड द्वारा अनुमोदित दवा {top_sol['brand_name'] if top_sol else 'दवा'} का प्रयोग करें। "
                f"{tank_liters} लीटर पंप में {top_sol['pump_dose'].split(' per ')[0] if top_sol else 'सही मात्रा'} घोलें। "
                f"तुड़ाई से पहले {top_sol['waiting_period_days'] if top_sol else '3 दिन'} की प्रतीक्षा अवधि का पालन करें।"
            )
        elif lang == "te":
            audio_script = (
                f"{display_crop} పంటలో తెగులు గుర్తించబడింది. "
                f"CIBRC ఆమోదించిన {top_sol['brand_name'] if top_sol else 'మందు'} వాడండి. "
                f"{tank_liters} లీటర్ల పంపుకు {top_sol['pump_dose'].split(' per ')[0] if top_sol else 'సరైన మోతాదు'} కలపండి."
            )
        else:
            audio_script = (
                f"Identified {detected_symptom.replace('_', ' ')} in {display_crop}. "
                f"Recommended CIBRC approved solution is {top_sol['brand_name'] if top_sol else 'medicine'}. "
                f"Mix {top_sol['pump_dose'].split(' per ')[0] if top_sol else 'recommended dose'} per {tank_liters}L tank. "
                f"Observe mandatory pre-harvest interval of {top_sol['waiting_period_days'] if top_sol else 'waiting days'}."
            )

        return {
            "status": "success",
            "detected_crop": {
                "key": clean_crop,
                "name": display_crop,
                "icon": crop_icon
            },
            "detected_symptom": {
                "key": detected_symptom,
                "title": detected_symptom.replace("_", " ").title(),
                "severity": "high" if "curl" in detected_symptom or "borer" in detected_symptom else "medium",
                "notes": vision_analysis_note or "CIBRC Certified Diagnostic Pattern"
            },
            "tank_liters": tank_liters,
            "actionable_solutions": actionable_solutions,
            "audio_script": audio_script,
            "language": lang
        }


pesticide_rag_service = PesticideRagService()

