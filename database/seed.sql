-- ==============================================================================
-- Kisan Sethu Seed Data (PostgreSQL 16+)
-- Human-readable initial data for APMC Mandis, Cold Storages, and Govt Schemes
-- ==============================================================================

-- 1. Cold Storage Facilities (Pan-India Coverage across Key Agricultural Clusters)
INSERT INTO cold_storages (facility_id, name, district, state, latitude, longitude, capacity_mt, available_mt, monthly_rent_per_qtl, contact_phone, facility_meta)
VALUES
('cs_guntur_spices', 'Guntur Spices & Mirchi Cold Logistics Terminal', 'Guntur', 'Andhra Pradesh', 16.3067, 80.4365, 18000, 4800, 110.00, '+91 863 2234567', '{"name_hi": "गुंटूर मसाला एवं लाल मिर्च कोल्ड लॉजिस्टिक्स टर्मिनल", "name_te": "గుంటూరు మిర్చి & స్పైసెస్ కోల్డ్ లాజిస్టిక్స్ టెర్మినల్", "chambers": 10, "temp_range_c": "2°C to 8°C", "humidity_pct": "60-65%", "wdra_accredited": true, "crops": ["Chilli", "Turmeric", "Coriander"], "rent_per_bag": 28}'::jsonb),
('cs_tirupati_hub', 'Tirupati Regional Agro Cold Terminal', 'Tirupati', 'Andhra Pradesh', 13.6288, 79.4192, 9000, 3100, 115.00, '+91 877 2256789', '{"name_hi": "तिरुपति क्षेत्रीय कृषि कोल्ड टर्मिनल", "name_te": "తిరుపతి ప్రాంతీయ వ్యవసాయ కోల్డ్ టెర్మినల్", "chambers": 6, "temp_range_c": "4°C to 12°C", "humidity_pct": "85-90%", "wdra_accredited": true, "crops": ["Tomato", "Mango", "Banana"], "rent_per_bag": 29}'::jsonb),
('cs_madanapalle_fresh', 'Rayalaseema Agro Fresh CA Cold Chain', 'Chittoor', 'Andhra Pradesh', 13.5560, 78.5010, 12000, 3600, 130.00, '+91 8571 228899', '{"name_hi": "रायलसीमा एग्रो फ्रेश सीए कोल्ड चेन", "name_te": "రాయలసీమ అగ్రో ఫ్రెష్ సి.ఎ కోల్డ్ చైన్", "chambers": 8, "temp_range_c": "10°C to 14°C", "humidity_pct": "88-92%", "wdra_accredited": true, "crops": ["Tomato", "Mango", "Papaya"], "rent_per_bag": 32}'::jsonb),
('cs_kurnool_onion', 'Kurnool Cotton & Onion Cold Storage Terminal', 'Kurnool', 'Andhra Pradesh', 15.8281, 78.0373, 14000, 4200, 95.00, '+91 8518 220055', '{"name_hi": "कर्नूल प्याज एवं कपास शीत भंडारण", "name_te": "కర్నూలు ఉల్లి & పత్తి కోల్డ్ స్టోరేజ్ టెర్మినల్", "chambers": 8, "temp_range_c": "1°C to 4°C", "humidity_pct": "65-70%", "wdra_accredited": true, "crops": ["Onion", "Chilli", "Groundnut"], "rent_per_bag": 24}'::jsonb),
('cs_vijayawada_delta', 'Krishna Delta Multi-Chamber Agro Godown', 'Krishna', 'Andhra Pradesh', 16.5062, 80.6480, 20000, 5400, 120.00, '+91 866 2489011', '{"name_hi": "कृष्णा डेल्टा मल्टी-चेंबर एग्रो गोदाम", "name_te": "కృష్ణా డెల్టా మల్టీ-ఛాంబర్ అగ్రో కోల్డ్ గోదాము", "chambers": 12, "temp_range_c": "2°C to 12°C", "humidity_pct": "75-85%", "wdra_accredited": true, "crops": ["Mango", "Chilli", "Turmeric"], "rent_per_bag": 30}'::jsonb),
('cs_anantapur_horti', 'Anantapur Agro Dry-Cold Horticultural Warehouse', 'Anantapur', 'Andhra Pradesh', 14.6819, 77.6006, 11000, 3900, 105.00, '+91 8554 240011', '{"name_hi": "अनंतपुर कृषि शुष्क-शीत बागवानी वेयरहाउस", "name_te": "అనంతపురం అగ్రో డ్రై-కోల్డ్ ఉద్యానవన వేర్‌హౌస్", "chambers": 6, "temp_range_c": "5°C to 10°C", "humidity_pct": "70-80%", "wdra_accredited": true, "crops": ["Groundnut", "Sweet Orange", "Pomegranate"], "rent_per_bag": 26}'::jsonb),
('cs_kadapa_spices', 'Kadapa Horticultural Preservation Terminal', 'Kadapa', 'Andhra Pradesh', 14.4673, 78.8242, 8500, 2800, 110.00, '+91 8562 241100', '{"name_hi": "कडपा बागवानी संरक्षण कोल्ड टर्मिनल", "name_te": "కడప ఉద్యానవన పంటల కోల్డ్ స్టోరేజ్ టెర్మినల్", "chambers": 5, "temp_range_c": "4°C to 12°C", "humidity_pct": "75-80%", "wdra_accredited": true, "crops": ["Turmeric", "Banana", "Sweet Orange"], "rent_per_bag": 27}'::jsonb),
('cs_warangal_chilli', 'Warangal Enamamula Agro Cold Storage', 'Warangal', 'Telangana', 17.9689, 79.5941, 16000, 4100, 105.00, '+91 870 2441122', '{"name_hi": "वारंगल एनामामुला कृषि शीत भंडारण", "name_te": "వరంగల్ ఏనుమాముల అగ్రో కోల్డ్ స్టోరేజ్", "chambers": 8, "temp_range_c": "2°C to 8°C", "humidity_pct": "65-70%", "wdra_accredited": true, "crops": ["Chilli", "Cotton", "Turmeric"], "rent_per_bag": 26}'::jsonb),
('cs_khammam_spices', 'Khammam Mirchi & Spices Preservation Hub', 'Khammam', 'Telangana', 17.2473, 80.1514, 14000, 3500, 108.00, '+91 8742 225588', '{"name_hi": "खम्मम मिर्च एवं मसाला संरक्षण केंद्र", "name_te": "ఖమ్మం మిర్చి & సుగంధ ద్రవ్యాల కోల్డ్ హబ్", "chambers": 8, "temp_range_c": "2°C to 8°C", "humidity_pct": "60-65%", "wdra_accredited": true, "crops": ["Chilli", "Cotton", "Mango"], "rent_per_bag": 27}'::jsonb),
('cs_hyderabad_cargo', 'Hyderabad Airport Perishable Cold Cargo Hub', 'Rangareddy', 'Telangana', 17.2403, 78.4294, 25000, 7200, 145.00, '+91 40 6676 4000', '{"name_hi": "हैदराबाद एयरपोर्ट परिशेबल कोल्ड कार्गो", "name_te": "హైదరాబాద్ ఎయిర్‌పోర్ట్ పెరిషబుల్ కోల్డ్ హబ్", "chambers": 14, "temp_range_c": "-2°C to 12°C", "humidity_pct": "85-95%", "wdra_accredited": true, "crops": ["Vegetables", "Fruits", "Grapes"], "rent_per_bag": 36}'::jsonb),
('cs_lasalgaon_onion', 'Sahyadri Onion & Grape Cold Preservation Terminal', 'Nashik', 'Maharashtra', 20.1471, 74.2254, 22000, 6800, 95.00, '+91 2592 245112', '{"name_hi": "सह्याद्री प्याज एवं अंगूर कोल्ड प्रिजर्वेशन टर्मिनल", "name_te": "సహ్యాద్రి ఉల్లి & ద్రాక్ష కోల్డ్ టెర్మినల్", "chambers": 12, "temp_range_c": "0°C to 4°C", "humidity_pct": "65-70%", "wdra_accredited": true, "crops": ["Onion", "Grapes", "Pomegranate"], "rent_per_bag": 24}'::jsonb),
('cs_pune_veg', 'Narayangaon Tomato & Veg Multi-Chamber Storage', 'Pune', 'Maharashtra', 19.1200, 73.9780, 13500, 3800, 125.00, '+91 2132 242010', '{"name_hi": "नारायणगांव टमाटर एवं सब्जी मल्टी-चेंबर स्टोरेज", "name_te": "నారాయణగావ్ టమోటా & వెజిటబుల్ కోల్డ్ స్టోరేజ్", "chambers": 8, "temp_range_c": "8°C to 12°C", "humidity_pct": "85-90%", "wdra_accredited": true, "crops": ["Tomato", "Capsicum", "Cauliflower"], "rent_per_bag": 31}'::jsonb),
('cs_kolar_horticulture', 'Kolar Mega Food Park Cold Terminal', 'Kolar', 'Karnataka', 13.1367, 78.1292, 17000, 4600, 125.00, '+91 8152 234120', '{"name_hi": "कोलार मेगा फूड पार्क कोल्ड टर्मिनल", "name_te": "కోలార్ మెగా ఫుడ్ పార్క్ కోల్డ్ టెర్మినల్", "chambers": 10, "temp_range_c": "4°C to 12°C", "humidity_pct": "85-92%", "wdra_accredited": true, "crops": ["Tomato", "Mango", "Beans"], "rent_per_bag": 31}'::jsonb),
('cs_bangalore_nelamangala', 'Nelamangala Agro Cold Distribution Hub', 'Bangalore Rural', 'Karnataka', 13.0995, 77.3912, 24000, 6200, 140.00, '+91 80 2772 3500', '{"name_hi": "नेलमंगला एग्रो कोल्ड डिस्ट्रीब्यूशन हब", "name_te": "నేలమంగళ అగ్రో కోల్డ్ డిస్ట్రిబ్యూషన్ హబ్", "chambers": 12, "temp_range_c": "2°C to 10°C", "humidity_pct": "80-90%", "wdra_accredited": true, "crops": ["Potato", "Onion", "Carrot"], "rent_per_bag": 35}'::jsonb),
('cs_agra_potato', 'Taj Agro Potato & Multi-Chamber Cold Chain', 'Agra', 'Uttar Pradesh', 27.1767, 78.0081, 28000, 7500, 90.00, '+91 562 2280045', '{"name_hi": "ताज एग्रो आलू एवं मल्टी-चेंबर कोल्ड चेन", "name_te": "తాజ్ అగ్రో బంగాళాదుంప కోల్డ్ చైన్", "chambers": 14, "temp_range_c": "2°C to 4°C", "humidity_pct": "85-92%", "wdra_accredited": true, "crops": ["Potato", "Garlic", "Vegetables"], "rent_per_bag": 22}'::jsonb),
('cs_shimla_apple_ca', 'Himachal Apple Belt Controlled Atmosphere (CA) Store', 'Shimla', 'Himachal Pradesh', 31.1048, 77.1734, 16000, 3900, 160.00, '+91 177 2652130', '{"name_hi": "हिमाचल सेब बेल्ट नियंत्रित वातावरण (CA) कोल्ड स्टोर", "name_te": "హిమాచల్ యాపిల్ కంట్రోల్డ్ అట్మాస్ఫియర్ (సి.ఎ) స్టోర్", "chambers": 10, "temp_range_c": "-1°C to 2°C", "humidity_pct": "92-96%", "wdra_accredited": true, "crops": ["Apple", "Pear", "Cherry"], "rent_per_bag": 40}'::jsonb),
('cs_abohar_citrus', 'Abohar Kinnow & Citrus Cold Preservation Terminal', 'Fazilka', 'Punjab', 30.1450, 74.1993, 14500, 4300, 100.00, '+91 1634 223150', '{"name_hi": "अबोहर किन्नू एवं खट्टे फल शीत संरक्षण टर्मिनल", "name_te": "అబోహర్ కిన్నో కోల్డ్ స్టోరేజ్ టెర్మినల్", "chambers": 8, "temp_range_c": "4°C to 8°C", "humidity_pct": "85-90%", "wdra_accredited": true, "crops": ["Kinnow", "Orange", "Guava"], "rent_per_bag": 25}'::jsonb),
('cs_jalandhar_potato', 'Doaba Seed Potato Cold Terminal', 'Jalandhar', 'Punjab', 31.3260, 75.5762, 26000, 6800, 92.00, '+91 181 2621450', '{"name_hi": "दोआबा बीज आलू शीत भंडारण टर्मिनल", "name_te": "దోఅబా సీడ్ పొటాటో కోల్డ్ టెర్మినల్", "chambers": 12, "temp_range_c": "2°C to 4°C", "humidity_pct": "85-90%", "wdra_accredited": true, "crops": ["Potato", "Pea", "Carrot"], "rent_per_bag": 23}'::jsonb),
('cs_indore_potato', 'Malwa Potato & Garlic Cold Logistics Terminal', 'Indore', 'Madhya Pradesh', 22.7196, 75.8577, 21000, 5800, 95.00, '+91 731 2541180', '{"name_hi": "मालवा आलू एवं लहसुन कोल्ड लॉजिस्टिक्स टर्मिनल", "name_te": "మాల్వా బంగాళాదుంప & వెల్లుల్లి కోల్డ్ టెర్మినల్", "chambers": 10, "temp_range_c": "2°C to 6°C", "humidity_pct": "80-85%", "wdra_accredited": true, "crops": ["Potato", "Garlic", "Onion"], "rent_per_bag": 24}'::jsonb),
('cs_deesa_potato', 'Deesa Mega Potato Cold Hub', 'Banaskantha', 'Gujarat', 24.2586, 72.1793, 32000, 8900, 88.00, '+91 2744 220550', '{"name_hi": "डीसा मेगा आलू शीत भंडारण केंद्र", "name_te": "డీసా మెగా బంగాళాదుంప కోల్డ్ హబ్", "chambers": 16, "temp_range_c": "2°C to 4°C", "humidity_pct": "85-90%", "wdra_accredited": true, "crops": ["Potato", "Groundnut"], "rent_per_bag": 22}'::jsonb),
('cs_gondal_spices', 'Saurashtra Chilli & Groundnut Cold Facility', 'Rajkot', 'Gujarat', 21.9619, 70.7923, 16000, 4700, 105.00, '+91 2825 221040', '{"name_hi": "सौराष्ट्र लाल मिर्च एवं मूंगफली कोल्ड केंद्र", "name_te": "సౌరాష్ట్ర మిర్చి & వేరుశనగ కోల్డ్ స్టోరేజ్", "chambers": 8, "temp_range_c": "4°C to 8°C", "humidity_pct": "60-65%", "wdra_accredited": true, "crops": ["Chilli", "Groundnut", "Sesame"], "rent_per_bag": 26}'::jsonb)
ON CONFLICT (facility_id) DO UPDATE SET
    name = EXCLUDED.name,
    capacity_mt = EXCLUDED.capacity_mt,
    available_mt = EXCLUDED.available_mt,
    facility_meta = EXCLUDED.facility_meta;

-- 2. Scraped Live Mandi Arrivals & Prices
INSERT INTO mandi_prices (state, district, market, commodity, variety, grade, arrival_date, arrival_quintals, min_price_qtl, max_price_qtl, modal_price_qtl, modal_price_kg, source, raw_payload)
VALUES
('Andhra Pradesh', 'Guntur', 'Guntur APMC Yard', 'Chilli', 'Teja / Deluxe Red', 'Grade-A Export', CURRENT_DATE, 4200.00, 13800.00, 16500.00, 15200.00, 152.0, 'AGMARKNET_LIVE_SCRAPER', '{"moisture_pct": 10.5, "stalkless_pct": 85, "color_asta": 120}'::jsonb),
('Andhra Pradesh', 'Chittoor', 'Madanapalle Mandi', 'Tomato', 'Hybrid Super 10', 'Grade-A', CURRENT_DATE, 6800.00, 2200.00, 2900.00, 2600.00, 26.0, 'APMC_CHITTOOR_FEED', '{"crate_size_kg": 25, "firmness_index": "high"}'::jsonb),
('Telangana', 'Warangal', 'Warangal Enamamula Mandi', 'Chilli', 'Wonder Hot', 'FAQ', CURRENT_DATE, 3100.00, 12500.00, 15200.00, 14100.00, 141.0, 'AGMARKNET_LIVE_SCRAPER', '{"moisture_pct": 12.0}'::jsonb),
('Telangana', 'Khammam', 'Khammam APMC', 'Chilli', 'Teja Special', 'Grade-A', CURRENT_DATE, 2800.00, 13200.00, 15800.00, 14700.00, 147.0, 'AGMARKNET_LIVE_SCRAPER', '{"moisture_pct": 11.2}'::jsonb),
('Maharashtra', 'Nashik', 'Lasalgaon Mandi', 'Onion', 'Purna Red', 'Grade-A Export', CURRENT_DATE, 12500.00, 2800.00, 3600.00, 3250.00, 32.5, 'MSAMB_SCRAPER', '{"size_mm": "55+", "dry_skin_layers": 3}'::jsonb),
('Maharashtra', 'Pune', 'Pune Gultekdi APMC', 'Tomato', 'Local Standard', 'FAQ', CURRENT_DATE, 4500.00, 1900.00, 2600.00, 2300.00, 23.0, 'MSAMB_SCRAPER', '{"crate_size_kg": 20}'::jsonb),
('Karnataka', 'Kolar', 'Kolar APMC Yard', 'Tomato', 'Hybrid Red', 'Grade-A', CURRENT_DATE, 8900.00, 2100.00, 2750.00, 2450.00, 24.5, 'E_NAM_SCRAPER', '{"export_suitable": true}'::jsonb),
('Karnataka', 'Bangalore Urban', 'Yeshwanthpur Mandi', 'Potato', 'Hassan Jyoti', 'Grade-A', CURRENT_DATE, 5200.00, 1800.00, 2300.00, 2050.00, 20.5, 'E_NAM_SCRAPER', '{"sugar_content": "low"}'::jsonb),
('Madhya Pradesh', 'Indore', 'Indore Devi Ahilya APMC', 'Potato', 'Chipsona / Kufri', 'Processing Grade', CURRENT_DATE, 9400.00, 1600.00, 2100.00, 1900.00, 19.0, 'AGMARKNET_LIVE_SCRAPER', '{"wafer_grade": true}'::jsonb),
('Gujarat', 'Gondal', 'Gondal APMC Market Yard', 'Chilli', 'Guntur Hybrid 4', 'Grade-A', CURRENT_DATE, 3600.00, 12800.00, 15400.00, 14200.00, 142.0, 'AGMARKNET_LIVE_SCRAPER', '{"pungency_shus": 35000}'::jsonb);

-- 3. Historical Price Trends
INSERT INTO price_trends (commodity, market, state, record_date, modal_price_qtl, modal_price_kg, trend_direction, confidence_score, trend_meta)
VALUES
('Chilli', 'Guntur APMC Yard', 'Andhra Pradesh', CURRENT_DATE, 15200.00, 152.0, 'UP', 0.96, '{"diff_last_week": 1200, "projected_direction": "BULLISH"}'::jsonb),
('Tomato', 'Madanapalle Mandi', 'Andhra Pradesh', CURRENT_DATE, 2600.00, 26.0, 'UP', 0.94, '{"diff_last_week": 400, "projected_direction": "STABLE"}'::jsonb),
('Onion', 'Lasalgaon Mandi', 'Maharashtra', CURRENT_DATE, 3250.00, 32.5, 'UP', 0.95, '{"diff_last_week": 350, "projected_direction": "BULLISH"}'::jsonb),
('Potato', 'Indore Devi Ahilya APMC', 'Madhya Pradesh', CURRENT_DATE, 1900.00, 19.0, 'STABLE', 0.91, '{"diff_last_week": 50, "projected_direction": "STABLE"}'::jsonb);

-- 4. Government Policies & Concessional 4% Loans
INSERT INTO govt_policies_and_loans (scheme_id, category, title_en, title_hi, title_te, benefit_amount, interest_rate, max_limit, eligibility_en, eligibility_hi, eligibility_te, short_desc_en, short_desc_hi, short_desc_te, helpline, apply_url, source_portal, raw_criteria)
VALUES
('kcc_crop_loan', 'LOAN', 'Kisan Credit Card (KCC) Crop Loan Scheme', 'किसान क्रेडिट कार्ड (KCC) रियायती फसली ऋण योजना', 'కిసాన్ క్రెడిట్ కార్డ్ (KCC) పంట రుణ పథకం',
 'Up to ₹3,00,000 at 4% Interest', '4% p.a. (7% base - 3% prompt repayment subvention)', '₹1,60,000 Collateral-Free (Expandable to ₹3,00,000)',
 'All small, marginal, tenant farmers, sharecroppers, and oral lessees with active cultivation land.',
 'सभी छोटे, सीमांत, बटाईदार एवं मौखिक पट्टेदार किसान जो वास्तविक खेती कर रहे हैं।',
 'సొంత భూమి ఉన్న చిన్న, సన్నకారు రైతులు, కౌలు రైతులు మరియు సాగుదారులందరూ అర్హులు.',
 'Concessional institutional short-term credit for seeds, fertilizers, pesticides, harvesting, and post-harvest storage expenses.',
 'बीज, उर्वरक, कीटनाशक, कटाई एवं भंडारण खर्च हेतु राष्ट्रीयकृत बैंकों एवं नाबार्ड द्वारा 4% ब्याज पर रियायती ऋण।',
 'విత్తనాలు, ఎరువులు, పురుగుమందులు మరియు కోత ఖర్చుల కోసం 4% రాయితీ వడ్డీతో స్వల్పకాలిక బ్యాంకు రుణాలు.',
 '1800-115-526 / 155261', 'https://myscheme.gov.in/schemes/kcc', 'nabard.org / myscheme.gov.in',
 '{"moratorium_months": 12, "repayment_cycle": "annual_post_harvest", "processing_fee_waiver": true}'::jsonb),

('pm_kisan_samman', 'POLICY', 'PM-KISAN Samman Nidhi (Direct Income Support)', 'प्रधानमंत्री किसान सम्मान निधि (प्रत्यक्ष आय सहायता)', 'పీఎం కిసాన్ సమ్మాన్ నిధి (ప్రత్యక్ష రైతు ఆదాయం)',
 '₹6,000 / Year (₹2,000 per 4 months)', '100% Direct DBT Grant (Non-repayable)', '₹6,000 per eligible landholding family per annum',
 'Landholding farmer families with cultivable land in their names (subject to institutional/taxpayer exclusion criteria).',
 'खेती योग्य भूमि धारक सभी किसान परिवार (आयकर दाता एवं संवैधानिक पदधारक अपवादों को छोड़कर)।',
 'సాగు భూమి ఉన్న రైతు కుటుంబాలందరూ అర్హులు (ఆదాయపు పన్ను చెల్లించేవారు మినహా).',
 'Central sector scheme with 100% funding from Government of India to provide income support to all landholding farmer families.',
 'केंद्र सरकार द्वारा सभी भूमिधारक किसान परिवारों को वित्तीय सहायता हेतु ₹6,000 प्रति वर्ष तीन किस्तों में बैंक खाते में।',
 'కేంద్ర ప్రభుత్వం నుండి రైతు కుటుంబాలకు పెట్టుబడి సహాయంగా సంవత్సరానికి ₹6,000 మూడు విడతల్లో నేరుగా ఖాతాలో జమ.',
 '155261 / 011-24300606', 'https://pmkisan.gov.in', 'pmkisan.gov.in',
 '{"disbursement_schedule": ["April-July", "August-November", "December-March"], "aadhaar_mandatory": true}'::jsonb),

('pmfby_crop_insurance', 'INSURANCE', 'Pradhan Mantri Fasal Bima Yojana (PMFBY)', 'प्रधानमंत्री फसल बीमा योजना (PMFBY फसल सुरक्षा कवच)', 'ప్రధాన మంత్రి ఫసల్ బీమా యోజన (పంటల బీమా పథకం)',
 'Full Sum Insured for Yield & Weather Calamity Losses', '1.5% for Rabi, 2% for Kharif, 5% for Horticulture/Cash crops', 'Up to ₹1,50,000/acre depending on crop notification',
 'All farmers growing notified crops in notified areas including sharecroppers and tenant farmers.',
 'अधिसूचित क्षेत्रों में अधिसूचित फसलें उगाने वाले सभी किसान (बटाईदार और पट्टेदार किसान सहित)।',
 'నోటిఫై చేయబడిన ప్రాంతాల్లో పంటలు సాగుచేసే రైతులందరూ, కౌలు రైతులు బీమా పొందేందుకు అర్హులు.',
 'Comprehensive risk insurance covering pre-sowing to post-harvest losses due to flood, drought, cyclones, and unseasonal rains.',
 'सूखा, बाढ़, कीट प्रकोप व ओलावृष्टि से फसल क्षति पर न्यूनतम प्रीमियम पर अधिकतम वित्तीय सुरक्षा व त्वरित क्लेम।',
 'కరువు, వరదలు, అకాల వర్షాలు మరియు తెగుళ్ల వల్ల పంట నష్టపోతే తక్కువ ప్రీమియంతో పూర్తి బీమా పరిహారం.',
 '14447 / 1800-180-1551', 'https://pmfby.gov.in', 'pmfby.gov.in',
 '{"settlement_window_days": 21, "remote_sensing_enabled": true}'::jsonb),

('aif_cold_infra', 'LOAN', 'Agriculture Infrastructure Fund (AIF 3% Subvention)', 'कृषि अवसंरचना कोष (AIF) 3% ब्याज छूट योजना', 'వ్యవసాయ మౌలిక సదుపాయాల నిధి (AIF 3% వడ్డీ రాయితీ)',
 'Up to ₹2 Crore at 3% Interest Subvention', '3% p.a. Interest Subvention (Net effective ~5.5%)', '₹2.00 Crore per project for up to 7 years',
 'Farmers, FPOs, PACS, Agri-entrepreneurs, and Start-ups setting up post-harvest cold chains and warehouses.',
 'किसान, एफपीओ, प्राथमिक सहकारी समितियां एवं कृषि उद्यमी जो कोल्ड स्टोरेज, गोदाम व छंटाई केंद्र बना रहे हैं।',
 'కోల్డ్ స్టోరేజ్, గోదాములు మరియు గ్రేడింగ్ యూనిట్లు ఏర్పాటు చేసే రైతులు, ఎఫ్‌పీవోలు మరియు అగ్రి-స్టార్టప్‌లు.',
 'Medium-to-long term debt financing facility for post-harvest management infrastructure and community farming assets.',
 'फसल कटाई बाद प्रबंधन, कोल्ड स्टोरेज, राइपनिंग चेंबर व आधुनिक गोदाम निर्माण हेतु 3% ब्याज छूट पर बैंक ऋण।',
 'పంట కోతల అనంతరం నిల్వ, శీతల గిడ్డంగులు మరియు ప్రాసెసింగ్ యూనిట్ల నిర్మాణానికి 3% వడ్డీ రాయితీతో రుణాలు.',
 '011-23382012 / 1800-180-1551', 'https://agriinfra.dac.gov.in', 'agriinfra.dac.gov.in',
 '{"moratorium_years": 2, "credit_guarantee": "CGTMSE coverage up to ₹2 Crore"}'::jsonb),

('smam_machinery_subsidy', 'SUBSIDY', 'SMAM Farm Machinery & Tractor Subsidy Scheme', 'कृषि यंत्रीकरण उप-मिशन (ट्रैक्टर व कृषि यंत्र 40-50% सब्सिडी)', 'వ్యవసాయ యాంత్రీకరణ సబ్సిడీ (ట్రాక్టర్లు & యంత్రాలపై 40-50% రాయితీ)',
 '40% to 50% Direct Subsidy (Up to ₹1.25 Lakh on Tractors)', 'Direct DBT Capital Grant (Non-repayable)', '₹1,25,000 for Tractors / Up to 50% for Rotavators & Power Tillers',
 'Small and marginal farmers, SC/ST, women farmers, and registered Farmer Producer Organizations (FPOs).',
 'सभी छोटे, सीमांत, महिला एवं अनुसूचित जाति/जनजाति के किसान तथा पंजीकृत कस्टम हायरिंग केंद्र।',
 'చిన్న, సన్నకారు రైతులు, మహిళా రైతులు మరియు ఎస్సీ/ఎస్టీ రైతులకు ప్రాధాన్యత.',
 'Subsidies on modern farm implements including tractors, rotavators, drone sprayers, laser land levelers, and power tillers.',
 'ट्रैक्टर, रोटावेटर, पावर टिलर, उन्नत स्प्रेयर व ड्रोन खरीद पर 40% से 50% की प्रत्यक्ष सरकारी सब्सिडी।',
 'ట్రాక్టర్లు, రోటవేటర్లు, పవర్ టిల్లర్లు మరియు డ్రోన్ స్ప్రేయర్ల కొనుగోలుపై 40-50% ప్రత్యక్ష రాయితీ.',
 '1800-180-1551', 'https://agrimachinery.nic.in', 'agrimachinery.nic.in',
 '{"women_farmer_subsidy": "50%", "general_farmer_subsidy": "40%"}'::jsonb),

('pmksy_drip_subsidy', 'SUBSIDY', 'PMKSY Per Drop More Crop (Drip & Sprinkler Subsidy)', 'पीएम कृषि सिंचाई योजना (ड्रिप व स्प्रिंकलर 55-70% सब्सिडी)', 'పీఎం వ్యవసాయ నీటిపారుదల పథకం (డ్రిప్ & స్ప్రింక్లర్ 55-70% సబ్సిడీ)',
 '55% to 70% Subsidy on Micro-Irrigation Systems', '100% Capital Subsidy Grant', 'Up to ₹55,000 per Hectare for Drip Irrigation Unit',
 'All farmers with assured water source (borewell/well/canal) cultivating horticulture or field crops.',
 'सुनिश्चित जल स्रोत (बोरवेल/कुआं/नहर) वाले सभी बागवानी व नगदी फसल उत्पादक किसान।',
 'బోరు బావులు లేదా కాలువ నీటి వనరు కలిగిన కూరగాయలు, ఉద్యానవన మరియు వాణిజ్య పంట రైతులు.',
 'Financial assistance for installing micro-irrigation systems (drip/sprinkler) to save 40-50% water and boost crop yield by 30%.',
 'टपक (ड्रिप) व फव्वारा (स्प्रिंकलर) सिंचाई संयंत्रों की स्थापना पर 55% से 70% अनुदान, पानी की भारी बचत।',
 'డ్రిప్ మరియు స్ప్రింక్లర్ సెట్ల ఏర్పాటుకు 55% నుండి 70% వరకు భారీ సబ్సిడీ, 40% నీటి ఆదా.',
 '1800-180-1551', 'https://pmksy.gov.in', 'pmksy.gov.in',
 '{"small_marginal_subsidy": "70%", "water_savings_pct": 45}'::jsonb),

('midh_packhouse_subsidy', 'SUBSIDY', 'MIDH Horticulture Pack-House & Polyhouse Subsidy', 'एकीकृत बागवानी मिशन (पैक-हाउस व पॉलीहाउस 50% सब्सिडी)', 'ఉద్యానవన ప్యాక్-హౌస్ & పాలీహౌస్ 50% రాయితీ పథకం',
 '50% Credit-Linked Back-Ended Subsidy', 'Back-ended capital subsidy deposited in bank account', '₹2,00,000 for Pack-Houses / ₹4.5 Lakh for Naturally Ventilated Polyhouses',
 'Growers of fruits, vegetables, flowers, spices, and Farmer Producer Organizations.',
 'सब्जी, फल, मिर्च, हल्दी, फूल व मसाला उत्पादक किसान तथा एफपीओ समूह।',
 'కూరగాయలు, మిర్చి, పసుపు, పండ్లు మరియు పూలు సాగు చేసే రైతులు, సంఘాలు.',
 'Capital subsidy for grading/sorting pack-houses, cold rooms, shade nets, and polyhouses to prevent post-harvest spoilage.',
 'ग्रेडिंग व सोर्टिंग शेड, कोल्ड रूम, शेड नेट और पॉलीहाउस निर्माण पर 50% पूंजीगत अनुदान।',
 'గ్రేడింగ్ యూనిట్లు, షేడ్ నెట్లు మరియు పాలీహౌస్ నిర్మాణానికి 50% ఆర్థిక రాయితీ.',
 '011-23388756', 'https://midh.gov.in', 'midh.gov.in',
 '{"subsidy_rate": "50% capital cost"}'::jsonb),

('pm_kusum_solar', 'SOLAR', 'PM-KUSUM Solar Irrigation Pump Subsidy', 'पीएम-कुसुम सौर कृषि पंप 60% सब्सिडी योजना', 'పీఎం-కుసుమ్ సౌర వ్యవసాయ పంపుల రాయితీ పథకం',
 '60% Direct Subsidy (30% Central + 30% State)', '30% Bank Loan at Subsidized Agri Rate (Farmer pays only 10%)', 'Up to 10 HP Standalone Solar Agri Pump',
 'Individual farmers, groups of farmers, cooperatives, Panchayats, Farmer Producer Organizations (FPOs).',
 'व्यक्तिगत किसान, किसान समूह, सहकारी समितियां, पंचायतें एवं एफपीओ (FPO)।',
 'వ్యక్తిగత రైతులు, రైతు సంఘాలు, ప్రాథమిక వ్యవసాయ సహకార సంఘాలు మరియు ఎఫ్‌పీవోలు అర్హులు.',
 'Financial support for installing solar pumps to replace diesel engines, saving diesel costs and ensuring daylight irrigation.',
 'डीजल पंपों से मुक्ति हेतु 60% सरकारी अनुदान पर सौर सिंचाई पंप स्थापना, दिन में निश्चिंत सिंचाई।',
 'డీజిల్ ఖర్చులు తగ్గించేందుకు 60% రాయితీతో సోలార్ పంపుల ఏర్పాటు, పగటిపూట నిరంతర సాగునీరు.',
 '1800-180-3333', 'https://pmkusum.mnre.gov.in', 'mnre.gov.in',
 '{"farmer_share": "10% upfront", "subsidy_share": "60% grant"}'::jsonb),

('pm_kusum_solar_c', 'SOLAR', 'PM-KUSUM Component-C (Agri-Feeder Solarization)', 'पीएम-कुसुम कंपोनेंट-सी (कृषि फीडर सौरीकरण एवं दिन में मुफ्त बिजली)', 'పీఎం-కుసుమ్ కాంపొనెంట్-సి (వ్యవసాయ ఫీడర్ల సోలరైజేషన్)',
 '100% Day-time Free Solar Electricity for Tube-wells', 'Government Funded Feeder Solarization', 'Free Daytime 9-Hour Three-Phase Power Supply',
 'All agricultural electricity connection holders connected to dedicated rural agricultural feeders.',
 'कृषि विद्युत कनेक्शन धारक सभी किसान, रात में सिंचाई की परेशानी से पूर्ण मुक्ति।',
 'వ్యవసాయ విద్యుత్ కనెక్షన్ ఉన్న రైతులందరికీ పగటిపూట 9 గంటల ఉచిత నాణ్యమైన విద్యుత్.',
 'Solarizing dedicated agricultural power feeders so farmers receive 9 hours of uninterrupted 3-phase free electricity during daylight.',
 'कृषि फीडरों का सौरीकरण, जिससे किसानों को रात के बजाय दिन के समय 9 घंटे निर्बाध मुफ्त बिजली मिले।',
 'రాత్రిపూట కాకుండా పగటిపూట మాత్రమే 9 గంటల పాటు ఉచిత వ్యవసాయ విద్యుత్ సరఫరా.',
 '1800-180-3333', 'https://pmkusum.mnre.gov.in', 'mnre.gov.in',
 '{"daytime_power_hours": 9, "cost_to_farmer": "NIL"}'::jsonb),

('rwbcis_weather_insurance', 'INSURANCE', 'Weather Based Crop Insurance Scheme (RWBCIS)', 'मौसम आधारित पुनर्गठित फसल बीमा योजना (RWBCIS)', 'వాతావరణ ఆధారిత పంటల బీమా పథకం (RWBCIS)',
 'Automatic Payouts Based on Weather Station Triggers', 'Nominal Farmer Premium (1.5% to 5%)', 'Up to Notified Scale of Finance (₹60,000 - ₹1,20,000/acre)',
 'All growers of notified commercial crops (Chilli, Tomato, Cotton, Turmeric, Groundnut).',
 'मिर्च, टमाटर, कपास, हल्दी और मूंगफली जैसी अधिसूचित वाणिज्यिक फसलें उगाने वाले सभी किसान।',
 'మిర్చి, టమోటా, పత్తి, పసుపు మరియు వేరుశనగ వంటి వాణిజ్య పంటలు సాగు చేసే రైతులందరూ అర్హులు.',
 'Parametric insurance providing speedy automatic payouts based on rainfall deficit, unseasonal squalls, high temperature, and humidity triggers.',
 'वर्षा की कमी, अधिक वर्षा, उच्च तापमान व आर्द्रता के आधार पर स्वचालित त्वरित बीमा दावा भुगतान।',
 'వర్షాభావం, అధిక వేడిమి మరియు గాలి తీవ్రత ఆధారంగా ఆటోమేటిక్ బీమా పరిహార చెల్లింపులు.',
 '14447 / 1800-180-1551', 'https://pmfby.gov.in', 'pmfby.gov.in',
 '{"trigger_type": "Automated Weather Station (AWS) Data"}'::jsonb),

('rythu_bharosa_dbt', 'POLICY', 'YSR Rythu Bharosa / PM-KISAN State Component', 'वाईएसआर रायथु भरोसा (आंध्र प्रदेश राज्य किसान इनपुट सहायता)', 'వైఎస్సార్ రైతు భరోసా (రైతు పెట్టుబడి సాయం)',
 '₹13,500 / Year (₹7,500 May, ₹4,000 Oct, ₹2,000 Jan)', '100% Non-repayable Grant', '₹13,500 per farmer family including tenant SC/ST/BC/Minority farmers',
 'All landholding farmer families and certified landless tenant farmers (CCRC holders) in Andhra Pradesh.',
 'आंध्र प्रदेश के सभी भूमिधारक किसान तथा पंजीकृत भूमिहीन बटाईदार किसान (CCRC धारक)।',
 'ఆంధ్రప్రదేశ్‌లోని భూమిగల రైతులందరూ మరియు CCRC కార్డు కలిగిన అర్హులైన కౌలు రైతులు.',
 'Seasonal input financial assistance for seeds, nursery preparation, and fertilizers before Kharif & Rabi sowing.',
 'खरीफ और रबी की बुआई से पूर्व बीज, खाद व कीटनाशक क्रय हेतु आंध्र प्रदेश सरकार द्वारा प्रत्यक्ष सहायता।',
 'ఖరీఫ్ మరియు రబీ సీజన్ల ఆరంభంలో విత్తనాలు, ఎరువుల కొనుగోలుకు రాష్ట్ర ప్రభుత్వం అందించే పెట్టుబడి సాయం.',
 '1902 / 155251', 'https://ysrrythubharosa.ap.gov.in', 'ysrrythubharosa.ap.gov.in',
 '{"tenant_eligible": true}'::jsonb)
ON CONFLICT (scheme_id) DO UPDATE SET
    benefit_amount = EXCLUDED.benefit_amount,
    updated_at = CURRENT_TIMESTAMP;

-- 5. Weather Advisories (Sample 7-day schedule for active district hubs)
INSERT INTO weather_advisories (location_id, location_name, district, state, pincode, forecast_date, temp_max_c, temp_min_c, rain_chance_pct, wind_speed_kmh, condition_text, risk_level, spray_status, spray_advice, drying_window, radar_data)
VALUES
('guntur', 'Guntur', 'Guntur', 'Andhra Pradesh', '522004', CURRENT_DATE, 34.0, 24.5, 10, 11.0, 'Sunny & Clear', 'safe', 'SAFE', 'Ideal spray window between 8:00 AM - 11:30 AM before wind speed picks up.', 'Optimum 9 AM - 4 PM', '{"humidity_pct": 58, "dew_point_c": 19.5}'::jsonb),
('guntur', 'Guntur', 'Guntur', 'Andhra Pradesh', '522004', CURRENT_DATE + INTERVAL '1 day', 33.5, 25.0, 15, 12.5, 'Clear Sky', 'safe', 'SAFE', 'Good condition for pesticide application. Keep nozzles clean.', 'Optimum 9 AM - 4 PM', '{"humidity_pct": 62}'::jsonb),
('guntur', 'Guntur', 'Guntur', 'Andhra Pradesh', '522004', CURRENT_DATE + INTERVAL '2 day', 32.0, 24.0, 40, 18.0, 'Partly Cloudy', 'warning', 'CAUTION', 'Scattered showers expected. Apply only systemic fungicides with sticker.', 'Caution 10 AM - 1 PM', '{"humidity_pct": 74}'::jsonb),
('guntur', 'Guntur', 'Guntur', 'Andhra Pradesh', '522004', CURRENT_DATE + INTERVAL '3 day', 29.5, 23.0, 85, 28.0, 'Heavy Rain & Squall', 'danger', 'PAUSED', 'Heavy thunderstorm alert. Immediately halt pesticide & fungicide spraying to avoid chemical runoff.', 'Suspended (High Rain)', '{"rain_accum_mm": 45.2, "humidity_pct": 92}'::jsonb);
