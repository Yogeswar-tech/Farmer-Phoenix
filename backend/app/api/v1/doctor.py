"""Crop Doctor API routes with CIBRC Hybrid RAG and SSE streaming."""

import base64
import logging

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.core.security import default_ask_limiter, rate_limit_dependency
from app.domain.doctor_service import doctor_service

logger = logging.getLogger("DoctorAPI")

router = APIRouter(prefix="/doctor", tags=["Crop Doctor"])


class DoctorAskRequest(BaseModel):
    """Statutory CIBRC crop doctor inquiry payload."""

    question: str = Field(
        ...,
        description="Farmer inquiry about pests, diseases, or chemicals",
    )
    crop: str | None = Field(
        default=None,
        description="Optional crop hint (e.g. 'tomato', 'paddy', 'chilli')",
    )
    image: str | None = Field(
        default=None,
        description="Optional base64-encoded leaf or plant image",
    )
    lang: str = Field(
        default="en",
        description="Language code: 'en', 'te', 'hi'",
    )


@router.post("/ask", dependencies=[Depends(rate_limit_dependency(default_ask_limiter))])
async def ask_crop_doctor(payload: DoctorAskRequest) -> StreamingResponse:
    """Crop Doctor RAG consultation streamed via Server-Sent Events (SSE).

    Pipeline:
    1. Query Understanding via Gemini structured output (extracts crop_key, symptom, pesticide).
    2. Hybrid Retrieval over CIBRC database: full-text search + vector similarity with RRF.
       Enforces a HARD crop_key filter to ensure safe, registered recommendations.
    3. Abstention: if top RRF score < threshold or unregistered crop, abstains with
       fallback: 'kisan_call_centre'.
    4. Grounded Generation: Model provides rationale & record IDs; backend injects exact DB doses,
       PHI, and toxicity. Numbers are validated against retrieved CIBRC facts.
    5. Streams SSE events: {answer, citations: [{record_id, source, as_of}], confidence,
       abstained, lang}.
    """
    image_bytes = None
    if payload.image:
        try:
            # Handle potential data URL prefix
            raw_b64 = payload.image
            if "," in raw_b64:
                raw_b64 = raw_b64.split(",", 1)[1]
            image_bytes = base64.b64decode(raw_b64)
        except Exception as exc:
            logger.warning("Failed to decode image base64 in doctor request: %s", exc)
            image_bytes = None

    generator = doctor_service.stream_ask_pipeline(
        question=payload.question,
        crop=payload.crop,
        image_bytes=image_bytes,
        lang=payload.lang,
    )

    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
