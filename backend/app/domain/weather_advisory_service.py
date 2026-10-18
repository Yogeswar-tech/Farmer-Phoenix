"""LLM-Powered Weather Advisory Service for Kisan Sethu.

Generates concise, farmer-friendly agro-weather advisories translating raw weather data
into direct farming decisions (spray, irrigate, harvest, or wait) in the farmer's regional language.
Adheres strictly to the single LLM gateway and file-based prompts.
"""

import asyncio
import json
import logging
import re
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.llm.client import get_llm_gateway
from app.llm.prompt_loader import load_prompt

logger = logging.getLogger("WeatherAdvisoryService")

ActionBadge = Literal[
    "spray_recommended",
    "spray_not_recommended",
    "irrigate_recommended",
    "irrigate_not_recommended",
    "harvest_recommended",
    "wait",
    "none",
]

ALLOWED_BADGES = {
    "spray_recommended",
    "spray_not_recommended",
    "irrigate_recommended",
    "irrigate_not_recommended",
    "harvest_recommended",
    "wait",
    "none",
}


class WeatherAdvisoryResponse(BaseModel):
    summary: str = Field(..., description="One line advisory in the farmer's selected language")
    action_badge: ActionBadge = Field(..., description="Action recommendation badge")
    reason: str = Field(..., description="1-2 short sentences in the farmer's language, no jargon")
    alert: str | None = Field(None, description="Only present if the weather API's severity flag is true")


def extract_numbers_from_text(text: str) -> set[float]:
    """Extract all numbers (integers and floats) present in a text string."""
    matches = re.findall(r"-?\d+(?:\.\d+)?", text)
    nums = set()
    for m in matches:
        try:
            nums.add(float(m))
        except ValueError:
            pass
    return nums


def extract_known_numbers_from_weather_data(weather_json: dict[str, Any]) -> set[float]:
    """Recursively collect all numeric values present in the source weather JSON."""
    nums: set[float] = set()

    def _traverse(item: Any):
        if isinstance(item, (int, float)) and not isinstance(item, bool):
            nums.add(round(float(item), 1))
            nums.add(float(int(item)))
        elif isinstance(item, dict):
            for v in item.values():
                _traverse(v)
        elif isinstance(item, (list, tuple)):
            for v in item:
                _traverse(v)

    _traverse(weather_json)
    return nums


def build_weather_advisory_prompt(
    weather_data_5days: dict[str, Any],
    location_name: str,
    lang: str = "en",
    crop: str | None = None,
    growth_stage: str | None = None,
    api_severity_flag: bool = False,
) -> str:
    """Build the versioned prompt injecting strict weather facts and context."""
    raw_weather_str = json.dumps(weather_data_5days, indent=2, ensure_ascii=False)

    variables = {
        "farmer_location": location_name,
        "farmer_language": lang,
        "crop_name": crop if crop else "General Agricultural Crops",
        "growth_stage": growth_stage if growth_stage else "Active Cultivation",
        "api_severity_flag": "true" if api_severity_flag else "false",
        "raw_weather_json": raw_weather_str,
    }

    return load_prompt(
        feature="weather",
        name="advisory",
        version=1,
        variables=variables,
    )


def validate_and_sanitize_advisory(
    raw_dict: dict[str, Any],
    weather_data_5days: dict[str, Any],
    api_severity_flag: bool,
    lang: str = "en",
) -> WeatherAdvisoryResponse | None:
    """Enforces strict schema compliance, hallucination checks, and severity constraints."""
    try:
        # 1. Enforce allowed action_badge
        badge = str(raw_dict.get("action_badge", "none")).strip().lower()
        if badge not in ALLOWED_BADGES:
            logger.warning("Weather advisory validation failed: invalid action_badge '%s'", badge)
            return None

        summary = str(raw_dict.get("summary", "")).strip()
        reason = str(raw_dict.get("reason", "")).strip()
        if not summary or not reason:
            logger.warning("Weather advisory validation failed: empty summary or reason")
            return None

        # 2. Strict Severity Rule: alert must ONLY be non-null if api_severity_flag is true
        alert: str | None = None
        if api_severity_flag:
            alert_candidate = raw_dict.get("alert")
            if alert_candidate and str(alert_candidate).strip().lower() not in ("null", "none"):
                alert = str(alert_candidate).strip()
        else:
            alert = None  # Force None if API severity flag is False

        # 3. Numeric hallucination check:
        # Numbers mentioned in the model's text must match numbers present in input facts.
        known_numbers = extract_known_numbers_from_weather_data(weather_data_5days)
        # Allow common conversational numbers like 1, 2, 24 (hours), 5 (days), 0
        allowed_incidental = {0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 7.0, 12.0, 24.0, 48.0}
        known_numbers.update(allowed_incidental)

        used_numbers = extract_numbers_from_text(f"{summary} {reason} {alert or ''}")
        for num in used_numbers:
            rounded = round(num, 1)
            int_ver = float(int(num))
            if rounded not in known_numbers and int_ver not in known_numbers:
                logger.warning(
                    "Weather advisory discarded due to numeric hallucination: number %s not in facts", num
                )
                return None

        return WeatherAdvisoryResponse(
            summary=summary,
            action_badge=badge,  # type: ignore[arg-type]
            reason=reason,
            alert=alert,
        )

    except Exception as exc:
        logger.warning("Error sanitizing weather advisory response: %s", exc)
        return None


def generate_deterministic_advisory_fallback(
    weather_data_5days: dict[str, Any],
    api_severity_flag: bool,
    lang: str = "en",
    crop: str | None = None,
) -> WeatherAdvisoryResponse:
    """Generates an accurate, fact-grounded fallback advisory when LLM is offline or unconfigured."""
    current = weather_data_5days.get("current_conditions", {})
    forecast = weather_data_5days.get("forecast_days", []) or weather_data_5days.get("forecast_5days", [])
    day0 = forecast[0] if forecast else {}

    def _parse_num(val: Any, default: float) -> float:
        if isinstance(val, (int, float)):
            return float(val)
        if isinstance(val, str):
            clean = re.sub(r"[^\d\.-]", "", val)
            try:
                return float(clean) if clean else default
            except ValueError:
                return default
        return default

    rain_prob = int(_parse_num(day0.get("rainProbability") or day0.get("rainChance") or 0, 0.0))
    wind_kmh = _parse_num(day0.get("windSpeed") or day0.get("windSpeedKmh") or current.get("windSpeedKmh") or 10.0, 10.0)
    temp_max = _parse_num(day0.get("tempMax") or current.get("temperatureC") or 30.0, 30.0)
    precip_mm = _parse_num(day0.get("precipitationMm") or day0.get("precipMm") or 0.0, 0.0)

    # Farming decision logic grounded in factual thresholds
    if rain_prob >= 50 or precip_mm >= 3.0:
        badge: ActionBadge = "spray_not_recommended"
        if lang == "hi":
            summary = "आज कीटनाशक छिड़काव रोकें — बारिश की संभावना है"
            reason = f"आज {rain_prob}% बारिश एवं नमी की संभावना है। दवा के बह जाने से बचने के लिए छिड़काव टालें।"
            alert = f"सावधानी: आज {rain_prob}% वर्षा का पूर्वानुमान है। खेत से जल निकासी सुनिश्चित करें।" if api_severity_flag else None
        elif lang == "te":
            summary = "నేడు పురుగుమందుల పిచికారీ నిలిపివేయండి — వర్ష సూచన ఉంది"
            reason = f"నేడు {rain_prob}% వర్షం కురిసే అవకాశం ఉంది. మందు కొట్టుకుపోకుండా ఉండటానికి పిచికారీ ఆపండి."
            alert = f"హెచ్చరిక: నేడు {rain_prob}% వర్షం కురిసే అవకాశం ఉంది. పొలంలో నీరు నిల్వ ఉండకుండా చూసుకోండి." if api_severity_flag else None
        else:
            summary = "Pause foliar spraying today — rain expected"
            reason = f"Precipitation probability is {rain_prob}% today. Delay spraying to prevent chemical wash-off and runoff."
            alert = f"Precipitation Alert: {rain_prob}% rain expected today. Ensure proper drainage in fields." if api_severity_flag else None

    elif wind_kmh >= 18.0:
        badge = "spray_not_recommended"
        if lang == "hi":
            summary = "तेज हवा के कारण आज छिड़काव न करें"
            reason = f"हवा की गति {wind_kmh:.1f} किमी/घंटा है, जिससे दवा उड़कर बर्बाद होगी।"
            alert = f"हवा चेतावनी: {wind_kmh:.1f} किमी/घंटा की गति से हवा चलने की संभावना है।" if api_severity_flag else None
        elif lang == "te":
            summary = "తీవ్రమైన గాలి కారణంగా నేడు పిచికారీ చేయవద్దు"
            reason = f"గాలి వేగం {wind_kmh:.1f} కి.మీ. ఉన్నందున మందు ఆకులపై నిలవదు."
            alert = f"గాలి హెచ్చరిక: {wind_kmh:.1f} కి.మీ. వేగంతో గాలి వీచే అవకాశం ఉంది." if api_severity_flag else None
        else:
            summary = "Hold chemical spray — gusty winds active"
            reason = f"Wind speed is {wind_kmh:.1f} km/h, causing droplet drift away from target foliage."
            alert = f"Wind Alert: Gusts up to {wind_kmh:.1f} km/h expected." if api_severity_flag else None

    elif rain_prob <= 20 and precip_mm == 0.0:
        badge = "spray_recommended" if wind_kmh < 15.0 else "irrigate_recommended"
        if lang == "hi":
            summary = "खेती के कार्यों एवं छिड़काव के लिए आज अनुकूल मौसम"
            reason = f"मौसम साफ है और हवा {wind_kmh:.1f} किमी/घंटा शांत है। सुबह के समय छिड़काव सुरक्षित रहेगा।"
            alert = None
        elif lang == "te":
            summary = "నేడు వ్యవసాయ పనులకు మరియు పిచికారీకి అనుకూలమైన వాతావరణం"
            reason = f"వాతావరణం నిర్మలంగా ఉంది, గాలి వేగం {wind_kmh:.1f} కి.మీ. ఉదయం వేళల్లో స్ప్రే చేయడం సురక్షితం."
            alert = None
        else:
            summary = "Favorable weather window for field operations and spraying"
            reason = f"Clear conditions with gentle wind ({wind_kmh:.1f} km/h). Optimal morning window for foliar treatment."
            alert = None

    else:
        badge = "wait"
        if lang == "hi":
            summary = "मौसम में परिवर्तनशील स्थिति — 24 घंटे प्रतीक्षा करें"
            reason = f"तापमान {temp_max:.1f}°C और बारिश की संभावना {rain_prob}% है। बड़े कृषि निर्णयों से पहले मौसम स्थिर होने दें।"
            alert = None
        elif lang == "te":
            summary = "వాతావరణంలో మార్పులు ఉన్నాయి — 24 గంటలు వేచి చూడండి"
            reason = f"ఉష్ణోగ్రత {temp_max:.1f}°C మరియు వర్ష సూచన {rain_prob}%. వాతావరణం స్థిరపడే వరకు ఆగండి."
            alert = None
        else:
            summary = "Variable weather conditions — monitor next 24 hours"
            reason = f"Maximum temperature is {temp_max:.1f}°C with {rain_prob}% rain chance. Wait for conditions to stabilize."
            alert = None

    return WeatherAdvisoryResponse(
        summary=summary,
        action_badge=badge,
        reason=reason,
        alert=alert if api_severity_flag else None,
    )


class WeatherAdvisoryService:
    """Decoupled agro-weather advisory generator powered by Google Gemini and grounding validators."""

    def __init__(self) -> None:
        self.llm_gateway = get_llm_gateway()

    async def get_advisory(
        self,
        weather_payload: dict[str, Any],
        location_name: str,
        lang: str = "en",
        crop: str | None = None,
        growth_stage: str | None = None,
    ) -> WeatherAdvisoryResponse | None:
        """Generates a validated weather advisory, failing silently (returning None or fallback) if LLM errors."""
        try:
            # 1. Prepare structured 5-day weather package
            cur = weather_payload.get("current_conditions", {})
            forecast_all = weather_payload.get("forecast_days", [])
            forecast_5days = forecast_all[:5] if forecast_all else []

            # Check if weather API provided a severity/alert flag
            risk_alert = weather_payload.get("risk_alert") or {}
            api_severity_flag = bool(risk_alert.get("hasAlert")) or (risk_alert.get("riskLevel") == "danger")

            weather_data_5days = {
                "current_conditions": {
                    "temperatureC": cur.get("temperatureC"),
                    "humidityPct": cur.get("humidityPct"),
                    "windSpeedKmh": cur.get("windSpeedKmh"),
                    "precipitationMm": cur.get("precipitationMm"),
                    "conditionText": cur.get("conditionText"),
                    "uvIndex": cur.get("uvIndex"),
                },
                "forecast_5days": [
                    {
                        "date": d.get("date"),
                        "dayName": d.get("dayName", {}).get("en") if isinstance(d.get("dayName"), dict) else d.get("dayName"),
                        "tempMax": d.get("tempMax"),
                        "tempMin": d.get("tempMin"),
                        "rainProbability": d.get("rainProbability") or d.get("rainChance"),
                        "windSpeedKmh": d.get("windSpeed") or d.get("windSpeedKmh"),
                        "precipitationMm": d.get("precipitationMm") or d.get("precipMm"),
                        "conditionText": d.get("conditionText", {}).get("en") if isinstance(d.get("conditionText"), dict) else d.get("conditionText"),
                    }
                    for d in forecast_5days
                ],
                "api_severity_flag": api_severity_flag,
            }

            # 2. Build Prompt
            prompt = build_weather_advisory_prompt(
                weather_data_5days=weather_data_5days,
                location_name=location_name,
                lang=lang,
                crop=crop,
                growth_stage=growth_stage,
                api_severity_flag=api_severity_flag,
            )

            # 3. Call LLM Gateway with 3.5s timeout to guarantee instant UX
            try:
                response_text = await asyncio.wait_for(
                    self.llm_gateway.generate_response(
                        prompt=prompt,
                        system_instruction="You are an agricultural advisor. You must output raw valid JSON only matching the schema.",
                    ),
                    timeout=3.5,
                )
            except Exception as exc:
                logger.info("LLM gateway timed out or offline (%s); using grounded deterministic fallback.", exc)
                response_text = None

            if not response_text:
                logger.info("LLM returned empty response or offline mode active; using factual deterministic fallback.")
                return generate_deterministic_advisory_fallback(
                    weather_data_5days=weather_data_5days,
                    api_severity_flag=api_severity_flag,
                    lang=lang,
                    crop=crop,
                )

            # Clean potential markdown fences ```json ... ```
            cleaned = response_text.strip()
            if cleaned.startswith("```"):
                cleaned = re.sub(r"^```(?:json)?", "", cleaned)
                cleaned = re.sub(r"```$", "", cleaned)
                cleaned = cleaned.strip()

            parsed = json.loads(cleaned)
            validated = validate_and_sanitize_advisory(
                raw_dict=parsed,
                weather_data_5days=weather_data_5days,
                api_severity_flag=api_severity_flag,
                lang=lang,
            )

            if validated:
                return validated

            logger.warning("LLM response failed schema validation; using factual deterministic fallback.")
            return generate_deterministic_advisory_fallback(
                weather_data_5days=weather_data_5days,
                api_severity_flag=api_severity_flag,
                lang=lang,
                crop=crop,
            )

        except Exception as exc:
            logger.error("Weather advisory generation error (failing gracefully): %s", exc)
            try:
                # Decoupled graceful fallback
                return generate_deterministic_advisory_fallback(
                    weather_data_5days=weather_payload,
                    api_severity_flag=bool((weather_payload.get("risk_alert") or {}).get("hasAlert")),
                    lang=lang,
                    crop=crop,
                )
            except Exception:
                return None


weather_advisory_service = WeatherAdvisoryService()
