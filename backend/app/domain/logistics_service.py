"""Mandi Logistics & Inter-Market Arbitrage Service for Kisan-Sethu.

Provides:
1. Dynamic transport ROI calculation between farm/local yard and major APMC terminals.
2. Real-time modal price lookup from PostgreSQL/SQLite `mandi_prices`.
3. True diesel fuel consumption, toll fees, and vehicle freight cost modeling.
4. Trilingual advisory verdict and break-even quintal volume calculation.
"""

import logging
from typing import Any, Optional

logger = logging.getLogger("LogisticsService")

VEHICLE_PROFILES = {
    "tractor": {
        "name": {"en": "Tractor Trolley", "hi": "ट्रैक्टर ट्रॉली", "te": "ట్రాక్టర్ ట్రాలీ"},
        "rate_per_km": 24.0,
        "fuel_economy_kmpl": 6.0,
        "max_capacity_qtl": 60.0,
        "ideal_range_km": 80.0
    },
    "pickup": {
        "name": {"en": "Bolero Pickup / Mini Truck", "hi": "बोलेरो पिकअप / छोटा हाथी", "te": "బొలెరో పికప్ / టాటా ఏస్"},
        "rate_per_km": 16.0,
        "fuel_economy_kmpl": 11.0,
        "max_capacity_qtl": 30.0,
        "ideal_range_km": 150.0
    },
    "truck_10t": {
        "name": {"en": "10-Tonne Commercial Truck", "hi": "10-टन कमर्शियल ट्रक", "te": "10-టన్నుల లారీ"},
        "rate_per_km": 34.0,
        "fuel_economy_kmpl": 4.5,
        "max_capacity_qtl": 100.0,
        "ideal_range_km": 600.0
    }
}

DEFAULT_CORRIDORS: dict[str, dict[str, Any]] = {
    "chilli": {
        "crop_name": {"en": "Chilli", "hi": "मिर्च", "te": "మిర్చి"},
        "local_mandi": {"en": "Tenali Local Yard", "hi": "तेनाली स्थानीय यार्ड", "te": "తెనాలి లోకల్ యార్డ్"},
        "local_default_price": 13900.0,
        "destination_mandi": {"en": "Guntur Mirchi Yard (Asia's Largest)", "hi": "गुंटूर मिर्ची यार्ड (एशिया प्रसिद्ध)", "te": "గుంటూరు మిర్చి యార్డ్ (ఆసియాలోనే ప్రసిద్ధి)"},
        "dest_default_price": 14200.0,
        "distance_km": 48.0,
        "reason": {
            "en": "Global export buyers offer immediate cash settlement and ₹300-500/qtl premium for Teja variety.",
            "hi": "अंतरराष्ट्रीय निर्यात मांग; तेजा किस्म पर ₹300-500 प्रति क्विंटल का सीधा प्रीमियम व नकद भुगतान।",
            "te": "తేజ రకానికి ఎగుమతి వ్యాపారుల నుంచి క్వింటాకు రూ. 300-500 అదనపు ధర & తక్షణ చెల్లింపు."
        }
    },
    "tomato": {
        "crop_name": {"en": "Tomato", "hi": "टमाटर", "te": "టమోటా"},
        "local_mandi": {"en": "Chittoor Local Yard", "hi": "चित्तूर स्थानीय यार्ड", "te": "చిత్తూరు లోకల్ యార్డ్"},
        "local_default_price": 2600.0,
        "destination_mandi": {"en": "Madanapalle Tomato Terminal", "hi": "मदनपल्ले एशिया टमाटर मंडी", "te": "మదనపల్లె టమోటా మార్కెట్"},
        "dest_default_price": 3250.0,
        "distance_km": 65.0,
        "reason": {
            "en": "Pan-India wholesale dispatchers provide aggressive daily electronic bidding.",
            "hi": "देश भर के थोक व्यापारी सक्रिय रहते हैं और खुली प्रतिस्पर्धी बोली लगाते हैं।",
            "te": "దేశవ్యాప్త వ్యాపారుల మధ్య పోటీ వలన అత్యధిక వేలం ధర లభిస్తుంది."
        }
    },
    "cotton": {
        "crop_name": {"en": "Cotton", "hi": "कपास", "te": "పత్తి"},
        "local_mandi": {"en": "Nandyal Local Yard", "hi": "नंद्याल स्थानीय यार्ड", "te": "నంద్యాల స్థానిక యార్డ్"},
        "local_default_price": 7100.0,
        "destination_mandi": {"en": "Adoni Cotton & Ginning Terminal", "hi": "अदोनी कपास व जिनिंग मंडी", "te": "ఆదోని పత్తి మార్కెట్ యార్డ్"},
        "dest_default_price": 7650.0,
        "distance_km": 72.0,
        "reason": {
            "en": "Direct ginning mill purchase with computerized moisture deduction gives highest net payout.",
            "hi": "सीधी जिनिंग मिल खरीद और कम्प्यूटरीकृत नमी जांच से पूरा मूल्य मिलता है।",
            "te": "జిన్నింగ్ మిల్లుల ప్రత్యక్ష కొనుగోలు ద్వారా రికార్డు ధర."
        }
    },
    "groundnut": {
        "crop_name": {"en": "Groundnut", "hi": "मूंगफली", "te": "వేరుశనగ"},
        "local_mandi": {"en": "Dharmavaram Local Mandi", "hi": "धर्मावरम स्थानीय मंडी", "te": "ధర్మవరం స్థానిక మార్కెట్"},
        "local_default_price": 7100.0,
        "destination_mandi": {"en": "Kadiri / Anantapur Oil Terminal", "hi": "कादिरी / अनंतपुर ऑयल यार्ड", "te": "కదిరి / అనంతపురం ఆయిల్ యార్డ్"},
        "dest_default_price": 7850.0,
        "distance_km": 55.0,
        "reason": {
            "en": "High oil extraction units pay ₹700/qtl bonus for bold, dry pods.",
            "hi": "तेल मिलों द्वारा अच्छी सूखी मूंगफली पर ₹700 प्रति क्विंटल का भारी बोनस।",
            "te": "నూనె మిల్లులు నాణ్యమైన కాయలకు క్వింటాకు రూ. 700 వరకు అదనపు బోనస్ ఇస్తాయి."
        }
    },
    "paddy": {
        "crop_name": {"en": "Paddy", "hi": "धान", "te": "వరి"},
        "local_mandi": {"en": "Bapatla Local Yard", "hi": "बापटला स्थानीय राइस यार्ड", "te": "బాపట్ల లోకల్ యార్డ్"},
        "local_default_price": 2183.0,
        "destination_mandi": {"en": "Miryalaguda / Nellore Rice Terminal", "hi": "मिर्यालगुडा / नेल्लोर राइस टर्मिनल", "te": "మిర్యాలగూడ / నెల్లూరు రైస్ టెర్మినల్"},
        "dest_default_price": 2450.0,
        "distance_km": 52.0,
        "reason": {
            "en": "Modern automated parboiled mills pay ₹250/qtl above government MSP for BPT fine grain.",
            "hi": "आधुनिक राइस मिलें बीपीटी बारीक धान पर सरकारी समर्थन मूल्य (MSP) से ₹250 अधिक देती हैं।",
            "te": "ఆధునిక రైస్ మిల్లులు BPT సన్న రకానికి మద్దతు ధర కంటే రూ. 250 ఎక్కువ చెల్లిస్తాయి."
        }
    }
}


class LogisticsEngine:
    """Calculates transport viability and inter-mandi price spreads."""

    def calculate_arbitrage(
        self,
        crop_key: str = "chilli",
        load_quintals: float = 50.0,
        vehicle_type: str = "tractor",
        distance_km: Optional[float] = None,
        origin_mandi: Optional[str] = None,
        destination_mandi: Optional[str] = None,
        lang: str = "en"
    ) -> dict[str, Any]:
        """Calculates round-trip transport logistics, gross spread, and net profit."""
        crop = crop_key.lower().strip()
        corridor = DEFAULT_CORRIDORS.get(crop, DEFAULT_CORRIDORS["chilli"])

        eff_distance = distance_km if (distance_km is not None and distance_km > 0) else corridor["distance_km"]
        veh_profile = VEHICLE_PROFILES.get(vehicle_type, VEHICLE_PROFILES["tractor"])

        # Try to fetch live APMC prices from DB
        local_price = corridor["local_default_price"]
        dest_price = corridor["dest_default_price"]

        try:
            from database.connection import get_db_cursor, is_postgres_active
            use_pg = is_postgres_active()
            ph = "%s" if use_pg else "?"
            with get_db_cursor() as cur:
                cur.execute(
                    f"SELECT modal_price_qtl FROM mandi_prices "
                    f"WHERE LOWER(commodity) = LOWER({ph}) "
                    f"ORDER BY arrival_date DESC LIMIT 2;",
                    (crop,)
                )
                rows = cur.fetchall()
                if rows and len(rows) >= 2:
                    prices = [float(dict(r)["modal_price_qtl"]) for r in rows]
                    dest_price = max(prices)
                    local_price = min(prices)
        except Exception as e:
            logger.debug("Live APMC DB lookup fallback: %s", e)

        # Financial Calculations
        rate_km = veh_profile["rate_per_km"]
        round_trip_distance = eff_distance * 2.0
        base_freight = round_trip_distance * rate_km
        diesel_liters = round(round_trip_distance / veh_profile["fuel_economy_kmpl"], 1)
        diesel_expense = round(diesel_liters * 96.0, 1)  # Diesel @ ₹96/L
        toll_and_loading = 400.0 if eff_distance > 40 else 200.0

        total_transport_cost = base_freight + toll_and_loading

        local_gross_value = round(load_quintals * local_price, 2)
        dest_gross_value = round(load_quintals * dest_price, 2)
        gross_arbitrage = round(dest_gross_value - local_gross_value, 2)
        net_profit = round(gross_arbitrage - total_transport_cost, 2)

        price_diff_per_qtl = round(dest_price - local_price, 2)
        break_even_quintals = round(total_transport_cost / price_diff_per_qtl, 1) if price_diff_per_qtl > 0 else 999.0
        is_profitable = net_profit > 500.0

        # Verdict
        if net_profit > 3000:
            verdict_en = f"Highly Recommended: Transport to {corridor['destination_mandi']['en']} for an estimated net extra profit of ₹{net_profit:,.0f}."
            verdict_hi = f"अत्यंत अनुशंसित: {corridor['destination_mandi']['hi']} तक माल भेजें, ₹{net_profit:,.0f} का शुद्ध अतिरिक्त लाभ प्राप्त होगा।"
            verdict_te = f"ఖచ్చితంగా సిఫార్సు: {corridor['destination_mandi']['te']} కు తరలిస్తే రూ. {net_profit:,.0f} నికర లాభం లభిస్తుంది."
        elif net_profit > 500:
            verdict_en = f"Profitable: Transporting yields ₹{net_profit:,.0f} net gain after deducting all fuel & driver expenses."
            verdict_hi = f"लाभदायक: पूरा किराया व डीजल खर्च काटकर भी ₹{net_profit:,.0f} का शुद्ध लाभ बचेगा।"
            verdict_te = f"లాభదాయకం: డీజిల్ & కిరాయి ఖర్చులు పోనూ రూ. {net_profit:,.0f} మిగులుతుంది."
        else:
            verdict_en = f"Not Recommended: Freight (₹{total_transport_cost:,.0f}) outweighs the price spread. Better to sell in your local yard."
            verdict_hi = f"सलाह नहीं: भाड़ा खर्च (₹{total_transport_cost:,.0f}) भाव अंतर से अधिक है। स्थानीय मंडी में ही बेचना श्रेयस्कर है।"
            verdict_te = f"సిఫార్సు చేయము: రవాణా ఖర్చు (రూ. {total_transport_cost:,.0f}) ఎక్కువ. స్థానిక మార్కెట్‌లోనే అమ్మడం మేలు."

        verdict_text = verdict_hi if lang == "hi" else (verdict_te if lang == "te" else verdict_en)

        return {
            "status": "success",
            "crop_key": crop,
            "crop_name": corridor["crop_name"].get(lang, corridor["crop_name"]["en"]),
            "origin_mandi": origin_mandi or corridor["local_mandi"].get(lang, corridor["local_mandi"]["en"]),
            "destination_mandi": destination_mandi or corridor["destination_mandi"].get(lang, corridor["destination_mandi"]["en"]),
            "distance_km": eff_distance,
            "round_trip_km": round_trip_distance,
            "load_quintals": load_quintals,
            "vehicle": {
                "type": vehicle_type,
                "name": veh_profile["name"].get(lang, veh_profile["name"]["en"]),
                "rate_per_km": rate_km
            },
            "rates": {
                "local_mandi_modal_qtl": local_price,
                "destination_mandi_modal_qtl": dest_price,
                "price_diff_per_qtl": price_diff_per_qtl
            },
            "expenses": {
                "base_freight": base_freight,
                "estimated_diesel_liters": diesel_liters,
                "estimated_diesel_cost": diesel_expense,
                "toll_and_handling": toll_and_loading,
                "total_transport_cost": total_transport_cost
            },
            "financials": {
                "local_gross_value": local_gross_value,
                "destination_gross_value": dest_gross_value,
                "gross_spread": gross_arbitrage,
                "net_profit": net_profit,
                "break_even_quintals": break_even_quintals,
                "is_profitable": is_profitable
            },
            "reason": corridor["reason"].get(lang, corridor["reason"]["en"]),
            "verdict": verdict_text
        }

    def get_corridors(self, crop_key: Optional[str] = None, lang: str = "en") -> list[dict[str, Any]]:
        """List major recommended terminal corridors."""
        results = []
        keys = [crop_key.lower().strip()] if (crop_key and crop_key.lower().strip() in DEFAULT_CORRIDORS) else list(DEFAULT_CORRIDORS.keys())

        for k in keys:
            c = DEFAULT_CORRIDORS[k]
            spread = c["dest_default_price"] - c["local_default_price"]
            results.append({
                "crop_key": k,
                "crop_name": c["crop_name"].get(lang, c["crop_name"]["en"]),
                "local_mandi": c["local_mandi"].get(lang, c["local_mandi"]["en"]),
                "local_price": c["local_default_price"],
                "destination_mandi": c["destination_mandi"].get(lang, c["destination_mandi"]["en"]),
                "destination_price": c["dest_default_price"],
                "price_spread_qtl": spread,
                "distance_km": c["distance_km"],
                "reason": c["reason"].get(lang, c["reason"]["en"])
            })
        return results


logistics_engine = LogisticsEngine()
