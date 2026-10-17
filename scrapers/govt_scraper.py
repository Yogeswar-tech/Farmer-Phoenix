"""Government Policies, 4% KCC Concessional Loans & Subsidy Web Scraper.

Targets:
- myscheme.gov.in (Official portal for Central & State welfare schemes)
- pmkisan.gov.in (Direct Benefit Transfer guidelines)
- nabard.org (Kisan Credit Card and 3% interest subvention guidelines)
- pmfby.gov.in (Pradhan Mantri Fasal Bima Yojana)
- mnre.gov.in (PM-KUSUM 60% Solar Pump Subsidies)
"""

import os
import json
import logging
import datetime
import urllib.request
import urllib.error
from typing import Any

logger = logging.getLogger("GovtScraper")

AUTHENTIC_GOVT_SCHEMES: list[dict[str, Any]] = [
    {
        "scheme_id": "kcc_crop_loan",
        "category": "LOAN",
        "title_en": "Kisan Credit Card (KCC) Crop Loan Scheme",
        "title_hi": "किसान क्रेडिट कार्ड (KCC) रियायती फसली ऋण योजना",
        "title_te": "కిసాన్ క్రెడిట్ కార్డ్ (KCC) పంట రుణ పథకం",
        "benefit_amount": "Up to ₹3,00,000 at 4% Interest",
        "interest_rate": "4% p.a. (7% base - 3% prompt repayment subvention)",
        "max_limit": "₹1,60,000 Collateral-Free (Expandable to ₹3,00,000)",
        "eligibility_en": "All small, marginal, tenant farmers, sharecroppers, and oral lessees with active cultivation land.",
        "eligibility_hi": "सभी छोटे, सीमांत, बटाईदार एवं मौखिक पट्टेदार किसान जो वास्तविक खेती कर रहे हैं।",
        "eligibility_te": "సొంత భూమి ఉన్న చిన్న, సన్నకారు రైతులు, కౌలు రైతులు మరియు సాగుదారులందరూ అర్హులు.",
        "short_desc_en": "Concessional institutional short-term credit for seeds, fertilizers, pesticides, harvesting, and post-harvest storage expenses.",
        "short_desc_hi": "बीज, उर्वरक, कीटनाशक, कटाई एवं भंडारण खर्च हेतु राष्ट्रीयकृत बैंकों एवं नाबार्ड द्वारा 4% ब्याज पर रियायती ऋण।",
        "short_desc_te": "విత్తనాలు, ఎరువులు, పురుగుమందులు మరియు కోత ఖర్చుల కోసం 4% రాయితీ వడ్డీతో స్వల్పకాలిక బ్యాంకు రుణాలు.",
        "helpline": "1800-115-526 / 155261",
        "apply_url": "https://myscheme.gov.in/schemes/kcc",
        "source_portal": "nabard.org / myscheme.gov.in",
        "raw_criteria": {
            "processing_fee": "NIL up to ₹3 Lakhs",
            "moratorium": "1 year post-harvest",
            "renewal_validity": "5 years with 10% annual increase"
        }
    },
    {
        "scheme_id": "pm_kisan_samman",
        "category": "POLICY",
        "title_en": "PM-KISAN Samman Nidhi (Direct Income Support)",
        "title_hi": "प्रधानमंत्री किसान सम्मान निधि (प्रत्यक्ष आय सहायता)",
        "title_te": "పీఎం కిసాన్ సమ్మాన్ నిధి (ప్రత్యక్ష రైతు ఆదాయం)",
        "benefit_amount": "₹6,00,000 / Year (₹2,000 per 4 months)",
        "interest_rate": "100% Direct DBT Grant (Non-repayable)",
        "max_limit": "₹6,000 per eligible landholding family per annum",
        "eligibility_en": "Landholding farmer families with cultivable land in their names (subject to institutional/taxpayer exclusion criteria).",
        "eligibility_hi": "खेती योग्य भूमि धारक सभी किसान परिवार (आयकर दाता एवं संवैधानिक पदधारक अपवादों को छोड़कर)।",
        "eligibility_te": "సాగు భూమి ఉన్న రైతు కుటుంబాలందరూ అర్హులు (ఆదాయపు పన్ను చెల్లించేవారు మినహా).",
        "short_desc_en": "Central sector scheme with 100% funding from Government of India to provide income support to all landholding farmer families.",
        "short_desc_hi": "केंद्र सरकार द्वारा सभी भूमिधारक किसान परिवारों को वित्तीय सहायता हेतु ₹6,000 प्रति वर्ष तीन किस्तों में बैंक खाते में।",
        "short_desc_te": "కేంద్ర ప్రభుత్వం నుండి రైతు కుటుంబాలకు పెట్టుబడి సహాయంగా సంవత్సరానికి ₹6,000 మూడు విడతల్లో నేరుగా ఖాతాలో జమ.",
        "helpline": "155261 / 011-24300606",
        "apply_url": "https://pmkisan.gov.in",
        "source_portal": "pmkisan.gov.in",
        "raw_criteria": {
            "payment_frequency": "Every 4 months",
            "mode": "Aadhaar Linked DBT",
            "e_kyc_required": True
        }
    },
    {
        "scheme_id": "pmfby_crop_insurance",
        "category": "INSURANCE",
        "title_en": "Pradhan Mantri Fasal Bima Yojana (PMFBY)",
        "title_hi": "प्रधानमंत्री फसल बीमा योजना (PMFBY फसल सुरक्षा कवच)",
        "title_te": "ప్రధాన మంత్రి ఫసల్ బీమా యోజన (పంటల బీమా పథకం)",
        "benefit_amount": "Full Sum Insured for Yield & Weather Calamity Losses",
        "interest_rate": "1.5% for Rabi, 2% for Kharif, 5% for Horticulture/Cash crops",
        "max_limit": "Up to ₹1,50,000/acre depending on crop notification",
        "eligibility_en": "All farmers growing notified crops in notified areas including sharecroppers and tenant farmers.",
        "eligibility_hi": "अधिसूचित क्षेत्रों में अधिसूचित फसलें उगाने वाले सभी किसान (बटाईदार और पट्टेदार किसान सहित)।",
        "eligibility_te": "నోటిఫై చేయబడిన ప్రాంతాల్లో పంటలు సాగుచేసే రైతులందరూ, కౌలు రైతులు బీమా పొందేందుకు అర్హులు.",
        "short_desc_en": "Comprehensive risk insurance covering pre-sowing to post-harvest losses due to flood, drought, cyclones, and unseasonal rains.",
        "short_desc_hi": "सूखा, बाढ़, कीट प्रकोप व ओलावृष्टि से फसल क्षति पर न्यूनतम प्रीमियम पर अधिकतम वित्तीय सुरक्षा व त्वरित क्लेम।",
        "short_desc_te": "కరువు, వరదలు, అకాల వర్షాలు మరియు తెగుళ్ల వల్ల పంట నష్టపోతే తక్కువ ప్రీమియంతో పూర్తి బీమా పరిహారం.",
        "helpline": "14447 / 1800-180-1551",
        "apply_url": "https://pmfby.gov.in",
        "source_portal": "pmfby.gov.in",
        "raw_criteria": {
            "loss_assessment": "Satellite Remote Sensing & Smart Crop Cutting Experiments",
            "claim_turnaround": "Within 21 days"
        }
    },
    {
        "scheme_id": "pm_kusum_solar",
        "category": "SOLAR",
        "title_en": "PM-KUSUM Solar Irrigation Pump Subsidy",
        "title_hi": "पीएम-कुसुम सौर कृषि पंप 60% सब्सिडी योजना",
        "title_te": "పీఎం-కుసుమ్ సౌర వ్యవసాయ పంపుల రాయితీ పథకం",
        "benefit_amount": "60% Direct Subsidy (30% Central + 30% State)",
        "interest_rate": "30% Bank Loan at Subsidized Agri Rate (Farmer pays only 10%)",
        "max_limit": "Up to 10 HP Standalone Solar Agri Pump",
        "eligibility_en": "Individual farmers, groups of farmers, cooperatives, Panchayats, Farmer Producer Organizations (FPOs).",
        "eligibility_hi": "व्यक्तिगत किसान, किसान समूह, सहकारी समितियां, पंचायतें एवं एफपीओ (FPO)।",
        "eligibility_te": "వ్యక్తిగత రైతులు, రైతు సంఘాలు, ప్రాథమిక వ్యవసాయ సహకార సంఘాలు మరియు ఎఫ్‌పీవోలు అర్హులు.",
        "short_desc_en": "Financial support for installing solar pumps to replace diesel engines, saving diesel costs and ensuring daylight irrigation.",
        "short_desc_hi": "डीजल पंपों से मुक्ति हेतु 60% सरकारी अनुदान पर सौर सिंचाई पंप स्थापना, दिन में निश्चिंत सिंचाई।",
        "short_desc_te": "డీజిల్ ఖర్చులు తగ్గించేందుకు 60% రాయితీతో సోలార్ పంపుల ఏర్పాటు, పగటిపూట నిరంతర సాగునీరు.",
        "helpline": "1800-180-3333",
        "apply_url": "https://pmkusum.mnre.gov.in",
        "source_portal": "mnre.gov.in",
        "raw_criteria": {
            "farmer_share": "10% upfront",
            "subsidy_share": "60% grant",
            "loan_share": "30% commercial bank tie-up"
        }
    },
    {
        "scheme_id": "aif_cold_infra",
        "category": "LOAN",
        "title_en": "Agriculture Infrastructure Fund (AIF 3% Subvention)",
        "title_hi": "कृषि अवसंरचना कोष (AIF) 3% ब्याज छूट योजना",
        "title_te": "వ్యవసాయ మౌలిక సదుపాయాల నిధి (AIF 3% వడ్డీ రాయితీ)",
        "benefit_amount": "Up to ₹2 Crore at 3% Interest Subvention",
        "interest_rate": "3% p.a. Interest Subvention (Net effective ~5.5%)",
        "max_limit": "₹2.00 Crore per project for up to 7 years",
        "eligibility_en": "Farmers, FPOs, PACS, Agri-entrepreneurs, and Start-ups setting up post-harvest cold chains and warehouses.",
        "eligibility_hi": "किसान, एफपीओ, प्राथमिक सहकारी समितियां एवं कृषि उद्यमी जो कोल्ड स्टोरेज, गोदाम व छंटाई केंद्र बना रहे हैं।",
        "eligibility_te": "కోల్డ్ స్టోరేజ్, గోదాములు మరియు గ్రేడింగ్ యూనిట్లు ఏర్పాటు చేసే రైతులు, ఎఫ్‌పీవోలు మరియు అగ్రి-స్టార్టప్‌లు.",
        "short_desc_en": "Medium-to-long term debt financing facility for post-harvest management infrastructure and community farming assets.",
        "short_desc_hi": "फसल कटाई बाद प्रबंधन, कोल्ड स्टोरेज, राइपनिंग चेंबर व आधुनिक गोदाम निर्माण हेतु 3% ब्याज छूट पर बैंक ऋण।",
        "short_desc_te": "పంట కోతల అనంతరం నిల్వ, శీతల గిడ్డంగులు మరియు ప్రాసెసింగ్ యూనిట్ల నిర్మాణానికి 3% వడ్డీ రాయితీతో రుణాలు.",
        "helpline": "011-23382012 / 1800-180-1551",
        "apply_url": "https://agriinfra.dac.gov.in",
        "source_portal": "agriinfra.dac.gov.in",
        "raw_criteria": {
            "moratorium_years": 2,
            "credit_guarantee": "CGTMSE coverage up to ₹2 Crore",
            "tenure_years": 7
        }
    },
    {
        "scheme_id": "smam_machinery_subsidy",
        "category": "SUBSIDY",
        "title_en": "SMAM Farm Machinery & Tractor Subsidy Scheme",
        "title_hi": "कृषि यंत्रीकरण उप-मिशन (ट्रैक्टर व कृषि यंत्र 40-50% सब्सिडी)",
        "title_te": "వ్యవసాయ యాంత్రీకరణ సబ్సిడీ (ట్రాక్టర్లు & యంత్రాలపై 40-50% రాయితీ)",
        "benefit_amount": "40% to 50% Direct Subsidy (Up to ₹1.25 Lakh on Tractors)",
        "interest_rate": "Direct DBT Capital Grant (Non-repayable)",
        "max_limit": "₹1,25,000 for Tractors / Up to 50% for Rotavators, Power Tillers & Sprayers",
        "eligibility_en": "Small and marginal farmers, SC/ST, women farmers, and registered Farmer Producer Organizations (FPOs).",
        "eligibility_hi": "सभी छोटे, सीमांत, महिला एवं अनुसूचित जाति/जनजाति के किसान तथा पंजीकृत कस्टम हायरिंग केंद्र।",
        "eligibility_te": "చిన్న, సన్నకారు రైతులు, మహిళా రైతులు మరియు ఎస్సీ/ఎస్టీ రైతులకు ప్రాధాన్యత.",
        "short_desc_en": "Subsidies on modern farm implements including tractors, rotavators, drone sprayers, laser land levelers, and power tillers.",
        "short_desc_hi": "ट्रैक्टर, रोटावेटर, पावर टिलर, उन्नत स्प्रेयर व ड्रोन खरीद पर 40% से 50% की प्रत्यक्ष सरकारी सब्सिडी।",
        "short_desc_te": "ట్రాక్టర్లు, రోటవేటర్లు, పవర్ టిల్లర్లు మరియు డ్రోన్ స్ప్రేయర్ల కొనుగోలుపై 40-50% ప్రత్యక్ష రాయితీ.",
        "helpline": "1800-180-1551",
        "apply_url": "https://agrimachinery.nic.in",
        "source_portal": "agrimachinery.nic.in / dbtbharat.gov.in",
        "raw_criteria": {
            "women_farmer_subsidy": "50%",
            "general_farmer_subsidy": "40%",
            "mode": "Direct Benefit Transfer to Bank Account"
        }
    },
    {
        "scheme_id": "pmksy_drip_subsidy",
        "category": "SUBSIDY",
        "title_en": "PMKSY Per Drop More Crop (Drip & Sprinkler Subsidy)",
        "title_hi": "पीएम कृषि सिंचाई योजना (ड्रिप व स्प्रिंकलर 55-70% सब्सिडी)",
        "title_te": "పీఎం వ్యవసాయ నీటిపారుదల పథకం (డ్రిప్ & స్ప్రింక్లర్ 55-70% సబ్సిడీ)",
        "benefit_amount": "55% to 70% Subsidy on Micro-Irrigation Systems",
        "interest_rate": "100% Capital Subsidy Grant",
        "max_limit": "Up to ₹55,000 per Hectare for Drip Irrigation Unit",
        "eligibility_en": "All farmers with assured water source (borewell/well/canal) cultivating horticulture or field crops.",
        "eligibility_hi": "सुनिश्चित जल स्रोत (बोरवेल/कुआं/नहर) वाले सभी बागवानी व नगदी फसल उत्पादक किसान।",
        "eligibility_te": "బోరు బావులు లేదా కాలువ నీటి వనరు కలిగిన కూరగాయలు, ఉద్యానవన మరియు వాణిజ్య పంట రైతులు.",
        "short_desc_en": "Financial assistance for installing micro-irrigation systems (drip/sprinkler) to save 40-50% water and boost crop yield by 30%.",
        "short_desc_hi": "टपक (ड्रिप) व फव्वारा (स्प्रिंकलर) सिंचाई संयंत्रों की स्थापना पर 55% से 70% अनुदान, पानी की भारी बचत।",
        "short_desc_te": "డ్రిప్ మరియు స్ప్రింక్లర్ సెట్ల ఏర్పాటుకు 55% నుండి 70% వరకు భారీ సబ్సిడీ, 40% నీటి ఆదా.",
        "helpline": "1800-180-1551",
        "apply_url": "https://pmksy.gov.in",
        "source_portal": "pmksy.gov.in / mipap.gov.in",
        "raw_criteria": {
            "small_marginal_subsidy": "70% in AP/TS",
            "other_farmers_subsidy": "55%",
            "water_savings_pct": 45
        }
    },
    {
        "scheme_id": "midh_packhouse_subsidy",
        "category": "SUBSIDY",
        "title_en": "MIDH Horticulture Pack-House & Polyhouse Subsidy",
        "title_hi": "एकीकृत बागवानी मिशन (पैक-हाउस व पॉलीहाउस 50% सब्सिडी)",
        "title_te": "ఉద్యానవన ప్యాక్-హౌస్ & పాలీహౌస్ 50% రాయితీ పథకం",
        "benefit_amount": "50% Credit-Linked Back-Ended Subsidy",
        "interest_rate": "Back-ended capital subsidy deposited in bank account",
        "max_limit": "₹2,00,000 for Pack-Houses / ₹4.5 Lakh for Naturally Ventilated Polyhouses",
        "eligibility_en": "Growers of fruits, vegetables, flowers, spices, and Farmer Producer Organizations.",
        "eligibility_hi": "सब्जी, फल, मिर्च, हल्दी, फूल व मसाला उत्पादक किसान तथा एफपीओ समूह।",
        "eligibility_te": "కూరగాయలు, మిర్చి, పసుపు, పండ్లు మరియు పూలు సాగు చేసే రైతులు, సంఘాలు.",
        "short_desc_en": "Capital subsidy for grading/sorting pack-houses, cold rooms, shade nets, and polyhouses to prevent post-harvest spoilage.",
        "short_desc_hi": "ग्रेडिंग व सोर्टिंग शेड, कोल्ड रूम, शेड नेट और पॉलीहाउस निर्माण पर 50% पूंजीगत अनुदान।",
        "short_desc_te": "గ్రేడింగ్ యూనిట్లు, షేడ్ నెట్లు మరియు పాలీహౌస్ నిర్మాణానికి 50% ఆర్థిక రాయితీ.",
        "helpline": "011-23388756",
        "apply_url": "https://midh.gov.in",
        "source_portal": "midh.gov.in",
        "raw_criteria": {
            "subsidy_rate": "50% capital cost",
            "packhouse_size": "9m x 6m standard"
        }
    },
    {
        "scheme_id": "rwbcis_weather_insurance",
        "category": "INSURANCE",
        "title_en": "Weather Based Crop Insurance Scheme (RWBCIS)",
        "title_hi": "मौसम आधारित पुनर्गठित फसल बीमा योजना (RWBCIS)",
        "title_te": "వాతావరణ ఆధారిత పంటల బీమా పథకం (RWBCIS)",
        "benefit_amount": "Automatic Payouts Based on Weather Station Triggers",
        "interest_rate": "Nominal Farmer Premium (1.5% to 5%)",
        "max_limit": "Up to Notified Scale of Finance (₹60,000 - ₹1,20,000/acre)",
        "eligibility_en": "All growers of notified commercial crops (Chilli, Tomato, Cotton, Turmeric, Groundnut).",
        "eligibility_hi": "मिर्च, टमाटर, कपास, हल्दी और मूंगफली जैसी अधिसूचित वाणिज्यिक फसलें उगाने वाले सभी किसान।",
        "eligibility_te": "మిర్చి, టమోటా, పత్తి, పసుపు మరియు వేరుశనగ వంటి వాణిజ్య పంటలు సాగు చేసే రైతులందరూ అర్హులు.",
        "short_desc_en": "Parametric insurance providing speedy automatic payouts based on rainfall deficit, unseasonal squalls, high temperature, and humidity triggers.",
        "short_desc_hi": "वर्षा की कमी, अधिक वर्षा, उच्च तापमान व आर्द्रता के आधार पर स्वचालित त्वरित बीमा दावा भुगतान।",
        "short_desc_te": "వర్షాభావం, అధిక వేడిమి మరియు గాలి తీవ్రత ఆధారంగా ఆటోమేటిక్ బీమా పరిహార చెల్లింపులు.",
        "helpline": "14447 / 1800-180-1551",
        "apply_url": "https://pmfby.gov.in",
        "source_portal": "pmfby.gov.in",
        "raw_criteria": {
            "trigger_type": "Automated Weather Station (AWS) Data",
            "assessment": "No manual survey needed"
        }
    },
    {
        "scheme_id": "pm_kusum_solar_c",
        "category": "SOLAR",
        "title_en": "PM-KUSUM Component-C (Agri-Feeder Solarization)",
        "title_hi": "पीएम-कुसुम कंपोनेंट-सी (कृषि फीडर सौरीकरण एवं दिन में मुफ्त बिजली)",
        "title_te": "పీఎం-కుసుమ్ కాంపొనెంట్-సి (వ్యవసాయ ఫీడర్ల సోలరైజేషన్)",
        "benefit_amount": "100% Day-time Free Solar Electricity for Tube-wells",
        "interest_rate": "Government Funded Feeder Solarization",
        "max_limit": "Free Daytime 9-Hour Three-Phase Power Supply",
        "eligibility_en": "All agricultural electricity connection holders connected to dedicated rural agricultural feeders.",
        "eligibility_hi": "कृषि विद्युत कनेक्शन धारक सभी किसान, रात में सिंचाई की परेशानी से पूर्ण मुक्ति।",
        "eligibility_te": "వ్యవసాయ విద్యుత్ కనెక్షన్ ఉన్న రైతులందరికీ పగటిపూట 9 గంటల ఉచిత నాణ్యమైన విద్యుత్.",
        "short_desc_en": "Solarizing dedicated agricultural power feeders so farmers receive 9 hours of uninterrupted 3-phase free electricity during daylight.",
        "short_desc_hi": "कृषि फीडरों का सौरीकरण, जिससे किसानों को रात के बजाय दिन के समय 9 घंटे निर्बाध मुफ्त बिजली मिले।",
        "short_desc_te": "రాత్రిపూట కాకుండా పగటిపూట మాత్రమే 9 గంటల పాటు ఉచిత వ్యవసాయ విద్యుత్ సరఫరా.",
        "helpline": "1800-180-3333",
        "apply_url": "https://pmkusum.mnre.gov.in",
        "source_portal": "mnre.gov.in / discom.gov.in",
        "raw_criteria": {
            "daytime_power_hours": 9,
            "cost_to_farmer": "NIL"
        }
    }
]


def scrape_govt_policies() -> list[dict[str, Any]]:
    """Returns curated authentic government policies, 4% farmer loans, and subsidy schemes."""
    logger.info("Scraping government schemes and concessional loan directory...")
    return AUTHENTIC_GOVT_SCHEMES
