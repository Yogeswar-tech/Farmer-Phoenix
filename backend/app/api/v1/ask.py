"""Farmer Q&A RAG endpoint supporting both Mandi Mitra and Expo FarmerEnvelope contracts."""

import datetime
import time
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.security import default_ask_limiter, rate_limit_dependency
from app.domain.validator import validate_grounded_numbers
from app.llm import LLMUnavailableError, get_llm_gateway, load_prompt
from app.location.mandi_finder import MandiFinder
from app.rag.retriever import PriceRetriever

router = APIRouter(tags=["Q&A"])


class AskRequest(BaseModel):
    """Farmer inquiry request body supporting both Mandi Mitra and Kisan Sethu frontend."""

    query: str | None = Field(default=None, description="Farmer natural language query")
    question: str | None = Field(default=None, description="Alias for query")
    location: str | None = Field(default=None, description="Farmer location or city")
    region: str | None = Field(default=None, description="Alias for location/region")
    commodity: str | None = Field(default=None, description="Optional commodity filter")
    crop: str | None = Field(default=None, description="Alias for commodity")
    lang: str = Field(default="en", description="Language code")


class Card(BaseModel):
    headline: str
    bullets: list[str]
    audio_url: str | None = None


class Freshness(BaseModel):
    stale: bool = False


class CacheInfo(BaseModel):
    status: str = "HIT"
    llm_calls: int = 1


class ProvenanceItem(BaseModel):
    label: str
    as_of: str
    source: str


class AskResponse(BaseModel):
    """Unified response fulfilling Mandi Mitra and Expo FarmerEnvelope contracts."""

    status: str = "success"
    advisory: str | None = None

    # Mandi Mitra fields
    answer: str
    recommendation: str
    sources: list[dict[str, Any]]
    nearby_markets: list[dict[str, Any]]
    as_of: str
    grounding_valid: bool = True

    # FarmerEnvelope fields
    request_id: str
    lang: str = "en"
    card: Card
    numbers: dict[str, float]
    provenance: list[ProvenanceItem]
    freshness: Freshness = Field(default_factory=Freshness)
    cache: CacheInfo = Field(default_factory=CacheInfo)
    disclaimer_key: str = "advice_disclaimer"


@router.post("/ask", response_model=AskResponse, dependencies=[Depends(rate_limit_dependency(default_ask_limiter))])
async def ask_mandi_mitra(payload: AskRequest) -> AskResponse:
    """Answer farmer questions with nearest mandi prices, trends, and recommendations."""
    current_date = datetime.date.today().isoformat()
    query_text = (payload.query or payload.question or "Vegetable market price").strip()
    location_str = payload.location or payload.region
    if not location_str:
        detected_state = PriceRetriever._extract_state(query_text)
        location_str = detected_state or "Chennai, Tamil Nadu"

    target_crop = payload.commodity or payload.crop

    # 1. Location awareness: Find nearest 3 mandis
    finder = MandiFinder()
    nearest_mandis = await finder.find_nearest(location_str, top_n=3)
    nearest_names = [m.name for m in nearest_mandis]
    mandi_names_text = ", ".join(f"{m.name} ({m.distance_km} km)" for m in nearest_mandis)

    # 2. Vector search retrieval with location awareness
    retriever = PriceRetriever()
    results = retriever.retrieve(
        query=query_text,
        commodity=target_crop,
        state=PriceRetriever._extract_state(location_str),
        markets=nearest_names,
        top_k=4,
    )

    formatted_facts = retriever.format_context_for_prompt(results)

    # 3. Load versioned prompt from prompts/price/advisor.v1.md
    prompt = load_prompt(
        feature="price",
        name="advisor",
        version=1,
        variables={
            "current_date": current_date,
            "farmer_location": location_str,
            "nearest_mandis": mandi_names_text,
            "retrieved_facts": formatted_facts,
            "farmer_query": query_text,
        },
    )

    # 4. Generate answer through LLM Gateway (Gemini)
    gateway = get_llm_gateway()
    try:
        answer_text = await gateway.generate_response(prompt)
    except LLMUnavailableError:
        req_lang = payload.lang or "te"
        friendly_message = (
            "క్షమించండి, మార్కెట్ సలహా సేవ ప్రస్తుతం అందుబాటులో లేదు. దయచేసి సమీప రైతు భరోసా కేంద్రాన్ని లేదా కిసాన్ కాల్ సెంటర్‌ను (1800-180-1551) సంప్రదించండి."
            if req_lang == "te"
            else (
                "क्षमा करें, कृषि सलाहकार सेवा वर्तमान में अनुपलब्ध है। कृपया अपने निकटतम कृषि विज्ञान केंद्र या किसान कॉल सेंटर (1800-180-1551) से संपर्क करें।"
                if req_lang == "hi"
                else "We apologize, the advisory service is currently unavailable. Please contact your nearest Krishi Vigyan Kendra or the Kisan Call Centre at 1800-180-1551."
            )
        )
        return AskResponse(
            status="unavailable",
            advisory=None,
            answer=friendly_message,
            recommendation=friendly_message,
            sources=[],
            nearby_markets=[],
            as_of=current_date,
            grounding_valid=False,
            request_id=f"req_ask_{int(time.time() * 1000)}",
            lang=req_lang,
            card=Card(
                headline="Advisory Unavailable",
                bullets=[friendly_message],
            ),
            numbers={},
            provenance=[],
            freshness=Freshness(stale=True),
            cache=CacheInfo(status="MISS", llm_calls=0),
            disclaimer_key="service_unavailable",
        )

    # 5. Strict Validator Check
    is_valid, _ = validate_grounded_numbers(answer_text, results)

    # 6. Extract structured sources and numbers
    sources: list[dict[str, Any]] = []
    provenance_items: list[ProvenanceItem] = []
    numbers_map: dict[str, float] = {}

    for r in results:
        meta = r.metadata
        if meta.get("chunk_type") == "mandi_price":
            m_name = str(meta.get("market_name", "Mandi"))
            c_name = str(meta.get("commodity", "Vegetable"))
            modal_p = float(meta.get("modal_price", 0.0))
            arr_date = str(meta.get("arrival_date", current_date))
            source_name = str(meta.get("source", "data.gov.in (AGMARKNET)"))

            sources.append(
                {
                    "market": m_name,
                    "commodity": c_name,
                    "price": f"₹{modal_p:.0f}/qtl",
                    "date": arr_date,
                }
            )
            provenance_items.append(
                ProvenanceItem(
                    label=f"{m_name} wholesale rate",
                    as_of=arr_date,
                    source=source_name,
                )
            )
            if "mandi_modal_qtl" not in numbers_map and modal_p > 0:
                numbers_map["mandi_modal_qtl"] = modal_p
                numbers_map["mandi_modal_kg"] = round(modal_p / 100.0, 1)

    if not provenance_items:
        provenance_items.append(
            ProvenanceItem(
                label=f"{location_str} Mandi",
                as_of=current_date,
                source="AGMARKNET (data.gov.in)",
            )
        )

    nearby_markets_info = [
        {
            "name": m.name,
            "district": m.district,
            "state": m.state,
            "distance_km": m.distance_km,
        }
        for m in nearest_mandis
    ]

    rec_text = "Compare prices across nearby mandis to select the best market before transporting."
    if "recommendation:" in answer_text.lower():
        parts = answer_text.lower().split("recommendation:")
        rec_text = parts[-1].strip().split("\n")[0].capitalize()

    # Bullets for the Card component
    bullets: list[str] = [rec_text]
    for s in sources[:2]:
        bullets.append(f"{s['market']} rate: {s['price']} on {s['date']}")

    return AskResponse(
        answer=answer_text,
        recommendation=rec_text,
        sources=sources,
        nearby_markets=nearby_markets_info,
        as_of=current_date,
        grounding_valid=is_valid,
        request_id=f"req_ask_{int(time.time() * 1000)}",
        lang=payload.lang,
        card=Card(
            headline=f"Market Intelligence for {target_crop or 'Vegetables'}",
            bullets=bullets,
        ),
        numbers=numbers_map,
        provenance=provenance_items,
        freshness=Freshness(stale=False),
        cache=CacheInfo(status="HIT", llm_calls=1),
        disclaimer_key="advice_disclaimer",
    )


class VoiceBotRequest(BaseModel):
    """Payload for multilingual Voice Bot assistant."""

    query: str | None = Field(default=None, description="Farmer natural language query")
    question: str | None = Field(default=None, description="Alias for query")
    lang: str = Field(default="te", description="Language code ('te', 'hi', 'en')")
    language: str | None = Field(default=None, description="Alias for lang")
    location: str | None = Field(default="Guntur", description="Farmer location or city")
    crop: str | None = Field(default="chilli", description="Crop identifier")


@router.post("/voice-bot/ask")
async def voice_bot_ask(payload: VoiceBotRequest) -> dict[str, Any]:
    """Voice Bot endpoint supporting Telugu, Hindi, and English queries with Gemini grounding."""
    from app.domain.voice_bot_service import voice_bot_service

    q_text = (payload.query or payload.question or "ఈరోజు వాతావరణం ఎలా ఉంది?").strip()
    target_lang = (payload.language or payload.lang or "te").strip().lower()
    loc = (payload.location or "Guntur").strip()
    target_crop = (payload.crop or "chilli").strip().lower()

    resp = await voice_bot_service.answer_farmer_query(
        query=q_text,
        lang=target_lang,
        location=loc,
        crop=target_crop
    )
    return resp.model_dump()

