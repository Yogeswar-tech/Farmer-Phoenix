"""
Seed Pan-India Cold Storage Network into PostgreSQL & SQLite.
Covers major horticultural, spice, and agricultural production belts across India:
- Andhra Pradesh (Guntur, Chittoor/Madanapalle, Kurnool, Krishna, Anantapur, Kadapa, Ongole)
- Telangana (Warangal, Khammam, Hyderabad, Nizamabad)
- Maharashtra (Nashik/Lasalgaon, Pune, Nagpur, Solapur)
- Karnataka (Kolar, Bangalore Rural, Belagavi, Shimoga)
- Punjab & Haryana (Fazilka/Abohar, Jalandhar, Karnal)
- Himachal Pradesh & J&K (Shimla/Kotkhai, Sopore/Baramulla)
- Uttar Pradesh & Bihar (Agra, Varanasi, Hajipur)
- Madhya Pradesh & Gujarat (Indore, Gondal/Rajkot, Deesa)
- Tamil Nadu & West Bengal (Dindigul, Hooghly)
"""

import os
import sys

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from database.connection import get_db_cursor, is_postgres_active

PAN_INDIA_COLD_STORAGES = [
    # --- ANDHRA PRADESH ---
    {
        "facility_id": "cs_guntur_spices",
        "name": "Guntur Spices & Mirchi Cold Logistics Terminal",
        "district": "Guntur",
        "state": "Andhra Pradesh",
        "latitude": 16.3067,
        "longitude": 80.4365,
        "capacity_mt": 18000,
        "available_mt": 4800,
        "monthly_rent_per_qtl": 110.00,
        "contact_phone": "+91 863 2234567",
        "facility_meta": {
            "name_hi": "गुंटूर मसाला एवं लाल मिर्च कोल्ड लॉजिस्टिक्स टर्मिनल",
            "name_te": "గుంటూరు మిర్చి & స్పైసెస్ కోల్డ్ లాజిస్టిక్స్ టెర్మినల్",
            "address": "NH-16, Near APMC Mirchi Yard, Autonagar, Guntur",
            "crops": ["Chilli", "Turmeric", "Coriander", "Tobacco"],
            "chambers": 10,
            "temp_range_c": "2°C to 8°C",
            "humidity_pct": "60-65%",
            "wdra_accredited": True,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 28
        }
    },
    {
        "facility_id": "cs_tirupati_hub",
        "name": "Tirupati Regional Agro Cold Terminal",
        "district": "Tirupati",
        "state": "Andhra Pradesh",
        "latitude": 13.6288,
        "longitude": 79.4192,
        "capacity_mt": 9000,
        "available_mt": 3100,
        "monthly_rent_per_qtl": 115.00,
        "contact_phone": "+91 877 2256789",
        "facility_meta": {
            "name_hi": "तिरुपति क्षेत्रीय कृषि कोल्ड टर्मिनल",
            "name_te": "తిరుపతి ప్రాంతీయ వ్యవసాయ కోల్డ్ టెర్మినల్",
            "address": "Renigunta Industrial Area, Near Airport Road, Tirupati",
            "crops": ["Tomato", "Mango", "Banana", "Vegetables"],
            "chambers": 6,
            "temp_range_c": "4°C to 12°C",
            "humidity_pct": "85-90%",
            "wdra_accredited": True,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 29
        }
    },
    {
        "facility_id": "cs_madanapalle_fresh",
        "name": "Rayalaseema Agro Fresh CA Cold Chain",
        "district": "Chittoor",
        "state": "Andhra Pradesh",
        "latitude": 13.5560,
        "longitude": 78.5010,
        "capacity_mt": 12000,
        "available_mt": 3600,
        "monthly_rent_per_qtl": 130.00,
        "contact_phone": "+91 8571 228899",
        "facility_meta": {
            "name_hi": "रायलसीमा एग्रो फ्रेश सीए कोल्ड चेन",
            "name_te": "రాయలసీమ అగ్రో ఫ్రెష్ సి.ఎ కోల్డ్ చైన్",
            "address": "Madanapalle-Bangalore Highway, Near APMC Market Yard",
            "crops": ["Tomato", "Mango", "Papaya", "Pomegranate"],
            "chambers": 8,
            "temp_range_c": "10°C to 14°C",
            "humidity_pct": "88-92%",
            "wdra_accredited": True,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 32
        }
    },
    {
        "facility_id": "cs_kurnool_onion",
        "name": "Kurnool Cotton & Onion Cold Storage Terminal",
        "district": "Kurnool",
        "state": "Andhra Pradesh",
        "latitude": 15.8281,
        "longitude": 78.0373,
        "capacity_mt": 14000,
        "available_mt": 4200,
        "monthly_rent_per_qtl": 95.00,
        "contact_phone": "+91 8518 220055",
        "facility_meta": {
            "name_hi": "कर्नूल प्याज एवं कपास शीत भंडारण टर्मिनल",
            "name_te": "కర్నూలు ఉల్లి & పత్తి కోల్డ్ స్టోరేజ్ టెర్మినల్",
            "address": "Bellary Road, Near APMC Onion Yard, Kurnool",
            "crops": ["Onion", "Chilli", "Groundnut", "Cotton Seed"],
            "chambers": 8,
            "temp_range_c": "1°C to 4°C",
            "humidity_pct": "65-70%",
            "wdra_accredited": True,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 24
        }
    },
    {
        "facility_id": "cs_vijayawada_delta",
        "name": "Krishna Delta Multi-Chamber Agro Godown",
        "district": "Krishna",
        "state": "Andhra Pradesh",
        "latitude": 16.5062,
        "longitude": 80.6480,
        "capacity_mt": 20000,
        "available_mt": 5400,
        "monthly_rent_per_qtl": 120.00,
        "contact_phone": "+91 866 2489011",
        "facility_meta": {
            "name_hi": "कृष्णा डेल्टा मल्टी-चेंबर एग्रो गोदाम",
            "name_te": "కృష్ణా డెల్టా మల్టీ-ఛాంబర్ అగ్రో కోల్డ్ గోదాము",
            "address": "Kankipadu Road, NH-65, Vijayawada Rural",
            "crops": ["Mango", "Chilli", "Turmeric", "Banana", "Vegetables"],
            "chambers": 12,
            "temp_range_c": "2°C to 12°C",
            "humidity_pct": "75-85%",
            "wdra_accredited": True,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 30
        }
    },
    {
        "facility_id": "cs_anantapur_horti",
        "name": "Anantapur Agro Dry-Cold Horticultural Warehouse",
        "district": "Anantapur",
        "state": "Andhra Pradesh",
        "latitude": 14.6819,
        "longitude": 77.6006,
        "capacity_mt": 11000,
        "available_mt": 3900,
        "monthly_rent_per_qtl": 105.00,
        "contact_phone": "+91 8554 240011",
        "facility_meta": {
            "name_hi": "अनंतपुर कृषि शुष्क-शीत बागवानी वेयरहाउस",
            "name_te": "అనంతపురం అగ్రో డ్రై-కోల్డ్ ఉద్యానవన వేర్‌హౌస్",
            "address": "Gooty Road, Near Anantapur APMC Yard",
            "crops": ["Groundnut", "Sweet Orange", "Pomegranate", "Banana"],
            "chambers": 6,
            "temp_range_c": "5°C to 10°C",
            "humidity_pct": "70-80%",
            "wdra_accredited": True,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 26
        }
    },
    {
        "facility_id": "cs_kadapa_spices",
        "name": "Kadapa Horticultural Preservation Terminal",
        "district": "Kadapa",
        "state": "Andhra Pradesh",
        "latitude": 14.4673,
        "longitude": 78.8242,
        "capacity_mt": 8500,
        "available_mt": 2800,
        "monthly_rent_per_qtl": 110.00,
        "contact_phone": "+91 8562 241100",
        "facility_meta": {
            "name_hi": "कडपा बागवानी संरक्षण कोल्ड टर्मिनल",
            "name_te": "కడప ఉద్యానవన పంటల కోల్డ్ స్టోరేజ్ టెర్మినల్",
            "address": "RIMS Road, Putlampalli, Kadapa",
            "crops": ["Turmeric", "Banana", "Sweet Orange", "Onion"],
            "chambers": 5,
            "temp_range_c": "4°C to 12°C",
            "humidity_pct": "75-80%",
            "wdra_accredited": True,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 27
        }
    },
    {
        "facility_id": "cs_ongole_agro",
        "name": "Ongole Coastal Agro Cold Godown",
        "district": "Prakasam",
        "state": "Andhra Pradesh",
        "latitude": 15.5057,
        "longitude": 80.0499,
        "capacity_mt": 9500,
        "available_mt": 2900,
        "monthly_rent_per_qtl": 112.00,
        "contact_phone": "+91 8592 233400",
        "facility_meta": {
            "name_hi": "ओंगोल तटीय कृषि शीत गोदाम",
            "name_te": "ఒంగోలు కోస్తా వ్యవసాయ కోల్డ్ గోదాము",
            "address": "NH-16 By-pass, Pernamitta, Ongole",
            "crops": ["Tobacco", "Chilli", "Bengal Gram", "Pulses"],
            "chambers": 6,
            "temp_range_c": "4°C to 8°C",
            "humidity_pct": "60-65%",
            "wdra_accredited": False,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 28
        }
    },

    # --- TELANGANA ---
    {
        "facility_id": "cs_warangal_chilli",
        "name": "Warangal Enamamula Agro Cold Storage",
        "district": "Warangal",
        "state": "Telangana",
        "latitude": 17.9689,
        "longitude": 79.5941,
        "capacity_mt": 16000,
        "available_mt": 4100,
        "monthly_rent_per_qtl": 105.00,
        "contact_phone": "+91 870 2441122",
        "facility_meta": {
            "name_hi": "वारंगल एनामामुला कृषि शीत भंडारण",
            "name_te": "వరంగల్ ఏనుమాముల అగ్రో కోల్డ్ స్టోరేజ్",
            "address": "Opp. Enamamula Market Yard, Warangal",
            "crops": ["Chilli", "Cotton", "Turmeric", "Maize"],
            "chambers": 8,
            "temp_range_c": "2°C to 8°C",
            "humidity_pct": "65-70%",
            "wdra_accredited": True,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 26
        }
    },
    {
        "facility_id": "cs_khammam_spices",
        "name": "Khammam Mirchi & Spices Preservation Hub",
        "district": "Khammam",
        "state": "Telangana",
        "latitude": 17.2473,
        "longitude": 80.1514,
        "capacity_mt": 14000,
        "available_mt": 3500,
        "monthly_rent_per_qtl": 108.00,
        "contact_phone": "+91 8742 225588",
        "facility_meta": {
            "name_hi": "खम्मम मिर्च एवं मसाला संरक्षण केंद्र",
            "name_te": "ఖమ్మం మిర్చి & సుగంధ ద్రవ్యాల కోల్డ్ హబ్",
            "address": "Wyra Road, Near APMC Yard, Khammam",
            "crops": ["Chilli", "Cotton", "Mango", "Corn"],
            "chambers": 8,
            "temp_range_c": "2°C to 8°C",
            "humidity_pct": "60-65%",
            "wdra_accredited": True,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 27
        }
    },
    {
        "facility_id": "cs_hyderabad_cargo",
        "name": "Hyderabad Airport Perishable Cold Cargo Hub",
        "district": "Rangareddy",
        "state": "Telangana",
        "latitude": 17.2403,
        "longitude": 78.4294,
        "capacity_mt": 25000,
        "available_mt": 7200,
        "monthly_rent_per_qtl": 145.00,
        "contact_phone": "+91 40 6676 4000",
        "facility_meta": {
            "name_hi": "हैदराबाद एयरपोर्ट परिशेबल कोल्ड कार्गो टर्मिनल",
            "name_te": "హైదరాబాద్ ఎయిర్‌పోర్ట్ పెరిషబుల్ కోల్డ్ కార్గో హబ్",
            "address": "GMR Cargo Village, Shamshabad, Hyderabad",
            "crops": ["Vegetables", "Fruits", "Grapes", "Floriculture", "Tomato"],
            "chambers": 14,
            "temp_range_c": "-2°C to 12°C",
            "humidity_pct": "85-95%",
            "wdra_accredited": True,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 36
        }
    },
    {
        "facility_id": "cs_nizamabad_turmeric",
        "name": "Nizamabad Turmeric & Seed Cold Terminal",
        "district": "Nizamabad",
        "state": "Telangana",
        "latitude": 18.6725,
        "longitude": 78.0941,
        "capacity_mt": 11500,
        "available_mt": 3300,
        "monthly_rent_per_qtl": 100.00,
        "contact_phone": "+91 8462 230044",
        "facility_meta": {
            "name_hi": "निज़ामाबाद हल्दी एवं बीज कोल्ड टर्मिनल",
            "name_te": "నిజామాబాద్ పసుపు & విత్తనాల కోల్డ్ టెర్మినల్",
            "address": "Armoor Road, Near Market Committee, Nizamabad",
            "crops": ["Turmeric", "Soybean", "Maize", "Paddy Seed"],
            "chambers": 6,
            "temp_range_c": "4°C to 10°C",
            "humidity_pct": "60-65%",
            "wdra_accredited": True,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 25
        }
    },

    # --- MAHARASHTRA ---
    {
        "facility_id": "cs_lasalgaon_onion",
        "name": "Sahyadri Onion & Grape Cold Preservation Terminal",
        "district": "Nashik",
        "state": "Maharashtra",
        "latitude": 20.1471,
        "longitude": 74.2254,
        "capacity_mt": 22000,
        "available_mt": 6800,
        "monthly_rent_per_qtl": 95.00,
        "contact_phone": "+91 2592 245112",
        "facility_meta": {
            "name_hi": "सह्याद्री प्याज एवं अंगूर कोल्ड प्रिजर्वेशन टर्मिनल",
            "name_te": "సహ్యాద్రి ఉల్లి & ద్రాక్ష కోల్డ్ టెర్మినల్",
            "address": "Niphad-Lasalgaon Road, APMC Yard, Lasalgaon, Nashik",
            "crops": ["Onion", "Grapes", "Pomegranate", "Tomato"],
            "chambers": 12,
            "temp_range_c": "0°C to 4°C",
            "humidity_pct": "65-70%",
            "wdra_accredited": True,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 24
        }
    },
    {
        "facility_id": "cs_pune_veg",
        "name": "Narayangaon Tomato & Veg Multi-Chamber Storage",
        "district": "Pune",
        "state": "Maharashtra",
        "latitude": 19.1200,
        "longitude": 73.9780,
        "capacity_mt": 13500,
        "available_mt": 3800,
        "monthly_rent_per_qtl": 125.00,
        "contact_phone": "+91 2132 242010",
        "facility_meta": {
            "name_hi": "नारायणगांव टमाटर एवं सब्जी मल्टी-चेंबर स्टोरेज",
            "name_te": "నారాయణగావ్ టమోటా & వెజిటబుల్ కోల్డ్ స్టోరేజ్",
            "address": "Pune-Nashik Highway, Narayangaon, Pune",
            "crops": ["Tomato", "Capsicum", "Cauliflower", "Pomegranate"],
            "chambers": 8,
            "temp_range_c": "8°C to 12°C",
            "humidity_pct": "85-90%",
            "wdra_accredited": True,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 31
        }
    },
    {
        "facility_id": "cs_nagpur_citrus",
        "name": "Orange City Citrus Cold Chain Terminal",
        "district": "Nagpur",
        "state": "Maharashtra",
        "latitude": 21.1458,
        "longitude": 79.0882,
        "capacity_mt": 15000,
        "available_mt": 4900,
        "monthly_rent_per_qtl": 115.00,
        "contact_phone": "+91 712 2568890",
        "facility_meta": {
            "name_hi": "ऑरेंज सिटी संतरा कोल्ड चेन टर्मिनल",
            "name_te": "ఆరెంజ్ సిటీ సిట్రస్ కోల్డ్ చైన్ టెర్మినల్",
            "address": "Kalamna Market Yard, Nagpur",
            "crops": ["Orange", "Mosambi", "Chilli", "Soybean Seed"],
            "chambers": 10,
            "temp_range_c": "5°C to 9°C",
            "humidity_pct": "85-90%",
            "wdra_accredited": True,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 29
        }
    },
    {
        "facility_id": "cs_solapur_fruits",
        "name": "Solapur Pomegranate & Agro Cold Terminal",
        "district": "Solapur",
        "state": "Maharashtra",
        "latitude": 17.6599,
        "longitude": 75.9064,
        "capacity_mt": 10000,
        "available_mt": 2700,
        "monthly_rent_per_qtl": 120.00,
        "contact_phone": "+91 217 2623344",
        "facility_meta": {
            "name_hi": "सोलापुर अनार एवं कृषि कोल्ड टर्मिनल",
            "name_te": "షోలాపూర్ దానిమ్మ & అగ్రో కోల్డ్ టెర్మినల్",
            "address": "Barshi Road, APMC Market, Solapur",
            "crops": ["Pomegranate", "Grapes", "Onion", "Jowar"],
            "chambers": 6,
            "temp_range_c": "5°C to 10°C",
            "humidity_pct": "80-85%",
            "wdra_accredited": True,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 30
        }
    },

    # --- KARNATAKA ---
    {
        "facility_id": "cs_kolar_horticulture",
        "name": "Kolar Mega Food Park Cold Terminal",
        "district": "Kolar",
        "state": "Karnataka",
        "latitude": 13.1367,
        "longitude": 78.1292,
        "capacity_mt": 17000,
        "available_mt": 4600,
        "monthly_rent_per_qtl": 125.00,
        "contact_phone": "+91 8152 234120",
        "facility_meta": {
            "name_hi": "कोलार मेगा फूड पार्क कोल्ड टर्मिनल",
            "name_te": "కోలార్ మెగా ఫుడ్ పార్క్ కోల్డ్ టెర్మినల్",
            "address": "KIADB Industrial Area, Tamaka, Kolar",
            "crops": ["Tomato", "Mango", "Beans", "Capsicum", "Potato"],
            "chambers": 10,
            "temp_range_c": "4°C to 12°C",
            "humidity_pct": "85-92%",
            "wdra_accredited": True,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 31
        }
    },
    {
        "facility_id": "cs_bangalore_nelamangala",
        "name": "Nelamangala Agro Cold Distribution Hub",
        "district": "Bangalore Rural",
        "state": "Karnataka",
        "latitude": 13.0995,
        "longitude": 77.3912,
        "capacity_mt": 24000,
        "available_mt": 6200,
        "monthly_rent_per_qtl": 140.00,
        "contact_phone": "+91 80 2772 3500",
        "facility_meta": {
            "name_hi": "नेलमंगला एग्रो कोल्ड डिस्ट्रीब्यूशन हब",
            "name_te": "నేలమంగళ అగ్రో కోల్డ్ డిస్ట్రిబ్యూషన్ హబ్",
            "address": "NH-48 Tumkur Road, Nelamangala, Bengaluru",
            "crops": ["Potato", "Onion", "Tomato", "Carrot", "Fruits"],
            "chambers": 12,
            "temp_range_c": "2°C to 10°C",
            "humidity_pct": "80-90%",
            "wdra_accredited": True,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 35
        }
    },
    {
        "facility_id": "cs_belagavi_potato",
        "name": "Belagavi Potato & Vegetable Cold Godown",
        "district": "Belagavi",
        "state": "Karnataka",
        "latitude": 15.8497,
        "longitude": 74.4977,
        "capacity_mt": 12000,
        "available_mt": 3400,
        "monthly_rent_per_qtl": 110.00,
        "contact_phone": "+91 831 2470120",
        "facility_meta": {
            "name_hi": "बेलगावी आलू एवं सब्जी कोल्ड गोदाम",
            "name_te": "బెల్గాం బంగాళాదుంప & వెజిటబుల్ కోల్డ్ గోదాము",
            "address": "Auto Nagar Industrial Estate, Belagavi",
            "crops": ["Potato", "Onion", "Tomato", "Sweet Corn"],
            "chambers": 6,
            "temp_range_c": "2°C to 8°C",
            "humidity_pct": "85-90%",
            "wdra_accredited": True,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 28
        }
    },

    # --- NORTH & CENTRAL (PUNJAB, HARYANA, UP, HP, MP, GUJARAT) ---
    {
        "facility_id": "cs_agra_potato",
        "name": "Taj Agro Potato & Multi-Chamber Cold Chain",
        "district": "Agra",
        "state": "Uttar Pradesh",
        "latitude": 27.1767,
        "longitude": 78.0081,
        "capacity_mt": 28000,
        "available_mt": 7500,
        "monthly_rent_per_qtl": 90.00,
        "contact_phone": "+91 562 2280045",
        "facility_meta": {
            "name_hi": "ताज एग्रो आलू एवं मल्टी-चेंबर कोल्ड चेन",
            "name_te": "తాజ్ అగ్రో బంగాళాదుంప కోల్డ్ చైన్",
            "address": "Fatehabad Road, Khandari By-pass, Agra",
            "crops": ["Potato", "Garlic", "Carrot", "Vegetables"],
            "chambers": 14,
            "temp_range_c": "2°C to 4°C",
            "humidity_pct": "85-92%",
            "wdra_accredited": True,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 22
        }
    },
    {
        "facility_id": "cs_shimla_apple_ca",
        "name": "Himachal Apple Belt Controlled Atmosphere (CA) Store",
        "district": "Shimla",
        "state": "Himachal Pradesh",
        "latitude": 31.1048,
        "longitude": 77.1734,
        "capacity_mt": 16000,
        "available_mt": 3900,
        "monthly_rent_per_qtl": 160.00,
        "contact_phone": "+91 177 2652130",
        "facility_meta": {
            "name_hi": "हिमाचल सेब बेल्ट नियंत्रित वातावरण (CA) कोल्ड स्टोर",
            "name_te": "హిమాచల్ యాపిల్ కంట్రోల్డ్ అట్మాస్ఫియర్ (సి.ఎ) స్టోర్",
            "address": "Kotkhai-Theog Fruit Terminal, Shimla",
            "crops": ["Apple", "Pear", "Cherry", "Plum"],
            "chambers": 10,
            "temp_range_c": "-1°C to 2°C",
            "humidity_pct": "92-96%",
            "wdra_accredited": True,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 40
        }
    },
    {
        "facility_id": "cs_abohar_citrus",
        "name": "Abohar Kinnow & Citrus Cold Preservation Terminal",
        "district": "Fazilka",
        "state": "Punjab",
        "latitude": 30.1450,
        "longitude": 74.1993,
        "capacity_mt": 14500,
        "available_mt": 4300,
        "monthly_rent_per_qtl": 100.00,
        "contact_phone": "+91 1634 223150",
        "facility_meta": {
            "name_hi": "अबोहर किन्नू एवं खट्टे फल शीत संरक्षण टर्मिनल",
            "name_te": "అబోహర్ కిన్నో కోల్డ్ స్టోరేజ్ టెర్మినల్",
            "address": "Malout Road, Near Mandi Gate, Abohar, Fazilka",
            "crops": ["Kinnow", "Orange", "Guava", "Pea"],
            "chambers": 8,
            "temp_range_c": "4°C to 8°C",
            "humidity_pct": "85-90%",
            "wdra_accredited": True,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 25
        }
    },
    {
        "facility_id": "cs_jalandhar_potato",
        "name": "Doaba Seed Potato Cold Terminal",
        "district": "Jalandhar",
        "state": "Punjab",
        "latitude": 31.3260,
        "longitude": 75.5762,
        "capacity_mt": 26000,
        "available_mt": 6800,
        "monthly_rent_per_qtl": 92.00,
        "contact_phone": "+91 181 2621450",
        "facility_meta": {
            "name_hi": "दोआबा बीज आलू शीत भंडारण टर्मिनल",
            "name_te": "దోఅబా సీడ్ పొటాటో కోల్డ్ టెర్మినల్",
            "address": "GT Road, Near Maqsudan Mandi, Jalandhar",
            "crops": ["Potato", "Pea", "Carrot", "Garlic"],
            "chambers": 12,
            "temp_range_c": "2°C to 4°C",
            "humidity_pct": "85-90%",
            "wdra_accredited": True,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 23
        }
    },
    {
        "facility_id": "cs_indore_potato",
        "name": "Malwa Potato & Garlic Cold Logistics Terminal",
        "district": "Indore",
        "state": "Madhya Pradesh",
        "latitude": 22.7196,
        "longitude": 75.8577,
        "capacity_mt": 21000,
        "available_mt": 5800,
        "monthly_rent_per_qtl": 95.00,
        "contact_phone": "+91 731 2541180",
        "facility_meta": {
            "name_hi": "मालवा आलू एवं लहसुन कोल्ड लॉजिस्टिक्स टर्मिनल",
            "name_te": "మాల్వా బంగాళాదుంప & వెల్లుల్లి కోల్డ్ టెర్మినల్",
            "address": "Nemawar Road, Near Choithram Mandi, Indore",
            "crops": ["Potato", "Garlic", "Onion", "Soybean Seed"],
            "chambers": 10,
            "temp_range_c": "2°C to 6°C",
            "humidity_pct": "80-85%",
            "wdra_accredited": True,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 24
        }
    },
    {
        "facility_id": "cs_gondal_spices",
        "name": "Saurashtra Chilli & Groundnut Cold Facility",
        "district": "Rajkot",
        "state": "Gujarat",
        "latitude": 21.9619,
        "longitude": 70.7923,
        "capacity_mt": 16000,
        "available_mt": 4700,
        "monthly_rent_per_qtl": 105.00,
        "contact_phone": "+91 2825 221040",
        "facility_meta": {
            "name_hi": "सौराष्ट्र लाल मिर्च एवं मूंगफली कोल्ड केंद्र",
            "name_te": "సౌరాష్ట్ర మిర్చి & వేరుశనగ కోల్డ్ స్టోరేజ్",
            "address": "Bhojrajpara, Gondal APMC Yard, Rajkot",
            "crops": ["Chilli", "Groundnut", "Sesame", "Cumin", "Coriander"],
            "chambers": 8,
            "temp_range_c": "4°C to 8°C",
            "humidity_pct": "60-65%",
            "wdra_accredited": True,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 26
        }
    },
    {
        "facility_id": "cs_deesa_potato",
        "name": "Deesa Mega Potato Cold Hub",
        "district": "Banaskantha",
        "state": "Gujarat",
        "latitude": 24.2586,
        "longitude": 72.1793,
        "capacity_mt": 32000,
        "available_mt": 8900,
        "monthly_rent_per_qtl": 88.00,
        "contact_phone": "+91 2744 220550",
        "facility_meta": {
            "name_hi": "डीसा मेगा आलू शीत भंडारण केंद्र",
            "name_te": "డీసా మెగా బంగాళాదుంప కోల్డ్ హబ్",
            "address": "Highway Road, APMC Cold Complex, Deesa",
            "crops": ["Potato", "Groundnut", "Pomegranate"],
            "chambers": 16,
            "temp_range_c": "2°C to 4°C",
            "humidity_pct": "85-90%",
            "wdra_accredited": True,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 22
        }
    },
    {
        "facility_id": "cs_sopore_apple",
        "name": "Kashmir Valley CA Apple Terminal",
        "district": "Baramulla",
        "state": "Jammu & Kashmir",
        "latitude": 34.2982,
        "longitude": 74.4697,
        "capacity_mt": 20000,
        "available_mt": 4900,
        "monthly_rent_per_qtl": 165.00,
        "contact_phone": "+91 1954 222180",
        "facility_meta": {
            "name_hi": "कश्मीर घाटी सीए सेब भंडारण टर्मिनल",
            "name_te": "కాశ్మీర్ వ్యాలీ సి.ఎ యాపిల్ టెర్మినల్",
            "address": "Fruit Mandi Sopore, Baramulla",
            "crops": ["Apple", "Pear", "Walnut", "Cherry"],
            "chambers": 12,
            "temp_range_c": "-1°C to 2°C",
            "humidity_pct": "92-96%",
            "wdra_accredited": True,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 41
        }
    },
    {
        "facility_id": "cs_varanasi_veg",
        "name": "Purvanchal Vegetables & Fresh Produce Cold Hub",
        "district": "Varanasi",
        "state": "Uttar Pradesh",
        "latitude": 25.3176,
        "longitude": 82.9739,
        "capacity_mt": 14000,
        "available_mt": 3900,
        "monthly_rent_per_qtl": 115.00,
        "contact_phone": "+91 542 2501190",
        "facility_meta": {
            "name_hi": "पूर्वांचल सब्जी एवं ताजा उत्पाद कोल्ड हब",
            "name_te": "పూర్వాంచల్ కూరగాయల కోల్డ్ హబ్",
            "address": "Chandpur Industrial Estate, Varanasi",
            "crops": ["Tomato", "Chilli", "Pea", "Mango", "Potato"],
            "chambers": 8,
            "temp_range_c": "4°C to 12°C",
            "humidity_pct": "85-90%",
            "wdra_accredited": True,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 29
        }
    },
    {
        "facility_id": "cs_hajipur_fruits",
        "name": "Vaishali Banana & Litchi Cold Terminal",
        "district": "Vaishali",
        "state": "Bihar",
        "latitude": 25.6858,
        "longitude": 85.2146,
        "capacity_mt": 11000,
        "available_mt": 3100,
        "monthly_rent_per_qtl": 120.00,
        "contact_phone": "+91 6224 272400",
        "facility_meta": {
            "name_hi": "वैशाली केला एवं लीची शीत भंडारण केंद्र",
            "name_te": "వైశాలి అరటి & లిచీ కోల్డ్ టెర్మినల్",
            "address": "Industrial Area, Hajipur, Vaishali",
            "crops": ["Banana", "Litchi", "Mango", "Potato"],
            "chambers": 6,
            "temp_range_c": "8°C to 14°C",
            "humidity_pct": "85-92%",
            "wdra_accredited": True,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 30
        }
    },
    {
        "facility_id": "cs_dindigul_veg",
        "name": "Dindigul Vegetable Cold Chain Godown",
        "district": "Dindigul",
        "state": "Tamil Nadu",
        "latitude": 10.3673,
        "longitude": 77.9803,
        "capacity_mt": 12500,
        "available_mt": 3700,
        "monthly_rent_per_qtl": 118.00,
        "contact_phone": "+91 451 2420100",
        "facility_meta": {
            "name_hi": "डिंडीगुल सब्जी कोल्ड चेन गोदाम",
            "name_te": "దిండిగల్ వెజిటబుల్ కోల్డ్ గోదాము",
            "address": "Oddanchatram Road, Dindigul",
            "crops": ["Tomato", "Shallot", "Drumstick", "Banana"],
            "chambers": 8,
            "temp_range_c": "6°C to 12°C",
            "humidity_pct": "85-90%",
            "wdra_accredited": True,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 30
        }
    },
    {
        "facility_id": "cs_hooghly_potato",
        "name": "Bengal Potato Preservation Cold Chain",
        "district": "Hooghly",
        "state": "West Bengal",
        "latitude": 22.9012,
        "longitude": 88.3968,
        "capacity_mt": 28000,
        "available_mt": 7200,
        "monthly_rent_per_qtl": 92.00,
        "contact_phone": "+91 33 2680 1199",
        "facility_meta": {
            "name_hi": "बंगाल आलू संरक्षण शीत भंडारण केंद्र",
            "name_te": "బెంగాల్ బంగాళాదుంప కోల్డ్ చైన్",
            "address": "Dankuni Industrial Zone, Hooghly",
            "crops": ["Potato", "Onion", "Jute Seed", "Vegetables"],
            "chambers": 14,
            "temp_range_c": "2°C to 4°C",
            "humidity_pct": "85-90%",
            "wdra_accredited": True,
            "fumigation_certified": True,
            "backup_generator": True,
            "rent_per_bag": 23
        }
    }
]


def seed_cold_storages():
    import json
    use_pg = is_postgres_active()
    placeholder = "%s" if use_pg else "?"
    print(f"[*] Seeding Pan-India Cold Storages (Engine: {'PostgreSQL' if use_pg else 'SQLite'})...")

    upsert_sql = f"""
    INSERT INTO cold_storages (
        facility_id, name, district, state, latitude, longitude,
        capacity_mt, available_mt, monthly_rent_per_qtl, contact_phone, facility_meta
    ) VALUES (
        {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
        {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}
    )
    ON CONFLICT (facility_id) DO UPDATE SET
        name = EXCLUDED.name,
        district = EXCLUDED.district,
        state = EXCLUDED.state,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        capacity_mt = EXCLUDED.capacity_mt,
        available_mt = EXCLUDED.available_mt,
        monthly_rent_per_qtl = EXCLUDED.monthly_rent_per_qtl,
        contact_phone = EXCLUDED.contact_phone,
        facility_meta = EXCLUDED.facility_meta;
    """

    count = 0
    with get_db_cursor() as cursor:
        for f in PAN_INDIA_COLD_STORAGES:
            meta_json = json.dumps(f["facility_meta"])
            params = (
                f["facility_id"],
                f["name"],
                f["district"],
                f["state"],
                f["latitude"],
                f["longitude"],
                f["capacity_mt"],
                f["available_mt"],
                f["monthly_rent_per_qtl"],
                f["contact_phone"],
                meta_json if not use_pg else meta_json  # psycopg handles json string or jsonb
            )
            cursor.execute(upsert_sql, params)
            count += 1

    print(f"[+] Successfully seeded/updated {count} Pan-India Cold Storage facilities!")


if __name__ == "__main__":
    seed_cold_storages()
