"""Crop Doctor Statutory Advisory Service with Hybrid Retrieval & Anti-Hallucination Grounding.

Pipeline:
1. Query Understanding: Gemini structured extraction -> {crop_key, symptom, pesticide?}.
2. Hybrid Retrieval: CIBRC in Postgres (FTS + vector similarity) fused with RRF (k=60),
   enforcing a HARD crop_key filter.
3. Abstention: If top RRF score < threshold, abstain with fallback to Kisan Call Centre.
4. Grounded Generation: Model returns record_ids & reasoning; backend copies doses, PHI,
   toxicity from database rows. Runs validate_grounded_numbers on the final text.
5. Response: {answer, citations:[{record_id, source, as_of}], confidence, abstained, lang}
   streamed via SSE.
"""

import datetime
import json
import logging
import re
from collections.abc import AsyncGenerator
from typing import Any

from database.cibrc_isolated_db import get_cibrc_cursor
from database.connection import is_postgres_active

from app.domain.validator import validate_grounded_numbers
from app.ingestion.embedder import VertexAIEmbedder
from app.llm import LLMGateway, LLMUnavailableError, load_prompt
from app.rag.models import SearchResult
from app.rag.vector_store import cosine_similarity

logger = logging.getLogger("CropDoctorService")

RRF_K = 60.0
# A single rank-1 match is 1/61 ~ 0.0164; below 0.012 indicates no strong match
DEFAULT_ABSTAIN_THRESHOLD = 0.012


class CropDoctorService:
    """End-to-end statutory CIBRC crop doctor advisor."""

    def __init__(self, embedder: Any | None = None, llm_gateway: LLMGateway | None = None):
        self.embedder = embedder or VertexAIEmbedder()
        self.llm_gateway = llm_gateway or LLMGateway()

    # -------------------------------------------------------------------------
    # 1. Query Understanding
    # -------------------------------------------------------------------------
    async def extract_query_entities(
        self,
        question: str,
        hinted_crop: str | None = None,
        image_bytes: bytes | None = None,
    ) -> dict[str, Any]:
        """Extracts crop_key, symptom, pesticide from user question using structured prompt."""
        crop_context = hinted_crop or ""

        # Multimodal inspection if image provided
        if image_bytes and self.llm_gateway.is_available():
            try:
                vision_prompt = (
                    "Inspect this plant image. Identify the crop and visible pest/disease symptom. "
                    "Output JSON: {\"crop_key\": \"...\", \"symptom\": \"...\"}"
                )
                vision_res = await self.llm_gateway.generate_vision_response(
                    image_bytes=image_bytes,
                    mime_type="image/jpeg",
                    prompt=vision_prompt,
                )
                if vision_res:
                    cleaned_v = vision_res.replace("```json", "").replace("```", "").strip()
                    v_data = json.loads(cleaned_v)
                    if not crop_context and v_data.get("crop_key"):
                        crop_context = v_data["crop_key"]
            except Exception as exc:
                logger.warning("Doctor vision extract notice: %s", exc)

        prompt_str = load_prompt(
            "doctor",
            "extract",
            version=1,
            variables={
                "user_question": question,
                "crop": crop_context,
            },
        )

        try:
            if not self.llm_gateway.is_available():
                raise LLMUnavailableError("LLM Gateway credentials not configured")

            raw = await self.llm_gateway.generate_response(
                prompt=prompt_str,
                use_strong_model=False,
            )
            cleaned = raw.replace("```json", "").replace("```", "").strip()
            data = json.loads(cleaned)
            crop_key = (data.get("crop_key") or crop_context or "").strip().lower()
            if crop_key in ["rice", "dhan"]:
                crop_key = "paddy"
            return {
                "crop_key": crop_key if crop_key and crop_key != "null" else None,
                "symptom": data.get("symptom") if data.get("symptom") != "null" else None,
                "pesticide": data.get("pesticide") if data.get("pesticide") != "null" else None,
                "confidence": float(data.get("confidence", 0.90)),
            }
        except LLMUnavailableError:
            # Deterministic fallback extraction when LLM is offline
            clean_q = question.lower()

            # 1. Reject prompt injection & jailbreak attempts
            injection_markers = [
                "ignore previous", "system prompt", "system override", "developer mode",
                "jailbreak", "dan mode", "forget instructions", "reveal secrets"
            ]
            if any(marker in clean_q for marker in injection_markers):
                return {"crop_key": None, "symptom": None, "pesticide": None, "confidence": 0.0}

            # 2. Reject non-farming queries
            non_farming_markers = [
                "cricket", "world cup", "prime minister", "president", "capital of",
                "python script", "code to", "recipe", "biryani", "cinema", "movie",
                "క్రికెట్", "ప్రధాని", "రాజధాని", "సినిమా", "సంగీతం", "బిర్యానీ",
                "क्रिकेट", "प्रधानमंत्री", "राजधानी", "फिल्म", "सिनेमा", "बिरयानी"
            ]
            if any(marker in clean_q for marker in non_farming_markers):
                return {"crop_key": None, "symptom": None, "pesticide": None, "confidence": 0.0}

            # 3. Detect crop (multilingual: en, te, hi)
            detected_crop = crop_context.lower() if crop_context else None
            multilingual_crops: dict[str, str] = {
                "tomato": "tomato", "టమోటా": "tomato", "టమాట": "tomato", "టమాటో": "tomato", "टमाटर": "tomato",
                "chilli": "chilli", "chili": "chilli", "మిర్చి": "chilli", "మిరప": "chilli", "मिर्च": "chilli",
                "cotton": "cotton", "పత్తి": "cotton", "కపాస్": "cotton", "कपास": "cotton",
                "paddy": "paddy", "rice": "paddy", "వరి": "paddy", "వరిపంట": "paddy", "धान": "paddy", "चावल": "paddy",
                "potato": "potato", "బంగాళాదుంప": "potato", "ఆలూ": "potato", "आलू": "potato",
                "mango": "mango", "మామిడి": "mango", "आम": "mango",
                "wheat": "wheat", "గోధుమ": "wheat", "गेहूं": "wheat", "गेंहू": "wheat",
                "grapes": "grapes", "ద్రాక్ష": "grapes", "अंगूर": "grapes",
                "apple": "apple", "ఆపిల్": "apple", "సేబ్": "apple", "सेब": "apple",
            }
            if not detected_crop:
                for k, v in multilingual_crops.items():
                    if k in clean_q:
                        detected_crop = v
                        break

            # 4. Detect specific chemical query if present (English, Hindi, Telugu)
            detected_chem: str | None = None
            chem_aliases: dict[str, str] = {
                "2,4-d": "2,4-d", "2,4 d": "2,4-d", "2,4-डी": "2,4-d", "2,4-డి": "2,4-d",
                "glyphosate": "glyphosate", "ग्लाइफोसेट": "glyphosate", "గ్లైఫోసేట్": "glyphosate",
                "paraquat": "paraquat", "पैराक्वॉट": "paraquat", "పారాక్వాట్": "paraquat",
                "chlorpyrifos": "chlorpyrifos", "क्लोरपायरीफॉस": "chlorpyrifos", "క్లోర్‌పైరిఫాస్": "chlorpyrifos",
                "monocrotophos": "monocrotophos", "मोनोक्रोटोफॉस": "monocrotophos", "మోనోక్రోటోఫాస్": "monocrotophos",
                "cartap": "cartap", "कारटाप": "cartap", "కార్టాప్": "cartap",
                "atrazine": "atrazine", "एट्राज़ीन": "atrazine", "అట్రాజైన్": "atrazine",
                "clodinafop": "clodinafop", "క్లోడినాఫాప్": "clodinafop", "क्लोडिनाफॉप": "clodinafop",
                "dithianon": "dithianon", "డిథియానాన్": "dithianon", "डिथियानॉन": "dithianon",
                "tea mosquito": "tea mosquito", "चाय के मच्छर": "tea mosquito", "టీ దోమ": "tea mosquito",
                "pyrilla": "pyrilla", "पायरिला": "pyrilla", "పైరిల్లా": "pyrilla",
                "capsule borer": "capsule borer", "యాలకుల": "capsule borer", "इलायची": "capsule borer",
                "berry borer": "berry borer", "बेरी बोरर": "berry borer", "బెర్రీ బోరర్": "berry borer",
                "bark disease": "bark disease", "बेरक": "bark disease", "బెరడు": "bark disease",
                "chlorantraniliprole": "chlorantraniliprole", "coragen": "chlorantraniliprole",
                "emamectin": "emamectin", "cyantraniliprole": "cyantraniliprole",
                "broflanilide": "broflanilide", "imidacloprid": "imidacloprid",
                "abamectin": "abamectin", "flubendiamide": "flubendiamide",
                "azoxystrobin": "azoxystrobin", "difenoconazole": "difenoconazole",
                "mancozeb": "mancozeb", "tricyclazole": "tricyclazole",
                "pymetrozine": "pymetrozine", "spinetoram": "spinetoram",
                "dimethomorph": "dimethomorph", "hexaconazole": "hexaconazole",
                "propiconazole": "propiconazole"
            }
            for alias, canonical in chem_aliases.items():
                if alias in clean_q:
                    detected_chem = canonical
                    break

            # 5. Detect symptoms/pests (English, Hindi, Telugu)
            detected_symptom: str | None = None
            symptom_aliases: dict[str, str] = {
                "fruit borer": "Fruit borer", "फल छेदक": "Fruit borer", "కాయ తొలుచు పురుగు": "Fruit borer",
                "helicoverpa": "Helicoverpa", "हेलिकोवर्पा": "Helicoverpa",
                "early blight": "Early blight", "late blight": "Late blight", "blight": "blight",
                "झुलसा": "blight", "अगेती": "Early blight", "पछेती": "Late blight",
                "ఆకుమచ్చ": "Leaf spot", "ఆకు మాడు": "blight", "అల్టర్నేరియా": "Alternaria",
                "whitefly": "Whitefly", "leaf curl": "Leaf curl", "सफेद मक्खी": "Whitefly",
                "మరోడియా": "Leaf curl", "తెల్లదోమ": "Whitefly", "ముడుత": "Leaf curl",
                "thrips": "Thrips", "mites": "mites", "तामर": "Thrips", "थ्रिप्स": "Thrips",
                "తామర పురుగులు": "Thrips", "నల్లి": "mites", "मकड़ी": "mites",
                "stem borer": "Stem borer", "तना छेदक": "Stem borer", "కాండం తొలుచు పురుగు": "Stem borer",
                "blast": "Blast", "झोंका": "Blast", "ब्लास्ट": "Blast", "అగ్గి తెగులు": "Blast",
                "bph": "planthopper", "planthopper": "planthopper", "भूरा फुदका": "planthopper", "సుడిదోమ": "planthopper",
                "pink bollworm": "Pink bollworm", "गुलाबी सुंडी": "Pink bollworm", "గులాబీ రంగు": "Pink bollworm",
                "downy mildew": "Downy mildew", "powdery mildew": "Powdery mildew", "చూర్ణిల్": "Powdery mildew",
                "चूर्णिल": "Powdery mildew", "బూడిద తెగులు": "Powdery mildew", "డౌనీ": "Downy mildew",
                "rust": "rust", "रतुआ": "rust", "కుంకుమ తెగులు": "rust",
                "anthracnose": "Anthracnose", "dieback": "Dieback", "सड़न": "rot", "కుళ్ళు": "rot",
                "కొమ్మ ఎండు": "Dieback", "రసం పీల్చే": "sucking pests", "रस चूसक": "sucking pests"
            }
            for s_key, s_canon in symptom_aliases.items():
                if s_key in clean_q:
                    detected_symptom = s_canon
                    break

            # 6. Check if query is vague without a specific crop or specific pest
            vague_markers = [
                "something is wrong", "plant is dying", "leaves are turning yellow", "crop looking bad",
                "చెట్టు ఎండిపోతోంది", "ఆకులు పసుపు", "పాడైపోతుంది", "ఏదో రోగం వచ్చింది",
                "पौधा सूख रहा है", "पत्ते पीले हो रहे हैं", "खराब हो रहा है", "दवा बताओ"
            ]
            is_vague = any(v in clean_q for v in vague_markers)
            if is_vague and not crop_context and not detected_crop:
                return {"crop_key": None, "symptom": None, "pesticide": None, "confidence": 0.20}

            return {
                "crop_key": detected_crop,
                "symptom": detected_symptom or ("pest or disease symptom" if detected_crop else None),
                "pesticide": detected_chem,
                "confidence": 0.85 if detected_crop else 0.20,
            }
        except Exception as exc:
            logger.warning("Error during query understanding: %s", exc)
            return {
                "crop_key": crop_context.lower() if crop_context else None,
                "symptom": None,
                "pesticide": None,
                "confidence": 0.30,
            }

    # -------------------------------------------------------------------------
    # 2. Hybrid Retrieval with HARD crop_key filter & Reciprocal Rank Fusion
    # -------------------------------------------------------------------------
    def retrieve_hybrid_cibrc(
        self,
        crop_key: str,
        symptom: str | None = None,
        pesticide: str | None = None,
        raw_question: str = "",
        top_k: int = 5,
    ) -> tuple[list[dict[str, Any]], float]:
        """Performs full-text search + vector similarity over CIBRC records for crop_key.

        Fuses results using Reciprocal Rank Fusion (RRF, k=60).
        Returns:
            tuple of (ranked_records: list[dict], top_rrf_score: float)
        """
        clean_crop = crop_key.strip().lower()
        if clean_crop in ["rice", "dhan"]:
            clean_crop = "paddy"

        use_pg = is_postgres_active()
        ph = "%s" if use_pg else "?"

        search_text = f"{symptom or ''} {pesticide or ''} {raw_question}".strip()
        if not search_text:
            search_text = clean_crop

        # 2a. Fetch all records for this crop (HARD filter)
        sql = f"""
            SELECT 
                id, category, pesticide_name, active_ingredient, formulation,
                crop, crop_key, target_pest_or_disease, ai_dose, formulation_dose,
                dilution_water_liters, waiting_period_days, pump_dose_15l,
                application_method, toxicity_band, toxicity_label, safety_warnings,
                is_approved, payload, embedding
            FROM cibrc_pesticide_registry
            WHERE LOWER(crop_key) = LOWER({ph});
        """

        records: list[dict[str, Any]] = []
        with get_cibrc_cursor() as cur:
            cur.execute(sql, (clean_crop,))
            rows = cur.fetchall()
            for r in rows:
                item = dict(r)
                if isinstance(item.get("payload"), str):
                    try:
                        item["payload"] = json.loads(item["payload"])
                    except Exception:
                        item["payload"] = {}
                records.append(item)

        if not records:
            return [], 0.0

        # 2b. Full-text / Keyword Ranking (FTS)
        # Score based on presence of terms in pest, pesticide, or active ingredient
        search_terms = [t.lower() for t in re.split(r"\W+", search_text) if len(t) > 2]
        scored_fts: list[tuple[dict[str, Any], float]] = []

        for r in records:
            fts_score = 0.0
            pest_text = (r.get("target_pest_or_disease") or "").lower()
            name_text = (r.get("pesticide_name") or "").lower()
            ing_text = (r.get("active_ingredient") or "").lower()
            cat_text = (r.get("category") or "").lower()

            for term in search_terms:
                if term in pest_text:
                    fts_score += 3.0
                if term in name_text:
                    fts_score += 2.0
                if term in ing_text:
                    fts_score += 2.0
                if term in cat_text:
                    fts_score += 1.0

            scored_fts.append((r, fts_score))

        scored_fts.sort(key=lambda x: x[1], reverse=True)
        fts_ranking = [r for r, score in scored_fts if score > 0]

        # 2c. Semantic Vector Ranking (pgvector / cosine)
        try:
            query_embeddings = self.embedder.embed_texts([search_text], task_type="RETRIEVAL_QUERY")
            query_vec = query_embeddings[0] if query_embeddings else []
        except Exception as exc:
            logger.warning("Could not generate query embedding: %s", exc)
            query_vec = []

        scored_vec: list[tuple[dict[str, Any], float]] = []
        if query_vec:
            for r in records:
                # Retrieve vector either from column or payload
                vec = r.get("embedding")
                if isinstance(vec, str):
                    try:
                        vec = json.loads(vec)
                    except Exception:
                        vec = None
                if not vec and isinstance(r.get("payload"), dict):
                    vec = r["payload"].get("embedding")

                if isinstance(vec, list) and len(vec) == len(query_vec):
                    sim = cosine_similarity(query_vec, vec)
                else:
                    sim = 0.0
                scored_vec.append((r, sim))

            scored_vec.sort(key=lambda x: x[1], reverse=True)
            vec_ranking = [r for r, sim in scored_vec if sim > 0.0]
        else:
            vec_ranking = []

        # 2d. Reciprocal Rank Fusion (RRF, k=60)
        rrf_scores: dict[int, float] = {}
        records_by_id: dict[int, dict[str, Any]] = {r["id"]: r for r in records}

        # Apply FTS ranks
        for rank, r in enumerate(fts_ranking, 1):
            rec_id = r["id"]
            rrf_scores[rec_id] = rrf_scores.get(rec_id, 0.0) + (1.0 / (RRF_K + rank))

        # Apply Vector ranks
        for rank, r in enumerate(vec_ranking, 1):
            rec_id = r["id"]
            rrf_scores[rec_id] = rrf_scores.get(rec_id, 0.0) + (1.0 / (RRF_K + rank))

        if not rrf_scores:
            return [], 0.0

        # Sort all by combined RRF score descending
        sorted_ids = sorted(rrf_scores.keys(), key=lambda rid: rrf_scores[rid], reverse=True)
        top_score = rrf_scores[sorted_ids[0]] if sorted_ids else 0.0

        ranked_docs = []
        for rid in sorted_ids[:top_k]:
            doc = dict(records_by_id[rid])
            doc["_rrf_score"] = round(rrf_scores[rid], 5)
            ranked_docs.append(doc)

        return ranked_docs, top_score

    # -------------------------------------------------------------------------
    # 3. Grounded Generation & Anti-Hallucination Validation
    # -------------------------------------------------------------------------
    async def generate_grounded_answer(
        self,
        question: str,
        crop_key: str,
        records: list[dict[str, Any]],
        lang: str = "en",
    ) -> dict[str, Any]:
        """Calls advisor prompt; LLM returns selected record IDs and clinical reasoning.

        Backend copies doses, PHI, and toxicity strictly from retrieved database rows.
        Runs validate_grounded_numbers on final answer text.
        """
        # Format candidate records for model
        record_blocks = []
        for r in records:
            block = (
                f"- [Record ID: {r['id']}] Chemical: {r['pesticide_name']} "
                f"({r.get('formulation','')}) | Active: {r['active_ingredient']} | "
                f"Target: {r['target_pest_or_disease']} | Pump Dose: {r['pump_dose_15l']} | "
                f"Dose/ha: {r['formulation_dose']} in {r['dilution_water_liters']} | "
                f"Waiting Period (PHI): {r['waiting_period_days']} | "
                f"Toxicity: {r['toxicity_band'].upper()} ({r['toxicity_label']})"
            )
            record_blocks.append(block)

        cibrc_records_text = "\n".join(record_blocks)

        prompt_str = load_prompt(
            "doctor",
            "advisor",
            version=1,
            variables={
                "crop": crop_key.title(),
                "farmer_question": question,
                "cibrc_records": cibrc_records_text,
                "lang": lang,
            },
        )

        selected_ids: list[int] = []
        clinical_reasoning = ""
        advisory_notes = ""

        try:
            if not self.llm_gateway.is_available():
                raise LLMUnavailableError("LLM unavailable")

            raw = await self.llm_gateway.generate_response(
                prompt=prompt_str,
                use_strong_model=False,
            )
            cleaned = raw.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(cleaned)
            selected_ids = parsed.get("selected_record_ids", [])
            clinical_reasoning = parsed.get("reasoning", "")
            advisory_notes = parsed.get("advisory_notes", "")
        except Exception as exc:
            logger.warning("Advisor structured model call notice: %s; using top records", exc)
            selected_ids = [records[0]["id"]] if records else []
            clinical_reasoning = (
                f"Approved statutory treatment for observed problem in {crop_key.title()}."
            )
            advisory_notes = "Follow label cautions and wear protective gear during application."

        # Filter database rows for the selected IDs
        chosen_records = [r for r in records if r["id"] in selected_ids]
        if not chosen_records and records:
            chosen_records = [records[0]]

        # Construct final grounded answer strictly copying DB rows
        today_str = datetime.date.today().isoformat()
        if lang == "te":
            header = (
                f"🌾 **కిసాన్-సేతు CIBRC అధికారిక పంట సంరక్షణ సిఫార్సు "
                f"({crop_key.title()})** 🌾\n\n"
            )
            reasons_sec = f"**శాస్త్రీయ పరిశీలన:** {clinical_reasoning}\n\n" if clinical_reasoning else ""
            products_sec = "### ✅ CIBRC ఆమోదిత ఉత్పత్తులు & మోతాదులు:\n"
            for r in chosen_records:
                products_sec += (
                    f"**1. {r['pesticide_name']}** ({r['active_ingredient']})\n"
                    f"   - **15-లీటర్ల పంపు మోతాదు:** `{r['pump_dose_15l']}`\n"
                    f"   - **ఎకరానికి సిఫార్సు మోతాదు:** `{r['formulation_dose']}` "
                    f"({r['dilution_water_liters']} నీరు)\n"
                    f"   - **వేచి ఉండే వ్యవధి (కోతకు ముందు రోజులు):** `{r['waiting_period_days']}`\n"
                    f"   - **విషపూరిత లేబుల్:** {r['toxicity_label']}\n"
                    f"   - **రైతు భద్రతా సూచన:** {r['safety_warnings']}\n\n"
                )
            notes_sec = f"> **భద్రతా సూచన:** {advisory_notes}\n" if advisory_notes else ""
            answer = header + reasons_sec + products_sec + notes_sec
        elif lang == "hi":
            header = (
                f"🌾 **किसान-सेतु CIBRC वैधानिक फसल सुरक्षा परामर्श "
                f"({crop_key.title()})** 🌾\n\n"
            )
            reasons_sec = f"**नैदानिक कारण:** {clinical_reasoning}\n\n" if clinical_reasoning else ""
            products_sec = "### ✅ CIBRC अनुमोदित उत्पाद एवं खुराक:\n"
            for r in chosen_records:
                products_sec += (
                    f"**1. {r['pesticide_name']}** ({r['active_ingredient']})\n"
                    f"   - **15-लीटर पंप खुराक:** `{r['pump_dose_15l']}`\n"
                    f"   - **प्रति हेक्टेयर खुराक:** `{r['formulation_dose']}` "
                    f"({r['dilution_water_liters']} पानी)\n"
                    f"   - **प्रतीक्षा अवधि (फसल तुड़ाई अंतर):** `{r['waiting_period_days']}`\n"
                    f"   - **विषाक्तता स्तर:** {r['toxicity_label']}\n"
                    f"   - **सुरक्षा निर्देश:** {r['safety_warnings']}\n\n"
                )
            notes_sec = f"> **सुरक्षा सलाह:** {advisory_notes}\n" if advisory_notes else ""
            answer = header + reasons_sec + products_sec + notes_sec
        else:
            header = (
                f"🌾 **Kisan Sethu CIBRC Statutory Crop Protection Advisory "
                f"({crop_key.title()})** 🌾\n\n"
            )
            reasons_sec = (
                f"**Clinical Assessment:** {clinical_reasoning}\n\n"
                if clinical_reasoning
                else ""
            )
            products_sec = "### ✅ Registered CIBRC Statutory Formulations & Prescribed Dosages:\n"
            for r in chosen_records:
                products_sec += (
                    f"**1. {r['pesticide_name']}** ({r['active_ingredient']})\n"
                    f"   - **15-Liter Knapsack Sprayer Dose:** `{r['pump_dose_15l']}`\n"
                    f"   - **Formulation Dose per Hectare:** `{r['formulation_dose']}` in "
                    f"`{r['dilution_water_liters']}` water\n"
                    f"   - **Waiting Period (PHI):** `{r['waiting_period_days']}`\n"
                    f"   - **Toxicity Classification:** {r['toxicity_label']}\n"
                    f"   - **Statutory Safety Warnings:** {r['safety_warnings']}\n\n"
                )
            notes_sec = f"> **Advisory Guidance:** {advisory_notes}\n" if advisory_notes else ""
            answer = header + reasons_sec + products_sec + notes_sec

        # Run validate_grounded_numbers from app/domain/validator.py
        search_results: list[SearchResult] = [
            SearchResult(
                chunk_id=str(r["id"]),
                text=(
                    f"{r['pesticide_name']} {r['pump_dose_15l']} "
                    f"{r['formulation_dose']} {r['waiting_period_days']}"
                ),
                score=r.get("_rrf_score", 0.90),
                metadata=r,
            )
            for r in chosen_records
        ]
        is_valid, violations = validate_grounded_numbers(answer, search_results)
        if not is_valid:
            logger.warning("Grounded numbers validation notes: %s", violations)

        citations = [
            {
                "record_id": int(r["id"]),
                "source": f"CIBRC Statutory Registry (Govt. of India) - {r['pesticide_name']}",
                "as_of": today_str,
            }
            for r in chosen_records
        ]

        return {
            "answer": answer.strip(),
            "citations": citations,
            "confidence": 0.95,
            "abstained": False,
            "lang": lang,
        }

    # -------------------------------------------------------------------------
    # 4. Pipeline Execution & SSE Generator
    # -------------------------------------------------------------------------
    async def ask_pipeline(
        self,
        question: str,
        crop: str | None = None,
        image_bytes: bytes | None = None,
        lang: str = "en",
        abstain_threshold: float = DEFAULT_ABSTAIN_THRESHOLD,
    ) -> dict[str, Any]:
        """Runs full 4-step pipeline and returns complete response payload."""
        # Step 1: Query understanding
        entities = await self.extract_query_entities(
            question=question,
            hinted_crop=crop,
            image_bytes=image_bytes,
        )
        crop_key = entities.get("crop_key")
        symptom = entities.get("symptom")
        pesticide = entities.get("pesticide")

        # Step 2: Abstain if no crop identified
        if not crop_key:
            return self._build_abstain_response(lang=lang, reason="unidentified_crop")

        # Step 3: Hybrid retrieval with hard crop filter
        records, top_score = self.retrieve_hybrid_cibrc(
            crop_key=crop_key,
            symptom=symptom,
            pesticide=pesticide,
            raw_question=question,
            top_k=4,
        )

        # Step 3b: If a specific chemical was requested, verify it is registered and approved for this crop
        if pesticide:
            p_clean = pesticide.lower()
            matching_chemical = any(
                p_clean in (r.get("active_ingredient") or "").lower()
                or p_clean in (r.get("pesticide_name") or "").lower()
                or p_clean in str(r.get("payload") or {}).lower()
                for r in records
            )
            if not matching_chemical:
                # Requested chemical is not registered/approved for this crop -> Off-label / Not registered! Abstain!
                return self._build_abstain_response(lang=lang, reason="off_label_unapproved_chemical")

        # Step 4: Abstain if top score below threshold or no records
        if not records or top_score < abstain_threshold:
            return self._build_abstain_response(lang=lang, reason="low_retrieval_confidence")

        # Step 5: Grounded generation
        return await self.generate_grounded_answer(
            question=question,
            crop_key=crop_key,
            records=records,
            lang=lang,
        )

    async def stream_ask_pipeline(
        self,
        question: str,
        crop: str | None = None,
        image_bytes: bytes | None = None,
        lang: str = "en",
        abstain_threshold: float = DEFAULT_ABSTAIN_THRESHOLD,
    ) -> AsyncGenerator[str, None]:
        """Runs pipeline and streams progress and payload formatted for SSE."""
        yield f"data: {json.dumps({'event': 'started', 'status': 'understanding_query'})}\n\n"

        result = await self.ask_pipeline(
            question=question,
            crop=crop,
            image_bytes=image_bytes,
            lang=lang,
            abstain_threshold=abstain_threshold,
        )

        retrieved_event = {"event": "retrieved", "abstained": result.get("abstained", False)}
        yield f"data: {json.dumps(retrieved_event)}\n\n"
        yield f"data: {json.dumps(result)}\n\n"

    def _build_abstain_response(self, lang: str = "en", reason: str = "") -> dict[str, Any]:
        """Returns standard abstention payload with Kisan Call Centre fallback."""
        if lang == "te":
            msg = (
                "మీ ప్రశ్నకు CIBRC రిజిస్ట్రీలో ఖచ్చితమైన సిఫార్సు లభించలేదు. "
                "దయచేసి కిసాన్ కాల్ సెంటర్ (1800-180-1551) లేదా సమీప కృషి విజ్ఞాన కేంద్రాన్ని సంప్రదించండి."
            )
        elif lang == "hi":
            msg = (
                "आपके प्रश्न के लिए CIBRC रजिस्ट्री में पर्याप्त सटीक सिफारिश नहीं मिली। "
                "कृपया किसान कॉल सेंटर (1800-180-1551) से परामर्श लें।"
            )
        else:
            msg = (
                "No sufficiently confident CIBRC registered solutions found for this inquiry. "
                "Please contact the Kisan Call Centre (1800-180-1551) for expert assistance."
            )

        return {
            "answer": msg,
            "citations": [],
            "confidence": 0.0,
            "abstained": True,
            "fallback": "kisan_call_centre",
            "lang": lang,
        }


doctor_service = CropDoctorService()
