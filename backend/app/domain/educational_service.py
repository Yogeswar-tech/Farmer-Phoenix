"""Educational Agronomic Standards & AGMARKNET Quality Grading Service.

Provides:
1. Statutory AGMARKNET quality grading criteria (Grade-A Super, Grade-B FAQ, Grade-C Tala).
2. Moisture dockage deduction tiers and net payment realization models.
3. Vernacular definitions across Hindi, Telugu, and English.
"""

from typing import Any

CROP_GRADING_MATRICES: dict[str, list[dict[str, Any]]] = {
    "chilli": [
        {
            "grade_code": "GRADE-A",
            "name": {
                "en": "Grade-A (Super Export Premium)",
                "hi": "ग्रेड-ए (सुपर एक्सपोर्ट / बोल्ड)",
                "te": "గ్రేడ్-ఎ (సూపర్ ఎగుమతి నాణ్యత)"
            },
            "criteria": {
                "en": "Deep bright red color, zero blemishes, 10-11% moisture, bold uniform size (>8cm).",
                "hi": "गहरा लाल रंग, बिना दाग, 10–11% आदर्श नमी, बड़ा दाना (>8 सेमी)।",
                "te": "గాఢ ఎరుపు రంగు, మచ్చలు లేనివి, 10-11% తేమ, పెద్ద కాయలు (>8 సెం.మీ)."
            },
            "moisture_limit": "10% – 11%",
            "price_per_qtl": 16500.0,
            "deduction_risk": {
                "en": "Zero deductions (0% deduction, maximum exporter premium).",
                "hi": "शून्य कटौती (0% Deduction, उच्चतम प्रीमियम भाव)।",
                "te": "సున్నా కోత (0% Deduction, పూర్తి ప్రీమియం ధర)."
            },
            "badge_color": "#1B5E20"
        },
        {
            "grade_code": "GRADE-B",
            "name": {
                "en": "Grade-B (Modal Fair Average Quality)",
                "hi": "ग्रेड-बी (मॉडल / मानक मंडी दर)",
                "te": "గ్రేడ్-బి (మోడల్ / సాధారణ మార్కెట్ ధర)"
            },
            "criteria": {
                "en": "Medium size, 12-14% moisture, standard domestic mandi grade.",
                "hi": "मध्यम आकार, 12–14% नमी, आंशिक रंग भिन्नता, मंडी मानक।",
                "te": "మధ్యస్థ పరిమాణం, 12-14% తేమ, సాధారణ మార్కెట్ రకం."
            },
            "moisture_limit": "12% – 14%",
            "price_per_qtl": 14200.0,
            "deduction_risk": {
                "en": "Standard (₹0 to ₹250/qtl moisture cut if moisture exceeds 14%).",
                "hi": "सामान्य (₹0 से ₹250/क्विंटल नमी कटौती यदि 14% से अधिक हो)।",
                "te": "సాధారణం (14% కంటే ఎక్కువ ఉంటే ₹0-₹250 కోత)."
            },
            "badge_color": "#2E7D32"
        },
        {
            "grade_code": "GRADE-C",
            "name": {
                "en": "Grade-C (Tala / Rain Damaged / High Moisture)",
                "hi": "ग्रेड-सी (ताला / वर्षा प्रभावित / गीला माल)",
                "te": "గ్రేడ్-సి (తాల / వర్షం తగిలిన / తేమ సరుకు)"
            },
            "criteria": {
                "en": "Discoloration, broken pods, >16% high moisture, mold risk.",
                "hi": "कालापन, टूटे दाने, >16% उच्च नमी, फंगस का जोखिम।",
                "te": "నలుపు మచ్చలు, విరిగిన కాయలు, >16% అధిక తేమ, బూజు ప్రమాదం."
            },
            "moisture_limit": "> 16%",
            "price_per_qtl": 9800.0,
            "deduction_risk": {
                "en": "Severe deductions (₹1,500 to ₹2,500/qtl penalty or bidding rejection).",
                "hi": "भारी कटौती (₹1,500 से ₹2,500/क्विंटल कटौती अथवा बोली अस्वीकार)।",
                "te": "భారీ కోత (రూ. 1,500 నుండి 2,500 వరకు కోత లేదా తిరస్కరణ)."
            },
            "badge_color": "#C62828"
        }
    ]
}

MOISTURE_DOCKAGE_TIERS = [
    {
        "tier": "<= 10%",
        "status": {"en": "Safe / Premium", "hi": "सुरक्षित / प्रीमियम", "te": "సురక్షితం / ప్రీమియం"},
        "dockage_pct": 0.0,
        "advice": {"en": "Ready for cold storage and long-term sale.", "hi": "कोल्ड स्टोरेज व लंबे समय तक रखने हेतु सर्वोत्तम।", "te": "కోల్డ్ స్టోరేజ్ & దీర్ఘకాల నిల్వకు అనుకూలం."}
    },
    {
        "tier": "10% - 12%",
        "status": {"en": "Standard FAQ", "hi": "मानक मंडी स्तर", "te": "సాధారణ మార్కెట్ స్థాయి"},
        "dockage_pct": 0.0,
        "advice": {"en": "Normal mandi trading without any price penalty.", "hi": "बिना किसी कटौती के सामान्य मंडी व्यापार।", "te": "ఎటువంటి ధర తగ్గింపు లేకుండా సాధారణ వ్యాపారం."}
    },
    {
        "tier": "13% - 15%",
        "status": {"en": "Warning (Moisture Cut)", "hi": "चेतावनी (नमी कटौती)", "te": "హెచ్చరిక (తేమ కోత)"},
        "dockage_pct": 3.0,
        "advice": {"en": "Sun-dry for 1 full sunny day before bringing to mandi.", "hi": "मंडी ले जाने से पूर्व 1 दिन तेज धूप में सुखाएं।", "te": "మార్కెట్‌కు తెచ్చే ముందు 1 రోజు ఎండబెట్టండి."}
    },
    {
        "tier": "> 15%",
        "status": {"en": "Critical (High Risk)", "hi": "अति गंभीर (अस्वीकृति खतरा)", "te": "ప్రమాదకరం (తిరస్కరణ)"},
        "dockage_pct": 10.0,
        "advice": {"en": "Fungal rotting hazard. Traders may refuse auction.", "hi": "फफूंद का खतरा। व्यापारी बोली लगाने से मना कर सकते हैं।", "te": "బూజు తెగులు సోకే ప్రమాదం. వేలం తిరస్కరించవచ్చు."}
    }
]


def get_grading_matrix(crop_key: str = "chilli", lang: str = "en") -> dict[str, Any]:
    """Retrieve educational grading matrix and moisture dockage tiers."""
    key = crop_key.lower().strip()
    grades = CROP_GRADING_MATRICES.get(key, CROP_GRADING_MATRICES["chilli"])

    formatted_grades = []
    for g in grades:
        formatted_grades.append({
            "grade_code": g["grade_code"],
            "grade_name": g["name"].get(lang, g["name"]["en"]),
            "grade_name_multilingual": g["name"],
            "criteria": g["criteria"].get(lang, g["criteria"]["en"]),
            "moisture_limit": g["moisture_limit"],
            "price_per_qtl": g["price_per_qtl"],
            "deduction_risk": g["deduction_risk"].get(lang, g["deduction_risk"]["en"]),
            "badge_color": g["badge_color"]
        })

    formatted_dockage = []
    for d in MOISTURE_DOCKAGE_TIERS:
        formatted_dockage.append({
            "tier": d["tier"],
            "status": d["status"].get(lang, d["status"]["en"]),
            "dockage_pct": d["dockage_pct"],
            "advice": d["advice"].get(lang, d["advice"]["en"])
        })

    return {
        "status": "success",
        "crop_key": key,
        "grades": formatted_grades,
        "moisture_dockage_tiers": formatted_dockage
    }
