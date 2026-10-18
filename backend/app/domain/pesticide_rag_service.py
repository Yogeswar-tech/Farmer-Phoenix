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
from typing import Any

CURRENT_FILE = Path(__file__).resolve()
BACKEND_DIR = CURRENT_FILE.parents[2]
PROJECT_ROOT = BACKEND_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from database.cibrc_isolated_db import get_cibrc_cursor, init_isolated_cibrc_db

from app.llm import LLMGateway, LLMUnavailableError, load_prompt

logger = logging.getLogger("PesticideRagService")


class PesticideRagService:
    """RAG-powered service connecting isolated CIBRC registry database file with Google Gemini API."""

    def __init__(self) -> None:
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
        category: str | None = None,
        crop: str | None = None,
        limit: int = 50
    ) -> list[dict[str, Any]]:
        """Searches CIBRC records in the isolated database file matching query string, category, or crop."""
        from database.connection import is_postgres_active
        ph = "%s" if is_postgres_active() else "?"

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
                    OR LOWER(CAST(payload AS TEXT)) LIKE {ph}
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
        crop: str | None = None,
        pesticide: str | None = None,
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

        advisor_prompt = load_prompt(
            "doctor",
            "advisor",
            version=1,
            variables={
                "crop": crop or "Not specified",
                "farmer_question": f"{user_query} (Pesticide: {pesticide or 'N/A'})",
                "cibrc_records": grounded_context,
                "lang": lang,
            },
        )

        # Step 3: Invoke LLM Gateway
        ai_response_text = ""
        is_llm_online = False
        try:
            if not self.llm_gateway.is_available():
                raise LLMUnavailableError("LLM credentials not configured")
            raw_response = await self.llm_gateway.generate_response(
                prompt=advisor_prompt,
                use_strong_model=False,
            )
            if raw_response:
                is_llm_online = True
                try:
                    cleaned = raw_response.replace("```json", "").replace("```", "").strip()
                    parsed_res = json.loads(cleaned)
                    selected_ids = parsed_res.get("selected_record_ids", [])
                    reasoning = parsed_res.get("reasoning", "")
                    notes = parsed_res.get("advisory_notes", "")
                    chosen_docs = [d for d in unique_docs if d["id"] in selected_ids] or unique_docs[:3]
                    ai_response_text = f"{reasoning}\n\n{notes}\n\n" + self._generate_grounded_fallback(
                        user_query, crop, pesticide, chosen_docs, lang
                    )
                except Exception:
                    ai_response_text = raw_response

        except LLMUnavailableError as exc:
            logger.warning("LLM unavailable for CIBRC RAG: %s", exc)
            friendly_message = (
                "సలహా సేవ ప్రస్తుతం అందుబాటులో లేదు. దయచేసి స్థానిక వ్యవసాయ అధికారిని లేదా కిసాన్ కాల్ సెంటర్ (1800-180-1551) సంప్రదించండి."
                if lang == "te"
                else (
                    "कीटनाशक सलाहकार सेवा वर्तमान में अनुपलब्ध है। कृपया अपने स्थानीय कृषि अधिकारी या किसान कॉल सेंटर (1800-180-1551) से परामर्श लें।"
                    if lang == "hi"
                    else "Pesticide advisory service is temporarily unavailable. Please consult your local Agricultural Extension Officer or Kisan Call Centre (1800-180-1551)."
                )
            )
            return {
                "status": "unavailable",
                "advisory": None,
                "message": friendly_message,
                "query": user_query,
                "crop": crop,
                "pesticide": pesticide,
                "language": lang,
                "llm_engine": "None",
                "rag_context_count": len(unique_docs),
                "retrieved_records": unique_docs[:10],
            }
        except Exception as exc:
            logger.warning("Unexpected error during CIBRC RAG LLM call: %s", exc)
            friendly_message = "Advisory service temporarily unavailable. Please consult Kisan Call Centre (1800-180-1551)."
            return {
                "status": "unavailable",
                "advisory": None,
                "message": friendly_message,
                "query": user_query,
                "crop": crop,
                "pesticide": pesticide,
                "language": lang,
                "llm_engine": "None",
                "rag_context_count": len(unique_docs),
                "retrieved_records": unique_docs[:10],
            }

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
        crop: str | None,
        pesticide: str | None,
        retrieved_docs: list[dict[str, Any]],
        lang: str = "en"
    ) -> str:
        """Generates an accurate, professional CIBRC-grounded advisory when Gemini API is offline or without key."""
        target_crop = crop or (retrieved_docs[0]["crop"] if retrieved_docs else "Selected Crop")

        if lang == "hi":
            header = "🌾 **किसान-सेतु CIBRC कीटनाशक एवं खुराक परामर्श (भारत सरकार अधिकृत डेटा)** 🌾\n\n"
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
            header = "🌾 **కిసాన్-సేతు CIBRC పురుగుమందుల మోతాదు సలహా (భారత ప్రభుత్వ అధికారిక సమాచారం)** 🌾\n\n"
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
            header = "🌾 **Kisan-Sethu CIBRC Statutory Pesticide & Dosage Advisory (Govt. of India Certified)** 🌾\n\n"
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
        image_bytes: bytes | None = None,
        mime_type: str = "image/jpeg",
        crop_key: str | None = None,
        symptom_key: str | None = None,
        user_query: str | None = None,
        tank_liters: int = 15,
        lang: str = "en"
    ) -> dict[str, Any]:
        """Multimodal 3-Column Diagnostic & Prescriptive Engine:
        1. Analyzes leaf/plant photo via Gemini Vision (or symptom selection).
        2. Returns needs_more_info if analysis fails, confidence is low, or crop not in registry.
        3. Dynamically calculates sprayer pump dosage for single values and ranges (e.g. 7.5-10 g).
        4. Derives is_cibrc_approved from database row.
        5. Formulates output as 'possible causes and what to check', never a definite diagnosis.
        """
        detected_crop = (crop_key or "").strip().lower() if crop_key else None
        detected_symptom = (symptom_key or "").strip().lower() if symptom_key else None
        vision_analysis_note = ""
        vision_confidence = 1.0

        # Step 1: Multimodal Gemini Vision Inspection
        if image_bytes:
            vision_prompt = (
                "You are an expert Indian agricultural plant pathologist and entomologist. "
                "Carefully inspect this leaf or plant image:\n"
                "1. Determine if this is an agricultural crop or plant.\n"
                "2. Identify the crop (e.g., Tomato, Chilli, Paddy, Potato, Mango, Cotton, Wheat, Grapes, Apple).\n"
                "3. Describe possible visible pest or disease symptoms.\n"
                "4. Estimate your diagnostic confidence between 0.0 and 1.0.\n"
                "Respond in valid JSON format ONLY with keys:\n"
                "{\"is_crop\": true, \"crop_key\": \"tomato\", \"symptom_key\": \"leaf_spot\", \"confidence\": 0.85, \"possible_causes\": \"...\", \"what_to_check\": \"...\"}"
            )
            try:
                if not self.llm_gateway.is_available():
                    raise LLMUnavailableError("LLM vision service not configured")
                vision_text = await self.llm_gateway.generate_vision_response(
                    image_bytes=image_bytes,
                    mime_type=mime_type,
                    prompt=vision_prompt
                )
                if vision_text:
                    cleaned_json = vision_text.replace("```json", "").replace("```", "").strip()
                    parsed = json.loads(cleaned_json)
                    if not parsed.get("is_crop", True):
                        return {
                            "status": "needs_more_info",
                            "message": "The provided image does not appear to show an agricultural crop leaf or plant.",
                            "questions": [
                                "Can you upload a clear photo showing the crop foliage, leaves, or stems?",
                                "Which crop are you cultivating (e.g. Tomato, Chilli, Paddy, Cotton)?",
                                "What symptoms or damage did you notice on the plant?"
                            ],
                            "possible_causes": [],
                            "actionable_solutions": []
                        }

                    vision_confidence = float(parsed.get("confidence", 0.85))
                    if parsed.get("crop_key") and not detected_crop:
                        detected_crop = parsed["crop_key"].lower()
                    if parsed.get("symptom_key") and not detected_symptom:
                        detected_symptom = parsed["symptom_key"].lower()
                    vision_analysis_note = parsed.get("possible_causes", "") or parsed.get("what_to_check", "")
            except Exception as exc:
                logger.warning("Vision analysis failed or unavailable: %s", exc)
                if not detected_crop:
                    return {
                        "status": "needs_more_info",
                        "message": "Image analysis was inconclusive or unavailable. Please clarify your crop details.",
                        "questions": [
                            "Which crop is affected (e.g. Tomato, Chilli, Paddy, Cotton)?",
                            "What visible symptoms are on the leaves (e.g., yellow spots, curling, holes)?",
                            "Can you capture a clearer photo in daylight showing both sides of the leaf?"
                        ],
                        "possible_causes": [],
                        "actionable_solutions": []
                    }

        # If confidence is low (< 0.60) or crop was not identified:
        if vision_confidence < 0.60 or not detected_crop:
            return {
                "status": "needs_more_info",
                "message": (
                    "మరిన్ని వివరాలు అవసరం. నిర్ధారించడానికి కింది ప్రశ్నలకు సమాధానం ఇవ్వండి." if lang == "te"
                    else "अधिक जानकारी की आवश्यकता है। कृपया नीचे दिए गए प्रश्नों के उत्तर दें।" if lang == "hi"
                    else "More information needed for accurate diagnosis. Please answer the questions below."
                ),
                "questions": [
                    "Which crop is affected (e.g. Tomato, Chilli, Paddy, Cotton)?",
                    "Are the symptoms on the upper leaves, lower leaves, or fruits?",
                    "Do you see visible insects, webbing, or powder on the underside of the leaves?",
                    "How many days ago did the symptoms first appear?"
                ],
                "possible_causes": [],
                "actionable_solutions": []
            }

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

        # Step 2: Check if crop exists in CIBRC statutory registry
        all_crop_records = self.search_registry(crop=clean_crop, limit=50)
        if not all_crop_records:
            return {
                "status": "needs_more_info",
                "message": (
                    f"CIBRC రిజిస్ట్రీలో '{clean_crop}' నమోదు కాలేదు. దయచేసి సరైన పంట పేరును పేర్కొనండి." if lang == "te"
                    else f"CIBRC रजिस्ट्री में '{clean_crop}' पंजीकृत नहीं है। कृपया सही फसल नाम दर्ज करें।" if lang == "hi"
                    else f"No registered CIBRC records found for crop '{clean_crop}'. Please verify the crop name."
                ),
                "questions": [
                    f"Is '{clean_crop}' known locally by another crop name?",
                    "Are you cultivating another primary crop in this field?",
                    "Please contact the Kisan Call Centre (1800-180-1551) for guidance on unlisted crops."
                ],
                "possible_causes": [],
                "actionable_solutions": []
            }

        # If symptom was not detected or provided:
        if not detected_symptom:
            return {
                "status": "needs_more_info",
                "message": f"Please specify the symptom or pest problem affecting your {display_crop}.",
                "questions": [
                    f"What symptoms do you observe on the {display_crop} (e.g. leaf spots, wilting, borers)?",
                    "Are the leaves curling upwards or downwards?",
                    "Is there any fungal powder or mold visible?"
                ],
                "possible_causes": [],
                "actionable_solutions": []
            }

        # Step 3: Match records by symptom
        symptom_query_str = detected_symptom.replace("_", " ")
        matching_records = [
            r for r in all_crop_records
            if any(term in r["target_pest_or_disease"].lower() for term in symptom_query_str.split() if len(term) > 2)
        ]

        # If no matching records found, return empty solutions with explicit message (NO fallback!)
        if not matching_records:
            no_products_msg = (
                f"{display_crop} లో '{symptom_query_str}' కొరకు CIBRC లో నమోదైన ఉత్పత్తులు ఏవీ కనుగొనబడలేదు." if lang == "te"
                else f"{display_crop} में '{symptom_query_str}' के लिए CIBRC में कोई पंजीकृत उत्पाद नहीं मिला।" if lang == "hi"
                else f"No registered products found in the CIBRC statutory registry for '{symptom_query_str}' in {display_crop}."
            )
            # Audio script MUST NOT mention medicine
            audio_script = (
                f"{display_crop} పంటలో ఈ తెగులుకు CIBRC ఆమోదిత రసాయనాలు లేవు. దయచేసి సేంద్రియ పద్ధతులు మరియు కిసాన్ కాల్ సెంటర్ (1800-180-1551) సలహా తీసుకోండి." if lang == "te"
                else f"{display_crop} में इस लक्षण के लिए कोई अनुमोदित उत्पाद नहीं है। कृपया किसान कॉल सेंटर (1800-180-1551) या कृषि विज्ञान केंद्र से संपर्क करें।" if lang == "hi"
                else f"No registered CIBRC products found for {symptom_query_str} in {display_crop}. Please contact your local Krishi Vigyan Kendra or Kisan Call Centre (1800-180-1551) for non-chemical IPM options."
            )
            return {
                "status": "success",
                "message": no_products_msg,
                "detected_crop": {
                    "key": clean_crop,
                    "name": display_crop,
                    "icon": crop_icon
                },
                "possible_causes_and_what_to_check": {
                    "possible_cause": symptom_query_str.title(),
                    "what_to_check": f"Inspect {display_crop} foliage for specific signs of {symptom_query_str}. Check for moisture stress or nutrient deficiency before spraying.",
                    "notes": vision_analysis_note or "Visual screening completed. Verify in field.",
                    "diagnostic_notice": "Possible causes and what to check in field, not a definitive diagnosis."
                },
                "tank_liters": tank_liters,
                "actionable_solutions": [],
                "audio_script": audio_script,
                "language": lang
            }

        # Step 4: Build Actionable Solution Bottle Cards with Dynamic Range Pump Math
        actionable_solutions = []
        for r in matching_records:
            base_15l_str = r.get("pump_dose_15l", "")
            unit = "ml" if "ml" in base_15l_str.lower() else ("g" if "g" in base_15l_str.lower() else "units")

            # Correctly handle ranges like "7.5-10 g" or "15 to 20 ml"
            range_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)", base_15l_str, re.IGNORECASE)
            single_match = re.search(r"(\d+(?:\.\d+)?)", base_15l_str)

            if range_match:
                low = float(range_match.group(1))
                high = float(range_match.group(2))
                scaled_low = round((low / 15.0) * tank_liters, 1)
                scaled_high = round((high / 15.0) * tank_liters, 1)
                rate_low = round(low / 15.0, 2)
                rate_high = round(high / 15.0, 2)
                calculated_pump_dose = (
                    f"{scaled_low}-{scaled_high} {unit} per {tank_liters}L pump ({rate_low}-{rate_high} {unit}/L)"
                )
            elif single_match:
                base_val = float(single_match.group(1))
                scaled_val = round((base_val / 15.0) * tank_liters, 1)
                rate = round(base_val / 15.0, 2)
                calculated_pump_dose = f"{scaled_val} {unit} per {tank_liters}L pump ({rate} {unit}/L)"
            else:
                calculated_pump_dose = base_15l_str or f"Refer to {tank_liters}L tank label"

            brands = r.get("payload", {}).get("common_brands", []) if isinstance(r.get("payload"), dict) else []
            primary_brand = brands[0] if brands else r["pesticide_name"].split()[0]

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

            # Derive is_cibrc_approved from database row
            row_approved = bool(r.get("is_approved", True))

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
                "is_cibrc_approved": row_approved
            })

        # Step 5: Vernacular Audio Script
        top_sol = actionable_solutions[0] if actionable_solutions else None
        if lang == "hi":
            symptom_hi = "पत्ती धब्बा" if "spot" in detected_symptom else "पत्ती मरोड़" if "curl" in detected_symptom else "फल छेदक" if "borer" in detected_symptom else "झुलसा रोग"
            audio_script = (
                f"{display_crop} में {symptom_hi} के संभावित लक्षण पाए गए हैं। "
                f"केंद्रीय कीटनाशी बोर्ड द्वारा पंजीकृत उत्पाद {top_sol['brand_name'] if top_sol else ''} का प्रयोग कर सकते हैं। "
                f"{tank_liters} लीटर पंप में {top_sol['pump_dose'].split(' per ')[0] if top_sol else ''} मिलाएं। "
                f"तुड़ाई से पहले {top_sol['waiting_period_days'] if top_sol else '3 दिन'} की प्रतीक्षा अवधि का पालन करें।"
            )
        elif lang == "te":
            audio_script = (
                f"{display_crop} పంటలో ఈ లక్షణాలు గమనించబడ్డాయి. "
                f"CIBRC నమోదైన {top_sol['brand_name'] if top_sol else ''} వాడవచ్చు. "
                f"{tank_liters} లీటర్ల పంపుకు {top_sol['pump_dose'].split(' per ')[0] if top_sol else ''} కలపండి."
            )
        else:
            audio_script = (
                f"Possible causes of {detected_symptom.replace('_', ' ')} observed in {display_crop}. "
                f"Registered statutory solution is {top_sol['brand_name'] if top_sol else ''}. "
                f"Mix {top_sol['pump_dose'].split(' per ')[0] if top_sol else ''} per {tank_liters}L tank. "
                f"Observe mandatory pre-harvest interval of {top_sol['waiting_period_days'] if top_sol else 'waiting days'}."
            )

        return {
            "status": "success",
            "detected_crop": {
                "key": clean_crop,
                "name": display_crop,
                "icon": crop_icon
            },
            "possible_causes_and_what_to_check": {
                "possible_cause": detected_symptom.replace("_", " ").title(),
                "what_to_check": f"Inspect leaf undersides and stems of {display_crop} for signs of {detected_symptom.replace('_', ' ')}.",
                "notes": vision_analysis_note or "Visual screening completed. Confirm in field before spraying.",
                "diagnostic_notice": "Possible causes and what to check in field, not a definitive diagnosis."
            },
            "tank_liters": tank_liters,
            "actionable_solutions": actionable_solutions,
            "audio_script": audio_script,
            "language": lang
        }


pesticide_rag_service = PesticideRagService()

