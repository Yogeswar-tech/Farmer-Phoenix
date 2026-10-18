"""Mandi Logistics & Inter-Market Arbitrage Service for Kisan-Sethu.

Provides:
1. Dynamic transport ROI calculation between farm/local yard and major APMC terminals.
2. Real-time modal price lookup from PostgreSQL/SQLite `mandi_prices`.
3. True diesel fuel consumption, toll fees, and vehicle freight cost modeling.
4. Trilingual advisory verdict and break-even quintal volume calculation.
"""

import logging
from typing import Any

logger = logging.getLogger("LogisticsService")

VEHICLE_PROFILES: dict[str, dict[str, Any]] = {
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
    },
    "banana": {
        "crop_name": {"en": "Banana", "hi": "केला", "te": "అరటి"},
        "local_mandi": {"en": "Bhusawal Yard", "hi": "भुसावल यार्ड", "te": "భుసావల్ యార్డ్"},
        "local_default_price": 1750.0,
        "destination_mandi": {"en": "Jalgaon & Raver Banana Terminal", "hi": "जलगांव व रावेर केला टर्मिनल", "te": "జలగావ్ & రావేర్ అరటి టెర్మినల్"},
        "dest_default_price": 2250.0,
        "distance_km": 42.0,
        "reason": {
            "en": "Export container packing stations pay direct premium for uniform G-9 bunches.",
            "hi": "निर्यात कंटेनर पैकिंग स्टेशन उत्तम जी-9 केले पर सीधा अधिमूल्य देते हैं।",
            "te": "ఎగుమతి కంటైనర్ లోడింగ్ కేంద్రాలు ఉత్తమ G-9 రకానికి అధిక ధర చెల్లిస్తాయి."
        }
    },
    "onion": {
        "crop_name": {"en": "Onion", "hi": "प्याज", "te": "ఉల్లిపాయ"},
        "local_mandi": {"en": "Yeola Mandi", "hi": "येवला मंडी", "te": "యేవోలా మార్కెట్"},
        "local_default_price": 2850.0,
        "destination_mandi": {"en": "Lasalgaon Apex Onion Terminal", "hi": "लासलगांव एशिया प्रमुख प्याज टर्मिनल", "te": "లాసల్‌గావ్ ప్రధాన ఉల్లి టెర్మినల్"},
        "dest_default_price": 3450.0,
        "distance_km": 35.0,
        "reason": {
            "en": "Asia's largest onion market features continuous competitive open auction by national wholesalers.",
            "hi": "एशिया की सबसे बड़ी प्याज मंडी में देश भर के थोक खरीदार खुली प्रतिस्पर्धी बोली लगाते हैं।",
            "te": "ఆసియాలోనే అతిపెద్ద ఉల్లి మార్కెట్ లో దేశవ్యాప్త వ్యాపారుల పోటీతో గరిష్ట ధర లభిస్తుంది."
        }
    },
    "potato": {
        "crop_name": {"en": "Potato", "hi": "आलू", "te": "బంగాళాదుంప"},
        "local_mandi": {"en": "Hoshiarpur Yard", "hi": "होशियारपुर यार्ड", "te": "హోషియార్‌పూర్ యార్డ్"},
        "local_default_price": 1850.0,
        "destination_mandi": {"en": "Doaba Mandi Jalandhar / Agra Terminal", "hi": "दोआबा जालंधर / आगरा टर्मिनल", "te": "దోఅబా జలంధర్ / ఆగ్రా టెర్మినల్"},
        "dest_default_price": 2350.0,
        "distance_km": 48.0,
        "reason": {
            "en": "Cold chain aggregators and wafer processing mills purchase graded tubers at top rates.",
            "hi": "प्रोसेसिंग मिलें व कोल्ड चेन खरीदार छांटे गए आलू पर नकद अधिमूल्य देते हैं।",
            "te": "ప్రాసెసింగ్ మిల్లులు & కోల్డ్ చైన్ వ్యాపారులు నాణ్యమైన బంగాళాదుంపలకు నగదు చెల్లింపు చేస్తారు."
        }
    },
    "wheat": {
        "crop_name": {"en": "Wheat", "hi": "गेहूं", "te": "గోధుమ"},
        "local_mandi": {"en": "Ashta Mandi", "hi": "आष्टा मंडी", "te": "ఆష్టా మార్కెట్"},
        "local_default_price": 2850.0,
        "destination_mandi": {"en": "Sehore APMC Terminal (Sharbati Gold)", "hi": "सीहोर शरबती गोल्ड टर्मिनल", "te": "సిహోర్ గోధుమ టెర్మినల్"},
        "dest_default_price": 3350.0,
        "distance_km": 38.0,
        "reason": {
            "en": "Flour mills and export procurement agencies compete aggressively for Sharbati premium lots.",
            "hi": "आटा मिलें व प्रीमियम खरीदार शरबती किस्म पर सरकारी भाव से काफी ऊंचा मूल्य देते हैं।",
            "te": "పిండి మిల్లులు శర్బతి రకం నాణ్యమైన గోధుమలకు మార్కెట్ కంటే ఎక్కువ చెల్లిస్తాయి."
        }
    },
    "turmeric": {
        "crop_name": {"en": "Turmeric", "hi": "हल्दी", "te": "పసుపు"},
        "local_mandi": {"en": "Duggirala Yard", "hi": "दुग्गिराला यार्ड", "te": "దుగ్గిరాల యార్డ్"},
        "local_default_price": 14500.0,
        "destination_mandi": {"en": "Nizamabad / Sangli Spices Terminal", "hi": "निजामाबाद / सांगली मसाला टर्मिनल", "te": "నిజామాబాద్ / సాంగ్లీ సుగంధ ద్రవ్యాల టెర్మినల్"},
        "dest_default_price": 16800.0,
        "distance_km": 65.0,
        "reason": {
            "en": "High curcumin finger varieties fetch instant pan-India pharmaceutical and export bidding.",
            "hi": "उच्च करक्यूमिन वाली हल्दी पर फार्मास्यूटिकल व मसाला निर्यातक भारी बोली लगाते हैं।",
            "te": "అధిక కర్క్యుమిన్ గల పసుపు కొమ్ములకు ఫార్మా & ఎగుమతి వ్యాపారుల నుంచి అత్యధిక ధర."
        }
    },
    "orange": {
        "crop_name": {"en": "Orange", "hi": "संतरा", "te": "నారింజ"},
        "local_mandi": {"en": "Katol Mandi", "hi": "काटोल मंडी", "te": "కాటోల్ మార్కెట్"},
        "local_default_price": 3600.0,
        "destination_mandi": {"en": "Nagpur Kalamna Citrus Terminal", "hi": "नागपुर कलमना संतरा टर्मिनल", "te": "నాగ్‌పూర్ కలమ్నా నారింజ టెర్మినల్"},
        "dest_default_price": 4350.0,
        "distance_km": 54.0,
        "reason": {
            "en": "Direct wholesale reefer dispatch to Delhi, Mumbai, and Bangalore markets.",
            "hi": "दिल्ली, मुंबई व बेंगलुरु हेतु रीफर ट्रकों में सीधी थोक लोडिंग व नगद भुगतान।",
            "te": "ఢిల్లీ, ముంబై, బెంగళూరు మార్కెట్లకు నేరుగా రీఫర్ ట్రక్కులలో రవాణా సౌకర్యం."
        }
    },
    "grapes": {
        "crop_name": {"en": "Grapes", "hi": "अंगूर", "te": "ద్రాక్ష"},
        "local_mandi": {"en": "Dindori Yard", "hi": "दिंडोरी यार्ड", "te": "దిండోరి యార్డ్"},
        "local_default_price": 5800.0,
        "destination_mandi": {"en": "Nashik Pimpalgaon Export Terminal", "hi": "नासिक पिंपलगांव निर्यात टर्मिनल", "te": "నాసిక్ పింపల్‌గావ్ ఎగుమతి టెర్మినల్"},
        "dest_default_price": 6900.0,
        "distance_km": 40.0,
        "reason": {
            "en": "APEDA export packing houses offer top cash bonus for Thomson seedless blemish-free bunches.",
            "hi": "थॉमसन सीडलेस अंगूर पर अपीडा निर्यात पैक हाउस सर्वोच्च प्रीमियम देते हैं।",
            "te": "ఎగుమతి ప్యాకింగ్ కేంద్రాలు నాణ్యమైన థాంప్సన్ సీడ్‌లెస్ ద్రాక్షకు అధిక ప్రీమియం ఇస్తాయి."
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
        distance_km: float | None = None,
        origin_mandi: str | None = None,
        destination_mandi: str | None = None,
        lang: str = "en"
    ) -> dict[str, Any]:
        """Calculates round-trip transport logistics, gross spread, and net profit."""
        crop = crop_key.lower().strip().replace(" ", "_")
        corridor = DEFAULT_CORRIDORS.get(crop)

        # Dynamic fallback: if not in static list, query live catalog search
        if not corridor:
            try:
                from scrapers.todays_live_page_scraper import search_live_today_crop
                search_res = search_live_today_crop(crop_key)
                if search_res and search_res.get("status") == "success":
                    comm_name = search_res.get("commodity", crop_key.title())
                    base_modal = float(search_res.get("modal_price_qtl", 3000.0))
                    nearest = search_res.get("nearest_markets", [])
                    best_dest = max(nearest, key=lambda m: float(m.get("price_qtl", 0))) if nearest else None
                    dest_name = best_dest.get("market", f"{comm_name} Regional Apex Terminal") if best_dest else f"{comm_name} Regional Terminal"
                    dest_p = float(best_dest.get("price_qtl", round(base_modal * 1.15, 2))) if best_dest else round(base_modal * 1.15, 2)

                    corridor = {
                        "crop_name": {"en": comm_name, "hi": comm_name, "te": comm_name},
                        "local_mandi": {"en": search_res.get("market", "Local APMC Yard"), "hi": search_res.get("market", "स्थानीय यार्ड"), "te": search_res.get("market", "లోకల్ యార్డ్")},
                        "local_default_price": base_modal,
                        "destination_mandi": {"en": dest_name, "hi": dest_name, "te": dest_name},
                        "dest_default_price": dest_p,
                        "distance_km": 45.0,
                        "reason": {
                            "en": search_res.get("selling_advice", "Terminal market features high wholesale volume and competitive bidding."),
                            "hi": search_res.get("selling_advice", "प्रमुख मंडी में थोक खरीदारों की अधिक प्रतिस्पर्धा से बेहतर मूल्य मिलता है।"),
                            "te": search_res.get("selling_advice", "ప్రధాన మార్కెట్లో ఎక్కువ మంది కొనుగోలుదారులు ఉండటం వలన మంచి ధర లభిస్తుంది.")
                        }
                    }
            except Exception as exc:
                logger.debug("Dynamic catalog corridor generation notice: %s", exc)

        if not corridor:
            corridor = DEFAULT_CORRIDORS["chilli"]

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

        # Also check open Mandi API for live inter-market price spread
        try:
            from scrapers.todays_live_page_scraper import fetch_live_open_mandi_api
            api_data = fetch_live_open_mandi_api(crop)
            if api_data and len(api_data) >= 2:
                prices = [float(r["modal_price"]) for r in api_data if r.get("modal_price")]
                if prices and max(prices) > min(prices):
                    dest_price = max(prices)
                    local_price = min(prices)
        except Exception as _ex:
            logger.debug("Open Mandi API arbitrage lookup fallback: %s", _ex)

        # Allow user to override origin/dest names
        if origin_mandi and origin_mandi.strip():
            corridor_origin = origin_mandi.strip()
        else:
            corridor_origin = corridor["local_mandi"].get(lang, corridor["local_mandi"]["en"])

        if destination_mandi and destination_mandi.strip():
            corridor_dest = destination_mandi.strip()
        else:
            corridor_dest = corridor["destination_mandi"].get(lang, corridor["destination_mandi"]["en"])

        # Financial Calculations
        rate_km = float(veh_profile["rate_per_km"])
        round_trip_distance = float(eff_distance) * 2.0
        base_freight = round_trip_distance * rate_km
        fuel_economy = float(veh_profile["fuel_economy_kmpl"])
        diesel_liters = round(round_trip_distance / fuel_economy, 1)
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
            verdict_en = f"Highly Recommended: Transport to {corridor_dest} for an estimated net extra profit of ₹{net_profit:,.0f}."
            verdict_hi = f"अत्यंत अनुशंसित: {corridor_dest} तक माल भेजें, ₹{net_profit:,.0f} का शुद्ध अतिरिक्त लाभ प्राप्त होगा।"
            verdict_te = f"ఖచ్చితంగా సిఫార్సు: {corridor_dest} కు తరలిస్తే రూ. {net_profit:,.0f} నికర లాభం లభిస్తుంది."
        elif net_profit > 500:
            verdict_en = f"Profitable: Transporting yields ₹{net_profit:,.0f} net gain after deducting all fuel & driver expenses."
            verdict_hi = f"लाभदायक: पूरा किराया व डीजल खर्च काटकर भी ₹{net_profit:,.0f} का शुद्ध लाभ बचेगा।"
            verdict_te = f"లాభదాయకం: డీజిల్ & కిరాయి ఖర్చులు పోనూ రూ. {net_profit:,.0f} మిగులుతుంది."
        else:
            verdict_en = f"Not Recommended: Freight (₹{total_transport_cost:,.0f}) outweighs the price spread. Better to sell in your local yard."
            verdict_hi = f"सलाह नहीं: भाड़ा खर्च (₹{total_transport_cost:,.0f}) भाव अंतर से अधिक है। स्थानीय मंडी में ही बेचना श्रेयस्कर है।"
            verdict_te = f"సిఫార్సు చేయము: రవాణా ఖర్చు (రూ. {total_transport_cost:,.0f}) ఎక్కువ. స్థానిక మార్కెట్‌లోనే అమ్మడం మేలు."

        verdict_text = verdict_hi if lang == "hi" else (verdict_te if lang == "te" else verdict_en)

        veh_name_data = veh_profile["name"]
        veh_name_str = veh_name_data.get(lang, veh_name_data.get("en", "")) if isinstance(veh_name_data, dict) else str(veh_name_data)

        return {
            "status": "success",
            "crop_key": crop,
            "crop_name": corridor["crop_name"].get(lang, corridor["crop_name"]["en"]),
            "origin_mandi": corridor_origin,
            "destination_mandi": corridor_dest,
            "distance_km": eff_distance,
            "round_trip_km": round_trip_distance,
            "load_quintals": load_quintals,
            "vehicle": {
                "type": vehicle_type,
                "name": veh_name_str,
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

    def get_corridors(self, crop_key: str | None = None, lang: str = "en") -> list[dict[str, Any]]:
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
