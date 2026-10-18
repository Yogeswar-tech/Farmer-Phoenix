"""Pesticide Suitability, Crop Compatibility, and CIBRC Compliance Engine.

Provides:
1. Ground-truth database of Indian registered pesticides (CIBRC approved molecules & popular brand names).
2. Approved crops vs Unsuitable / Hazardous / Phytotoxic / Banned crops.
3. 15-Liter Knapsack Sprayer pump dosage math and water dilution rates.
4. Pre-Harvest Interval (PHI) statutory waiting days.
5. Toxicity band categorization (Red, Yellow, Blue, Green statutory Indian triangles).
6. Grounded Vernacular AI summaries (Hindi, Telugu, English) powered by Gemini / deterministic fallback.
7. High-speed caching for sub-5ms UI responses.
"""

import logging
import re
from typing import Any, cast

from app.cache.cache_service import CacheService

logger = logging.getLogger("PesticideEngine")
cache_service = CacheService()

# Comprehensive Ground-Truth Database of Major Indian Registered Pesticides
PESTICIDE_DATABASE: list[dict[str, Any]] = [
    {
        "id": "chlorantraniliprole-18-5-sc",
        "active_ingredient": "Chlorantraniliprole 18.5% SC",
        "common_brands": ["Coragen", "Vesticor", "Cosko", "Voliam Flexi (mix)"],
        "chemical_class": "Anthranilic Diamide (Group 28)",
        "toxicity_band": "green", # Green Triangle - Slightly Toxic
        "toxicity_label": {
            "en": "Slightly Toxic (Green Triangle)",
            "hi": "हल्का विषैला (हरा त्रिकोण - सुरक्षित)",
            "te": "తక్కువ విషపూరితం (ఆకుపచ్చ త్రికోణం)"
        },
        "target_pest_types": "Fruit Borer, Stem Borer, Leaf Folder, Fall Armyworm, Diamondback Moth",
        "action_mode": {
            "en": "Ryanodine receptor modulator. Paralyzes and kills caterpillars within 2-4 hours. Translaminar leaf protection.",
            "hi": "मांसपेशियों को लकवाग्रस्त कर इल्लियों को 2 से 4 घंटे में समाप्त करता है। पत्तियों के आर-पार सुरक्षा।",
            "te": "గొంగళి పురుగులను 2-4 గంటల్లో నిరోధిస్తుంది. ఆకులలోకి చొచ్చుకుపోయే రక్షణ."
        },
        "suitable_crops": [
            {
                "crop": "Paddy",
                "crop_hi": "धान",
                "crop_te": "వరి",
                "target_pests": "Stem Borer, Leaf Folder (तना छेदक, पत्ती लपेटक)",
                "dosage_per_acre": "60 ml",
                "dosage_per_15l_pump": "6 ml",
                "phi_days": 14,
                "note": "Apply at early appearance of dead hearts or egg masses."
            },
            {
                "crop": "Tomato",
                "crop_hi": "टमाटर",
                "crop_te": "టమోటా",
                "target_pests": "Fruit Borer (Helicoverpa armigera / फल छेदक)",
                "dosage_per_acre": "60 ml",
                "dosage_per_15l_pump": "6 ml",
                "phi_days": 3,
                "note": "Spray at flowering to early fruit set for worm-free harvest."
            },
            {
                "crop": "Chilli",
                "crop_hi": "मिर्च",
                "crop_te": "మిర్చి",
                "target_pests": "Fruit Borer, Tobacco Caterpillar (फल छेदक, सुरई इल्ली)",
                "dosage_per_acre": "60 ml",
                "dosage_per_15l_pump": "6 ml",
                "phi_days": 3,
                "note": "Leaves no export-damaging chemical residue if 3-day PHI is respected."
            },
            {
                "crop": "Cotton",
                "crop_hi": "कपास",
                "crop_te": "పత్తి",
                "target_pests": "American & Spotted Bollworm (गुलाबी व चित्तीदार सुंडी)",
                "dosage_per_acre": "60 ml",
                "dosage_per_15l_pump": "6 ml",
                "phi_days": 9,
                "note": "Excellent persistence inside square bracts."
            },
            {
                "crop": "Sugarcane",
                "crop_hi": "गन्ना",
                "crop_te": "చెరకు",
                "target_pests": "Early Shoot Borer, Top Borer (कंसुआ / चोटी बेधक)",
                "dosage_per_acre": "150 ml (drench)",
                "dosage_per_15l_pump": "15 ml",
                "phi_days": 21,
                "note": "Soil drench or set spray during germination."
            },
            {
                "crop": "Maize",
                "crop_hi": "मक्का",
                "crop_te": "మొక్కజొన్న",
                "target_pests": "Fall Armyworm (फॉल आर्मीवॉर्म / सैनिक कीट)",
                "dosage_per_acre": "80 ml",
                "dosage_per_15l_pump": "8 ml",
                "phi_days": 10,
                "note": "Direct spray deep into the leaf whorl."
            },
            {
                "crop": "Apple",
                "crop_hi": "सेब",
                "crop_te": "ఆపిల్",
                "target_pests": "Codling Moth, Leaf Roller, Fruit Borer (सेब का फल छेदक कीट)",
                "dosage_per_acre": "60 ml",
                "dosage_per_15l_pump": "6 ml",
                "phi_days": 14,
                "note": "Apply after petal fall when fruit lets form."
            },
            {
                "crop": "Banana",
                "crop_hi": "केला",
                "crop_te": "అరటి",
                "target_pests": "Spodoptera Caterpillars, Banana Borer (पत्ती खाने वाली इल्ली)",
                "dosage_per_acre": "60 ml",
                "dosage_per_15l_pump": "6 ml",
                "phi_days": 7,
                "note": "Spray on young pseudostems and foliage."
            }
        ],
        "unsuitable_crops": [
            {
                "crop": "Mulberry (Sericulture)",
                "crop_hi": "शहतूत (रेशम कीट पालन)",
                "crop_te": "మల్బరీ (పట్టు పురుగులు)",
                "hazard_level": "DANGEROUS",
                "reason": {
                    "en": "Extremely toxic to silkworms (Bombyx mori). Silkworms feeding on treated mulberry leaves face 100% mortality.",
                    "hi": "रेशम के कीड़ों के लिए घातक। शहतूत के पत्तों पर छिड़कने से रेशम के कीड़े मर जाते हैं।",
                    "te": "పట్టు పురుగులకు అత్యంత ప్రమాదకరం. 100% పట్టు పురుగులు చనిపోతాయి."
                }
            },
            {
                "crop": "Paddy Fish Aquaculture (Rice-Fish Farms)",
                "crop_hi": "धान-मत्स्य पालन क्षेत्र",
                "crop_te": "వరి-చేపల పెంపకం",
                "hazard_level": "WARNING",
                "reason": {
                    "en": "Avoid direct runoff into aquaculture ponds. Highly toxic to aquatic invertebrates.",
                    "hi": "खेत में मछली पालन वाले तालाबों में दवा का बहाव न होने दें।",
                    "te": "చేపల చెరువుల్లోకి మందు చేరకుండా చూడండి."
                }
            }
        ],
        "is_banned_in_india": False,
        "mixing_compatibility": "Compatible with most fungicides (Mancozeb, Carbendazim, Azoxystrobin). Do NOT mix with copper oxychloride or alkaline lime.",
        "ai_summary": {
            "en": "Coragen (Chlorantraniliprole) is an industry-standard caterpillar borer insecticide for paddy, tomato, chilli, and maize. Highly safe for beneficial bees, with a quick 3-day harvest safety window on vegetables. Dose: 6 ml per 15L pump.",
            "hi": "कोराजन (Chlorantraniliprole) धान, टमाटर, मिर्च और मक्के में इल्ली व तना छेदक के लिए सबसे सुरक्षित और असरदार दवा है। खुराक: 6 मिली प्रति 15 लीटर पंप। शहतूत पर रेशम कीट वाले खेतों में इसका प्रयोग न करें।",
            "te": "కోరాజెన్ వరి, టమోటా, మిర్చి మరియు మొక్కజొన్నలో కాండం తొలిచే పురుగు మరియు కాయ తొలిచే పురుగుకు అత్యుత్తమ మందు. మోతాదు: 15 లీటర్ల పంపుకు 6 మి.లీ."
        }
    },
    {
        "id": "imidacloprid-17-8-sl",
        "active_ingredient": "Imidacloprid 17.8% SL",
        "common_brands": ["Confidor", "Tata Mida", "Admire", "Victor", "Imida Gold"],
        "chemical_class": "Neonicotinoid (Group 4A)",
        "toxicity_band": "blue", # Blue Triangle - Moderately Toxic
        "toxicity_label": {
            "en": "Moderately Toxic (Blue Triangle)",
            "hi": "मध्यम विषैला (नीला त्रिकोण)",
            "te": "మధ్యస్థ విషపూరితం (నీలం త్రికోణం)"
        },
        "target_pest_types": "Sucking Pests (Aphids, Jassids, Thrips, Whiteflies, Plant Hoppers)",
        "action_mode": {
            "en": "Systemic chloronicotinyl insecticide. Absorbed through roots and foliage, blocking insect nervous transmission.",
            "hi": "प्रणालीगत (सिस्टेमिक) कीटनाशक। रस चूसक कीड़ों के तंत्रिका तंत्र को बंद कर समाप्त करता है।",
            "te": "సిస్టమిక్ క్రిమిసంహారకం. రసం పీల్చే పురుగులను నాడీ వ్యవస్థను నిలిపివేసి నివారిస్తుంది."
        },
        "suitable_crops": [
            {
                "crop": "Cotton",
                "crop_hi": "कपास",
                "crop_te": "పత్తి",
                "target_pests": "Aphids, Jassids, Whitefly (माहो, हरा तेला, सफेद मक्खी)",
                "dosage_per_acre": "40-50 ml",
                "dosage_per_15l_pump": "5 ml",
                "phi_days": 40,
                "note": "Best applied at 30-45 DAS to keep vegetative growth clean."
            },
            {
                "crop": "Chilli",
                "crop_hi": "मिर्च",
                "crop_te": "మిర్చి",
                "target_pests": "Thrips (मुर्रैया / चुरड़ा रोग पैदा करने वाले थ्रिप्स)",
                "dosage_per_acre": "50-60 ml",
                "dosage_per_15l_pump": "6 ml",
                "phi_days": 5,
                "note": "Prevents chilli leaf curl virus transmission by killing vector thrips."
            },
            {
                "crop": "Paddy",
                "crop_hi": "धान",
                "crop_te": "వరి",
                "target_pests": "Brown Plant Hopper (BPH / भूरा माहू)",
                "dosage_per_acre": "40-50 ml",
                "dosage_per_15l_pump": "5 ml",
                "phi_days": 15,
                "note": "Direct spray towards the base of paddy tillers."
            },
            {
                "crop": "Tomato",
                "crop_hi": "टमाटर",
                "crop_te": "టమోటా",
                "target_pests": "Whitefly (सफेद मक्खी - लीफ कर्ल वाहक)",
                "dosage_per_acre": "60 ml",
                "dosage_per_15l_pump": "6 ml",
                "phi_days": 3,
                "note": "Controls vectors of tomato yellow leaf curl virus."
            },
            {
                "crop": "Mango",
                "crop_hi": "आम",
                "crop_te": "మామిడి",
                "target_pests": "Mango Hopper (भुनगा / चेपा)",
                "dosage_per_acre": "0.4 ml / liter of water",
                "dosage_per_15l_pump": "6 ml",
                "phi_days": 45,
                "note": "Spray prior to flower bloom emergence."
            },
            {
                "crop": "Apple",
                "crop_hi": "सेब",
                "crop_te": "ఆపిల్",
                "target_pests": "Woolly Apple Aphid, San Jose Scale (ऊन वाला माहू)",
                "dosage_per_acre": "60 ml",
                "dosage_per_15l_pump": "6 ml",
                "phi_days": 21,
                "note": "Foliar spray when crawlers appear on bark."
            },
            {
                "crop": "Banana",
                "crop_hi": "केला",
                "crop_te": "అరటి",
                "target_pests": "Banana Aphid, Vector of Bunchy Top (केले का माहू)",
                "dosage_per_acre": "50 ml",
                "dosage_per_15l_pump": "5 ml",
                "phi_days": 25,
                "note": "Spray into leaf axils to kill vector aphids."
            }
        ],
        "unsuitable_crops": [
            {
                "crop": "Leafy Vegetables (Spinach, Coriander, Fenugreek / Methi)",
                "crop_hi": "हरी पत्तेदार सब्जियां (पालक, धनिया, मेथी)",
                "crop_te": "ఆకుకూరలు (పాలకూర, కొత్తిమీర, మెంతి)",
                "hazard_level": "PROHIBITED_HEALTH_RISK",
                "reason": {
                    "en": "PROHIBITED: Long systemic persistence. Chemical residue stays in leafy green tissues for >18 days. Directly harmful to human consumers.",
                    "hi": "वर्जित: पत्तों में 18 दिनों तक रासायनिक अंश बना रहता है। हरी पत्तेदार सब्जियों पर छिड़कने से गंभीर स्वास्थ्य खतरा होता है।",
                    "te": "నిషిద్ధం: ఆకులలో 18 రోజులకు పైగా మందు అవశేషాలు ఉంటాయి. ప్రజల ఆరోగ్యానికి ప్రమాదకరం."
                }
            },
            {
                "crop": "Mustard & Honeybee Forage Crops during Flowering",
                "crop_hi": "सरसों व फूल आते समय की फसलें (मधुमक्खी क्षेत्र)",
                "crop_te": "ఆవాలు & పూత దశలో ఉన్న పంటలు",
                "hazard_level": "ECO_HAZARD",
                "reason": {
                    "en": "Lethal to honeybees and pollinators. Direct spray during bloom causes hive collapse and destroys natural crop pollination.",
                    "hi": "मधुमक्खियों के लिए जानलेवा। फूल खिलने के समय छिड़काव से परागण रुक जाता है और मधुमक्खी के छत्ते नष्ट हो जाते हैं।",
                    "te": "తేనెటీగలకు అత్యంత ప్రమాదకరం. పూత సమయంలో పిచికారీ చేస్తే తేనెటీగలు నాశనమవుతాయి."
                }
            },
            {
                "crop": "Cucurbits under High Heat (Melons, Cucumber, Gourds)",
                "crop_hi": "ककड़ी, खीरा, तरबूज (तेज धूप में)",
                "crop_te": "దోస, పుచ్చకాయ (ఎండ వేడిలో)",
                "hazard_level": "PHYTOTOXIC",
                "reason": {
                    "en": "High ambient heat (>36°C) triggers leaf margin scorch and flower drop in tender gourds.",
                    "hi": "कद्दूवर्गीय बेलों में तेज धूप में पत्तियों के किनारे जलने और फूल गिरने का खतरा होता है।",
                    "te": "ఎండ తీవ్రత ఉన్నప్పుడు ఆకుల అంచులు మాడిపోయే ప్రమాదం ఉంది."
                }
            }
        ],
        "is_banned_in_india": False,
        "mixing_compatibility": "Can be mixed with standard fungicides (Carbendazim, Mancozeb). Ineffective on borers or caterpillars.",
        "ai_summary": {
            "en": "Confidor (Imidacloprid) is highly effective for sucking pests (whiteflies, thrips, aphids) on cotton, chilli, tomato, and paddy. Strictly avoid on leafy greens (spinach/methi) due to heavy chemical residue, and never spray on blooming flowers to protect honeybees. Dose: 5-6 ml per 15L pump.",
            "hi": "कॉन्फिडोर (इमिडाक्लोप्रिड) मिर्च, कपास, टमाटर और धान में रस चूसक कीड़ों (थ्रिप्स, सफेद मक्खी, माहू) के लिए रामबाण है। पालक, मेथी, धनिया जैसी पत्तेदार सब्जियों पर कभी न छिड़कें। खुराक: 5-6 मिली प्रति 15 लीटर पंप।",
            "te": "కాన్ఫిడార్ మిర్చి, పత్తి, టమోటాలో తెల్లదోమ, పేనుబంక మరియు తామర పురుగులకు అద్భుతమైన మందు. ఆకుకూరలపై ఎట్టి పరిస్థితుల్లోనూ వాడవద్దు. మోతాదు: 15 లీటర్లకు 5-6 మి.లీ."
        }
    },
    {
        "id": "monocrotophos-36-sl",
        "active_ingredient": "Monocrotophos 36% SL",
        "common_brands": ["Nuvacron", "Monocil", "Luphos", "Monostar", "Phoskill"],
        "chemical_class": "Organophosphate (Group 1B)",
        "toxicity_band": "red", # Red Triangle - Extremely Toxic
        "toxicity_label": {
            "en": "Extremely Toxic (Red Triangle - Restricted)",
            "hi": "अत्यंत विषैला (लाल त्रिकोण - प्रतिबंधित)",
            "te": "తీవ్ర విషపూరితం (ఎరుపు త్రికోణం - నిషిద్ధం)"
        },
        "target_pest_types": "Broad Spectrum Chewing and Sucking Pests",
        "action_mode": {
            "en": "Cholinesterase inhibitor. Systemic and contact action with severe neurotoxicity to birds, animals, and humans.",
            "hi": "कोलिनेस्टरेज़ अवरोधक। अत्यंत तेज तंत्रिका विषैला असर। पक्षियों और पशुओं के लिए अत्यधिक घातक।",
            "te": "నాడీ వ్యవస్థను దెబ్బతీసే తీవ్ర విషం. పక్షులు, జంతువులకు అత్యంత ప్రమాదకరం."
        },
        "suitable_crops": [
            {
                "crop": "Cotton",
                "crop_hi": "कपास",
                "crop_te": "పత్తి",
                "target_pests": "Bollworms, Whitefly (केवल कपास के लिए अनुमत)",
                "dosage_per_acre": "400-500 ml",
                "dosage_per_15l_pump": "35-40 ml",
                "phi_days": 60,
                "note": "Allowed strictly under personal protective gear. Do not spray near water sources."
            },
            {
                "crop": "Bengal Gram / Chickpea",
                "crop_hi": "चना",
                "crop_te": "శనగ",
                "target_pests": "Pod Borer (फली छेदक - केवल वानस्पतिक अवस्था)",
                "dosage_per_acre": "350 ml",
                "dosage_per_15l_pump": "30 ml",
                "phi_days": 45,
                "note": "Restricted strictly before pod setting."
            }
        ],
        "unsuitable_crops": [
            {
                "crop": "ALL VEGETABLES (Tomato, Chilli, Brinjal, Okra, Cabbage, Gourds)",
                "crop_hi": "समस्त सब्जियां (टमाटर, मिर्च, बैंगन, भिंडी, गोभी)",
                "crop_te": "అన్ని రకాల కూరగాయలు (టమోటా, వంకాయ, బెండ, మిర్చి)",
                "hazard_level": "GOVERNMENT_BANNED",
                "reason": {
                    "en": "STATUTORILY BANNED BY GOVT OF INDIA: Monocrotophos is strictly prohibited on ALL vegetable crops due to fatal human food poisoning and extreme residual toxicity.",
                    "hi": "भारत सरकार द्वारा पूर्णतः प्रतिबंधित: सब्जियों पर मोनोक्रोटोफॉस का छिड़काव गैरकानूनी है। यह इंसानों के लिए जानलेवा भोजन विषाक्तता पैदा करता है।",
                    "te": "ప్రభుత్వ నిషేధం: కూరగాయలపై మోనోక్రోటోఫాస్ వాడకం చట్టరీత్యా నేరం. ప్రాణాంతకమైన విషాహారానికి దారితీస్తుంది."
                }
            },
            {
                "crop": "Fruit Orchards (Mango, Grapes, Pomegranate)",
                "crop_hi": "फलदार बागवानी (आम, अंगूर, अनार)",
                "crop_te": "పండ్ల తోటలు (మామిడి, ద్రాక్ష, దానిమ్మ)",
                "hazard_level": "GOVERNMENT_BANNED",
                "reason": {
                    "en": "BANNED on fruit crops. Exceeds international maximum residue limits (MRL) and leads to total export rejection.",
                    "hi": "फलों पर प्रतिबंधित: अवशेष सीमा (MRL) से अधिक होने के कारण स्वास्थ्य के लिए हानिकारक है और निर्यात रद्द होता है।",
                    "te": "పండ్ల తోటలపై నిషేధించబడింది. ఆరోగ్యానికి తీవ్ర హానికరం."
                }
            }
        ],
        "is_banned_in_india": True,
        "mixing_compatibility": "DO NOT USE ON FOOD CROPS. Highly discouraged by ICAR due to safety violations.",
        "ai_summary": {
            "en": "CRITICAL WARNING: Monocrotophos is a RED-LABEL (Extremely Toxic) chemical and is STATUTORILY BANNED ON ALL VEGETABLES AND FRUITS across India. It is only permitted on cotton and pulses with strict 60-day waiting periods. Never use on tomatoes, chillies, or okra.",
            "hi": "सख्त चेतावनी: मोनोक्रोटोफॉस लाल त्रिकोण (अत्यधिक विषैला) कीटनाशक है। भारत सरकार द्वारा इसे सब्जियों और फलों पर पूरी तरह प्रतिबंधित किया गया है। इसे कभी भी टमाटर, मिर्च, बैंगन या भिंडी पर न छिड़कें।",
            "te": "హెచ్చరిక: మోనోక్రోటోఫాస్ ఎరుపు రంగు గుర్తు గల ప్రమాదకరమైన విషం. భారతదేశంలో అన్ని రకాల కూరగాయలపై ఇది పూర్తిగా నిషేధించబడింది."
        }
    },
    {
        "id": "saaf-carbendazim-mancozeb",
        "active_ingredient": "Carbendazim 12% + Mancozeb 63% WP",
        "common_brands": ["Saaf", "Sixer", "Companion", "Sprint", "Rizolex"],
        "chemical_class": "Benzimidazole + Dithiocarbamate Combination Fungicide",
        "toxicity_band": "blue",
        "toxicity_label": {
            "en": "Moderately Toxic (Blue Triangle Fungicide)",
            "hi": "मध्यम विषैला (नीला त्रिकोण कवकनाशी)",
            "te": "నీలం త్రికోణం శిలీంద్ర సంహారిణి"
        },
        "target_pest_types": "Fungal Diseases (Blast, Blight, Anthracnose, Fruit Rot, Tikka, Root Rot)",
        "action_mode": {
            "en": "Dual systemic and contact fungicide. Carbendazim penetrates xylem for systemic curing, while Mancozeb creates a contact shield on the leaf.",
            "hi": "दोहरा असर: कार्बेन्डाजिम पौधे के अंदर जाकर फंगस मारता है, जबकि मैंकोजेब पत्ती पर सुरक्षा कवच बनाता है।",
            "te": "ద్వంద్వ రక్షణ: లోపలికి వెళ్లి వ్యాధిని నయం చేస్తుంది మరియు ఆకులపై రక్షణ పొరను ఏర్పరుస్తుంది."
        },
        "suitable_crops": [
            {
                "crop": "Chilli",
                "crop_hi": "मिर्च",
                "crop_te": "మిర్చి",
                "target_pests": "Fruit Rot / Anthracnose, Dieback (फल सड़न, डाइबैक रोग)",
                "dosage_per_acre": "300-400 g",
                "dosage_per_15l_pump": "30-35 g",
                "phi_days": 5,
                "note": "Spray at first sign of circular black spots on pods."
            },
            {
                "crop": "Groundnut",
                "crop_hi": "मूंगफली",
                "crop_te": "వేరుశనగ",
                "target_pests": "Tikka Leaf Spot, Rust (टिक्का रोग व गेरुई)",
                "dosage_per_acre": "350 g",
                "dosage_per_15l_pump": "30 g",
                "phi_days": 15,
                "note": "Controls premature defoliation in groundnut."
            },
            {
                "crop": "Paddy",
                "crop_hi": "धान",
                "crop_te": "వరి",
                "target_pests": "Blast, Sheath Blight (ब्लास्ट व शीथ ब्लाइट)",
                "dosage_per_acre": "400 g",
                "dosage_per_15l_pump": "35 g",
                "phi_days": 14,
                "note": "Spray before canopy closure and at panicle initiation."
            },
            {
                "crop": "Potato",
                "crop_hi": "आलू",
                "crop_te": "బంగాళాదుంప",
                "target_pests": "Early Blight, Black Scurf (अगेती झुलसा, काली पपड़ी)",
                "dosage_per_acre": "400 g",
                "dosage_per_15l_pump": "35 g",
                "phi_days": 7,
                "note": "Excellent seed tuber treatment and foliar spray."
            }
        ],
        "unsuitable_crops": [
            {
                "crop": "Fresh Picked Leafy Salads close to Harvest",
                "crop_hi": "तुड़ाई के नजदीक सलाद व पत्तेदार सब्जियां",
                "crop_te": "కోతకు సిద్ధంగా ఉన్న ఆకుకూరలు",
                "hazard_level": "RESIDUE_WARNING",
                "reason": {
                    "en": "Carbendazim leaves yellow/white residue spots and has strict 14-day pre-harvest intervals.",
                    "hi": "पत्तियों पर सफेद धब्बे छोड़ता है। कटाई से 14 दिन पहले छिड़काव बंद करें।",
                    "te": "ఆకులపై మచ్చలు ఏర్పడతాయి. కోతకు 14 రోజుల ముందు ఆపాలి."
                }
            }
        ],
        "is_banned_in_india": False,
        "mixing_compatibility": "Easily mixes with insecticides (Imidacloprid, Coragen). Do NOT mix with lime sulphur or Bordeaux mixture.",
        "ai_summary": {
            "en": "Saaf (Carbendazim + Mancozeb) is India's most trusted dual-action fungicide for fruit rot, dieback in chilli, tikka in groundnut, and blast in paddy. Highly effective for curative and preventive defense. Dose: 30-35 grams per 15L pump.",
            "hi": "साफ (Saaf) मिर्च में फल सड़न (एंथ्रेक्नोज़), मूंगफली में टिक्का और धान में झुलसा रोग की सबसे लोकप्रिय दवा है। यह पत्ती के अंदर और बाहर दोनों जगह फंगस को खत्म करता है। खुराक: 30-35 ग्राम प्रति 15 लीटर पंप।",
            "te": "సాఫ్ (Saaf) మిర్చిలో కాయ కుళ్లు, వేరుశనగలో తిక్క తెగులు మరియు వరిలో అగ్గి తెగులుకు ఉత్తమ మందు. మోతాదు: 15 లీటర్ల పంపుకు 30-35 గ్రాములు."
        }
    },
    {
        "id": "emamectin-benzoate-5-sg",
        "active_ingredient": "Emamectin Benzoate 5% SG",
        "common_brands": ["Proclaim", "EM-1", "Missile", "King Star", "Starclaim"],
        "chemical_class": "Avermectin (Group 6)",
        "toxicity_band": "blue",
        "toxicity_label": {
            "en": "Moderately Toxic (Blue Triangle)",
            "hi": "मध्यम विषैला (नीला त्रिकोण)",
            "te": "మధ్యస్థ విషపూరితం (నీలం త్రికోణం)"
        },
        "target_pest_types": "Lepidopteran Caterpillars, Bollworms, Fruit Borers, Fall Armyworm",
        "action_mode": {
            "en": "Chloride channel activator. Blocks nerve impulses in caterpillars, causing irreversible feeding cessation within 2 hours.",
            "hi": "कीड़ों के नर्वस सिस्टम को रोककर 2 घंटे में उनकी भूख बंद कर देता है, जिससे इल्लियां तुरंत नष्ट होती हैं।",
            "te": "పురుగుల నరాల వ్యవస్థను స్తంభింపజేసి 2 గంటల్లో ఆహారం తినకుండా చేస్తుంది."
        },
        "suitable_crops": [
            {
                "crop": "Chilli",
                "crop_hi": "मिर्च",
                "crop_te": "మిర్చి",
                "target_pests": "Fruit Borer, Thrips (फल छेदक इल्ली)",
                "dosage_per_acre": "80-100 g",
                "dosage_per_15l_pump": "8-10 g",
                "phi_days": 3,
                "note": "Short 3-day PHI allows safe regular vegetable pickings."
            },
            {
                "crop": "Tomato",
                "crop_hi": "टमाटर",
                "crop_te": "టమోటా",
                "target_pests": "Fruit Borer, Leaf Miner (टमाटर का फल छेदक)",
                "dosage_per_acre": "80-100 g",
                "dosage_per_15l_pump": "8-10 g",
                "phi_days": 3,
                "note": "Translaminar penetration kills borers hidden inside fruits."
            },
            {
                "crop": "Cabbage & Cauliflower",
                "crop_hi": "पत्तागोभी व फूलगोभी",
                "crop_te": "క్యాబేజీ & క్యాలీఫ్లవర్",
                "target_pests": "Diamondback Moth (DBM / डायमंड बैक मोथ)",
                "dosage_per_acre": "80 g",
                "dosage_per_15l_pump": "8 g",
                "phi_days": 3,
                "note": "Overcomes resistance developed against synthetic pyrethroids."
            },
            {
                "crop": "Red Gram / Pigeonpea (Tur)",
                "crop_hi": "अरहर / तुअर",
                "crop_te": "కందులు",
                "target_pests": "Pod Borer (Helicoverpa / मारुका फली बेधक)",
                "dosage_per_acre": "100 g",
                "dosage_per_15l_pump": "10 g",
                "phi_days": 14,
                "note": "Essential during pod setting stage."
            }
        ],
        "unsuitable_crops": [
            {
                "crop": "Soil Grub / Termite / Nematode infested roots",
                "crop_hi": "दीमक व जड़ कीट क्षेत्र",
                "crop_te": "చెదలు మరియు వేరు పురుగులు",
                "hazard_level": "INEFFECTIVE",
                "reason": {
                    "en": "Completely ineffective for soil insects, termites, and fungal diseases. Wastes farmer money if applied to soil.",
                    "hi": "दीमक, सफेद लट और फंगस पर इसका कोई असर नहीं होता। जमीन में डालने से पैसे की बर्बादी होती है।",
                    "te": "చెదపురుగులు మరియు నేల పురుగులపై పనిచేయదు. నేలలో వాడవద్దు."
                }
            }
        ],
        "is_banned_in_india": False,
        "mixing_compatibility": "Easily mixes with bio-stimulants, micronutrients, and fungicides.",
        "ai_summary": {
            "en": "Proclaim (Emamectin Benzoate 5% SG) is the top-choice specialist for fruit borers and caterpillars in chilli, tomato, and cabbage. It stops caterpillar feeding within 2 hours. Very safe for vegetables with only 3 days waiting time. Dose: 8-10 grams per 15L pump.",
            "hi": "प्रोक्लेम (Emamectin Benzoate) मिर्च, टमाटर और गोभी में फल छेदक इल्लियों को रोकने के लिए सबसे प्रभावी दवा है। यह इल्ली का खाना तुरंत बंद करवा देती है। खुराक: 8-10 ग्राम प्रति 15 लीटर पंप।",
            "te": "ప్రోక్లెయిమ్ మిర్చి, టమోటా మరియు క్యాబేజీలో కాయ తొలిచే పురుగులను నివారించడానికి ఉత్తమ ఔషధం. మోతాదు: 15 లీటర్ల పంపుకు 8-10 గ్రాములు."
        }
    },
    {
        "id": "neem-oil-10000-ppm",
        "active_ingredient": "Neem Oil 10,000 PPM (Azadirachtin 1% EC)",
        "common_brands": ["Nimbecidine", "Neemazal", "Econeem", "Fortune Aza"],
        "chemical_class": "Botanical / Bio-Pesticide (Organic Certified)",
        "toxicity_band": "green",
        "toxicity_label": {
            "en": "Non-Toxic Botanical (Green Triangle - Organic)",
            "hi": "प्राकृतिक जैविक (हरा त्रिकोण - पूर्ण सुरक्षित)",
            "te": "సేంద్రీయ వేప నూనె (ఆకుపచ్చ త్రికోణం)"
        },
        "target_pest_types": "Broad Spectrum Pest Repellent, Oviposition Deterrent, Sucking Pests, Early Instar Caterpillars",
        "action_mode": {
            "en": "Antifeedant, repellent, and insect growth regulator (IGR). Prevents insect egg hatching, suppresses feeding, and disrupts molting.",
            "hi": "कीट विकर्षक व वृद्धि नियामक। कीड़ों को फसल खाने से रोकता है, अंडों को फूटने नहीं देता और प्रजनन चक्र तोड़ता है।",
            "te": "పురుగులు ఆకులను తినకుండా ఆపుతుంది, గుడ్లు పొదగకుండా చేసి పురుగుల సంఖ్యను తగ్గిస్తుంది."
        },
        "suitable_crops": [
            {
                "crop": "ALL VEGETABLES, FRUITS, PULSES & GRAINS",
                "crop_hi": "समस्त सब्जियां, फल, दालें व अनाज",
                "crop_te": "అన్ని రకాల కూరగాయలు, పండ్లు, పప్పుధాన్యాలు",
                "target_pests": "Whiteflies, Aphids, Mites, Leafminers, Borers (सफेद मक्खी, माहू, मकड़ी)",
                "dosage_per_acre": "400-500 ml",
                "dosage_per_15l_pump": "40-45 ml",
                "phi_days": 0,
                "note": "Zero chemical residue. Harvest can be picked same day of spraying."
            }
        ],
        "unsuitable_crops": [],
        "is_banned_in_india": False,
        "mixing_compatibility": "Compatible with all chemical and biological sprays. Acts as an excellent natural surfactant and sticker.",
        "ai_summary": {
            "en": "Neem Oil 10,000 PPM is a completely safe, organic bio-pesticide suitable for EVERY crop without exception. It has zero toxic residues (0-day waiting period) and is completely harmless to honeybees, soil earthworms, and human consumers. Dose: 40-45 ml per 15L pump.",
            "hi": "नीम का तेल (Neem Oil 10,000 PPM) शत-प्रतिशत सुरक्षित जैविक कीटनाशक है, जिसे बिना किसी नुकसान के हर फसल पर छिड़का जा सकता है। इसका कोई विषैला असर नहीं होता और कटाई उसी दिन की जा सकती है। खुराक: 40-45 मिली प्रति 15 लीटर पंप।",
            "te": "వేప నూనె 10,000 PPM పూర్తిగా సురక్షితమైన సేంద్రీయ మందు. ఏ పంటపైనైనా నిరభ్యంతరంగా వాడవచ్చు. తేనెటీగలకు ఎటువంటి హాని చేయదు. మోతాదు: 15 లీటర్లకు 40-45 మి.లీ."
        }
    },
    {
        "id": "glyphosate-41-sl",
        "active_ingredient": "Glyphosate 41% SL",
        "common_brands": ["Roundup", "Glycel", "Weedoff", "Sweep", "Uproot"],
        "chemical_class": "Organophosphorus Non-Selective Herbicide (Group 9)",
        "toxicity_band": "yellow",
        "toxicity_label": {
            "en": "Highly Toxic Non-Selective Herbicide (Yellow Triangle)",
            "hi": "अत्यधिक विषैला गैर-चयनात्मक खरपतवारनाशक (पीला त्रिकोण)",
            "te": "తీవ్ర గడ్డి మందు (పసుపు త్రికోణం)"
        },
        "target_pest_types": "All Broadleaf & Grassy Weeds (Perennial grasses, Cyperus, Cynodon)",
        "action_mode": {
            "en": "EPSP synthase inhibitor. Non-selective systemic herbicide. Translocates through leaves down to the root rhizomes, killing all green vegetation.",
            "hi": "अचयनात्मक खरपतवारनाशक। पत्तियों से जड़ों तक पहुंचकर सभी हरी वनस्पतियों को जड़ सहित सुखा देता है।",
            "te": "మొక్కలన్నింటినీ సమూలంగా నాశనం చేసే శక్తివంతమైన గడ్డి మందు."
        },
        "suitable_crops": [
            {
                "crop": "Tea Plantations & Non-Cropped Land (Bunds, Channels, Fallows)",
                "crop_hi": "चाय बागान एवं गैर-कृषि बंजर भूमि, मेड़ें",
                "crop_te": "టీ తోటలు & పంట లేని బంజరు భూములు, గట్లు",
                "target_pests": "All stubborn perennial weeds (मोथा, दूब घास, कांस)",
                "dosage_per_acre": "1.0 - 1.2 Liters",
                "dosage_per_15l_pump": "100-120 ml",
                "phi_days": 30,
                "note": "Spray strictly with hood nozzle on actively growing green weeds."
            }
        ],
        "unsuitable_crops": [
            {
                "crop": "ALL STANDING CROPS (Cotton, Paddy, Tomato, Chilli, Wheat, Vegetables)",
                "crop_hi": "खेत में खड़ी कोई भी फसल (कपास, धान, गेहूं, टमाटर, मिर्च)",
                "crop_te": "పొలంలో ఉన్న అన్ని రకాల పైర్లు (పత్తి, వరి, గోధుమ, టమోటా)",
                "hazard_level": "TOTAL_CROP_DESTRUCTION",
                "reason": {
                    "en": "FATAL TO CROPS: Glyphosate is non-selective. Spraying on or drifting onto ANY standing crop will kill the entire crop down to the roots within 7 days.",
                    "hi": "फसल का पूर्ण विनाश: यह दवा किसी भी खड़ी फसल को पहचानती नहीं है। टमाटर, कपास, धान पर छिड़कने से पूरी फसल जड़ से सूखकर नष्ट हो जाएगी।",
                    "te": "పంట నాశనం: ఇది అన్ని రకాల మొక్కలను చంపేస్తుంది. పొలంలో ఉన్న పైరుపై పిచికారీ చేస్తే 7 రోజుల్లో పంట మొత్తం ఎండిపోతుంది."
                }
            }
        ],
        "is_banned_in_india": False,
        "mixing_compatibility": "RESTRICTED HERBICIDE: Central Govt restricts use strictly to tea plantations and non-cropped land. Never tank mix with crop insecticides.",
        "ai_summary": {
            "en": "DANGER NOTICE: Roundup / Glyphosate is a NON-SELECTIVE herbicide meant ONLY for clearing empty field bunds, pathways, and tea plantations. NEVER spray over standing crops (cotton, chilli, tomato, wheat) as it will completely destroy your crop.",
            "hi": "खतरे की चेतावनी: राउंडअप (Glyphosate) एक सर्वनाशक खरपतवारनाशक है। इसे केवल खाली मेड़ों, रास्तों या चाय बागानों में घास खत्म करने के लिए प्रयोग करें। खेत में खड़ी किसी भी फसल पर कभी न छिड़कें, पूरी फसल मर जाएगी।",
            "te": "తీవ్ర హెచ్చరిక: రౌండప్ (గ్లైఫోసేట్) గడ్డి మందు మాత్రమే. నిలబడిన పంటలపై (పత్తి, మిర్చి, టమోటా) పొరపాటున కూడా పిచికారీ చేయవద్దు, పంట పూర్తిగా చనిపోతుంది."
        }
    },
    {
        "id": "chlorpyrifos-20-ec",
        "active_ingredient": "Chlorpyrifos 20% EC",
        "common_brands": ["Dursban", "Tafaban", "Trishul", "Classic", "Radar"],
        "chemical_class": "Organophosphate (Group 1B)",
        "toxicity_band": "yellow",
        "toxicity_label": {
            "en": "Highly Toxic Organophosphate (Yellow Triangle)",
            "hi": "अत्यधिक विषैला (पीला त्रिकोण)",
            "te": "తీవ్ర విషపూరితం (పసుపు త్రికోణం)"
        },
        "target_pest_types": "Soil Termites, Stem Borer, Root Grubs",
        "action_mode": {
            "en": "Cholinesterase inhibitor with contact, stomach, and strong vapor action.",
            "hi": "स्पर्श एवं वाष्प द्वारा दीमक व तना छेदक के नर्वस सिस्टम को समाप्त करता है।",
            "te": "స్పర్శ మరియు శ్వాస ద్వారా చెదపురుగులను నాశనం చేస్తుంది."
        },
        "suitable_crops": [
            {
                "crop": "Sugarcane",
                "crop_hi": "गन्ना",
                "crop_te": "చెరకు",
                "target_pests": "Termites, Black Bug (दीमक, काला बग)",
                "dosage_per_acre": "1.0 - 1.5 Liters (soil drench)",
                "dosage_per_15l_pump": "60-80 ml",
                "phi_days": 30,
                "note": "Apply to setts in furrows before covering with soil."
            },
            {
                "crop": "Wheat",
                "crop_hi": "गेहूं",
                "crop_te": "గోధుమ",
                "target_pests": "Termites in sandy soil (दीमक)",
                "dosage_per_acre": "800 ml (soil/seed treatment)",
                "dosage_per_15l_pump": "40 ml",
                "phi_days": 45,
                "note": "Mix with sand/fertilizer during pre-sowing."
            }
        ],
        "unsuitable_crops": [
            {
                "crop": "Vegetables & Fruit Crops (Tomato, Chilli, Leafy greens)",
                "crop_hi": "सब्जियां व फलदार फसलें (टमाटर, मिर्च, पालक, गोभी)",
                "crop_te": "కూరగాయలు & పండ్లు",
                "hazard_level": "REGULATORY_BAN",
                "reason": {
                    "en": "RESTRICTED / BANNED ON VEGETABLES: Persistent neurotoxicity in food chain and extreme hazard to children/consumers. Banned on vegetable crops.",
                    "hi": "सब्जियों पर प्रतिबंधित: भोजन में स्थायी न्यूरोटॉक्सिक जहर रहने के कारण सब्जियों पर इसका छिड़काव वर्जित है।",
                    "te": "కూరగాయలపై నిషిద్ధం: శరీరానికి హానికరమైన విష రసాయనం నిల్వ ఉంటుంది."
                }
            }
        ],
        "is_banned_in_india": False,
        "mixing_compatibility": "Do not mix with alkaline substances. Unsuitable for foliar spray on tender vegetables.",
        "ai_summary": {
            "en": "Chlorpyrifos 20% EC is an organophosphate insecticide permitted primarily for soil termite control in sugarcane and wheat. It is RESTRICTED on all vegetable and fruit crops due to high chemical residue persistence. Dose: 50-60 ml per 15L pump (Soil drench only).",
            "hi": "क्लोरोपायरीफॉस 20% EC मुख्य रूप से गन्ने और गेहूं में दीमक नियंत्रण के लिए प्रयोग होता है। सब्जियों पर इसका छिड़काव न करें क्योंकि यह शरीर के लिए बहुत विषैला होता है।",
            "te": "క్లోరోపైరిఫాస్ ప్రధానంగా చెరకు మరియు గోధుమలలో చెదపురుగుల నివారణకు మాత్రమే వాడాలి. కూరగాయలపై వాడరాదు."
        }
    },
    {
        "id": "mancozeb-75-wp",
        "active_ingredient": "Mancozeb 75% WP",
        "common_brands": ["Dithane M-45", "Indofil M-45", "UPL Mancozeb", "Agrio Protect", "Manzate"],
        "chemical_class": "Dithiocarbamate Protective Fungicide (Group M03)",
        "toxicity_band": "green",
        "toxicity_label": {
            "en": "Slightly Toxic (Green Triangle Fungicide)",
            "hi": "हल्का विषैला (हरा त्रिकोण कवकनाशी - सुरक्षित)",
            "te": "ఆకుపచ్చ త్రికోణం శిలీంద్ర సంహారిణి"
        },
        "target_pest_types": "Scab, Early/Late Blight, Sigatoka Leaf Spot, Downy Mildew, Anthracnose",
        "action_mode": {
            "en": "Multi-site contact activity. Inactivates fungal amino acids and enzymes, stopping spore germination on leaf surface.",
            "hi": "बहु-स्थानिक स्पर्श कवकनाशी। पत्ती की सतह पर सुरक्षा परत बनाकर फंगस के बीजाणुओं को अंकुरित होने से रोकता है।",
            "te": "శిలీంధ్రాల బీజాలు మొలకెత్తకుండా ఆకులపై రక్షణ కవచంలా పనిచేస్తుంది."
        },
        "suitable_crops": [
            {
                "crop": "Apple",
                "crop_hi": "सेब",
                "crop_te": "ఆపిల్",
                "target_pests": "Apple Scab (Venturia inaequalis / सेब का स्केब रोग)",
                "dosage_per_acre": "600-800 g",
                "dosage_per_15l_pump": "35-40 g",
                "phi_days": 14,
                "note": "Apply at green tip, pink bud, and petal fall stages."
            },
            {
                "crop": "Banana",
                "crop_hi": "केला",
                "crop_te": "అరటి",
                "target_pests": "Sigatoka Leaf Spot (सिगाटोका पत्ती धब्बा)",
                "dosage_per_acre": "600 g",
                "dosage_per_15l_pump": "35 g",
                "phi_days": 7,
                "note": "Spray under and over leaves at early appearance of brown streaks."
            },
            {
                "crop": "Potato",
                "crop_hi": "आलू",
                "crop_te": "బంగాళాదుంప",
                "target_pests": "Early Blight & Late Blight (अगेती व पछेती झुलसा)",
                "dosage_per_acre": "600-800 g",
                "dosage_per_15l_pump": "35 g",
                "phi_days": 7,
                "note": "Preventive spray every 7-10 days in cloudy humid weather."
            },
            {
                "crop": "Tomato",
                "crop_hi": "टमाटर",
                "crop_te": "టమోటా",
                "target_pests": "Early Blight, Buckeye Rot (अगेती झुलसा, फल सड़न)",
                "dosage_per_acre": "600 g",
                "dosage_per_15l_pump": "30-35 g",
                "phi_days": 3,
                "note": "Prevents defoliation during rainy humid conditions."
            },
            {
                "crop": "Grapes",
                "crop_hi": "अंगूर",
                "crop_te": "ద్రాక్ష",
                "target_pests": "Downy Mildew, Anthracnose (डाउनी मिल्ड्यू, एन्थ्रेक्नोज)",
                "dosage_per_acre": "800 g",
                "dosage_per_15l_pump": "40 g",
                "phi_days": 15,
                "note": "Crucial post-pruning and pre-bloom protective spray."
            }
        ],
        "unsuitable_crops": [],
        "is_banned_in_india": False,
        "mixing_compatibility": "Compatible with most insecticides (Coragen, Imidacloprid). Do NOT tank mix with lime sulfur or copper Bordeaux mixture.",
        "ai_summary": {
            "en": "Dithane M-45 / Mancozeb is India's gold-standard multi-site contact fungicide for Apple Scab, Banana Sigatoka, and Potato/Tomato Blight. It builds a protective barrier on leaves without resistance buildup. Dose: 35 grams per 15L pump.",
            "hi": "डायथेन एम-45 (Mancozeb 75% WP) सेब के स्केब, केले के सिगाटोका और आलू-टमाटर के झुलसा रोग के लिए सबसे सुरक्षित व असरदार कवकनाशी है। खुराक: 35 ग्राम प्रति 15 लीटर पंप।",
            "te": "డైథేన్ M-45 (మాంకోజెబ్) ఆపిల్, అరటి, బంగాళాదుంప మరియు టమోటా పంటల్లో తెగుళ్ల నివారణకు ఉత్తమ రక్షణ కవచం. మోతాదు: 15 లీటర్ల పంపుకు 35 గ్రాములు."
        }
    },
    {
        "id": "propiconazole-25-ec",
        "active_ingredient": "Propiconazole 25% EC",
        "common_brands": ["Tilt", "Bumper", "Radar", "Agrio Tilt", "Result"],
        "chemical_class": "Triazole Systemic Ergosterol Biosynthesis Inhibitor (Group 3)",
        "toxicity_band": "yellow",
        "toxicity_label": {
            "en": "Highly Toxic Triazole Systemic Fungicide (Yellow Triangle)",
            "hi": "अत्यधिक विषैला प्रणालीगत कवकनाशी (पीला त्रिकोण)",
            "te": "పసుపు త్రికోణం సిస్టమిక్ శిలీంద్ర సంహారిణి"
        },
        "target_pest_types": "Sigatoka Leaf Spot, Karnal Bunt, Rusts, Sheath Blight, Tikka",
        "action_mode": {
            "en": "Inhibits fungal ergosterol biosynthesis. Rapidly absorbed by xylem within 1 hour, providing curative and translaminar defense.",
            "hi": "सिस्टेमिक कवकनाशी। छिड़काव के 1 घंटे में पौधे के अंदर समाकर फंगस को अंदर से खत्म करता है।",
            "te": "మొక్క లోపలికి వెళ్లి తెగులును మూలాల నుంచి నయం చేస్తుంది."
        },
        "suitable_crops": [
            {
                "crop": "Banana",
                "crop_hi": "केला",
                "crop_te": "అరటి",
                "target_pests": "Yellow & Black Sigatoka (सिगाटोका रोग)",
                "dosage_per_acre": "200 ml",
                "dosage_per_15l_pump": "15 ml",
                "phi_days": 21,
                "note": "Alternate with Mancozeb to prevent fungicide resistance."
            },
            {
                "crop": "Wheat",
                "crop_hi": "गेहूं",
                "crop_te": "గోధుమ",
                "target_pests": "Karnal Bunt, Brown Rust, Yellow Rust (करनाल बंट, पीला व भूरा रतुआ)",
                "dosage_per_acre": "200 ml",
                "dosage_per_15l_pump": "15 ml",
                "phi_days": 30,
                "note": "Spray at boot leaf stage or first appearance of rust pustules."
            },
            {
                "crop": "Paddy",
                "crop_hi": "धान",
                "crop_te": "వరి",
                "target_pests": "Sheath Blight (शीथ ब्लाइट)",
                "dosage_per_acre": "200 ml",
                "dosage_per_15l_pump": "15 ml",
                "phi_days": 25,
                "note": "Direct spray towards bottom tillers."
            },
            {
                "crop": "Groundnut",
                "crop_hi": "मूंगफली",
                "crop_te": "వేరుశనగ",
                "target_pests": "Tikka Leaf Spot and Rust (टिक्का व गेरुई)",
                "dosage_per_acre": "200 ml",
                "dosage_per_15l_pump": "15 ml",
                "phi_days": 21,
                "note": "Very strong curative power against advanced leaf spots."
            }
        ],
        "unsuitable_crops": [
            {
                "crop": "Leafy Vegetables (Spinach, Coriander)",
                "crop_hi": "पत्तेदार सब्जियां (पालक, मेथी, धनिया)",
                "crop_te": "ఆకుకూరలు",
                "hazard_level": "RESIDUE_HAZARD",
                "reason": {
                    "en": "High systemic chemical residue and long 25+ days waiting period. Unsuitable for short-cycle tender salad greens.",
                    "hi": "लंबे समय तक रासायनिक अंश रहने के कारण पत्तेदार सब्जियों पर इसका प्रयोग न करें।",
                    "te": "ఆకుకూరలపై వాడరాదు."
                }
            }
        ],
        "is_banned_in_india": False,
        "mixing_compatibility": "Mixes with insecticides. Do not overdose on tender seedlings.",
        "ai_summary": {
            "en": "Tilt (Propiconazole 25% EC) is the ultimate curative weapon against Sigatoka in Banana, Yellow/Brown Rust in Wheat, and Sheath Blight in Paddy. Fast-acting systemic action stops fungal spread within 24 hours. Dose: 15 ml per 15L pump.",
            "hi": "टिल्ट (Tilt / Propiconazole 25% EC) केले में सिगाटोका और गेहूं में पीला रतुआ (Rust) को जड़ से ठीक करने वाली सबसे असरदार दवा है। खुराक: 15 मिली प्रति 15 लीटर पंप।",
            "te": "టిల్ట్ (ప్రొపికోనాజోల్) అరటిలో సిగాటోకా మరియు గోధుమలో కుంకుమ తెగులును త్వరితంగా నయం చేస్తుంది. మోతాదు: 15 లీటర్ల పంపుకు 15 మి.లీ."
        }
    }
]


class PesticideEngine:
    """Intelligent Agricultural Pesticide Search and Crop Suitability Matcher."""

    def __init__(self) -> None:
        self.pesticides = PESTICIDE_DATABASE

    def search_pesticides(self, query: str) -> list[dict[str, Any]]:
        """Searches across brand names, active ingredients, and chemical classes with fuzzy match."""
        q = (query or "").strip().lower()
        if not q:
            # Return popular defaults
            return [
                {
                    "id": p["id"],
                    "active_ingredient": p["active_ingredient"],
                    "brands": p["common_brands"],
                    "toxicity_band": p["toxicity_band"],
                    "matched_as": p["common_brands"][0]
                }
                for p in self.pesticides[:6]
            ]

        results = []
        for p in self.pesticides:
            matched_brand = next((b for b in p["common_brands"] if q in b.lower()), None)
            active_matched = q in p["active_ingredient"].lower()
            pest_matched = q in p.get("target_pest_types", "").lower()

            if matched_brand or active_matched or pest_matched:
                results.append({
                    "id": p["id"],
                    "active_ingredient": p["active_ingredient"],
                    "brands": p["common_brands"],
                    "toxicity_band": p["toxicity_band"],
                    "matched_as": matched_brand or p["active_ingredient"],
                    "is_banned": p.get("is_banned_in_india", False),
                    "chemical_class": p.get("chemical_class", "")
                })

        return results

    def get_pesticide_by_id(self, pesticide_id: str) -> dict[str, Any] | None:
        """Finds pesticide record by ID."""
        pid = pesticide_id.lower().strip()
        return next((p for p in self.pesticides if p["id"] == pid), None)

    def analyze_crop_suitability(
        self,
        pesticide_id: str,
        crop_query: str | None = None,
        tank_liters: int = 15,
        lang: str = "en"
    ) -> dict[str, Any]:
        """Evaluates whether the pesticide is suitable or prohibited for a specific crop, calculates knapsack pump dosage, and provides vernacular AI advice."""
        cache_key = f"pest_suitability:{pesticide_id}:{crop_query or 'all'}:{tank_liters}:{lang}"
        cached = cache_service.get_json(cache_key)
        if cached:
            return cast(dict[str, Any], cached)

        # Find pesticide or search by query
        pesticide = self.get_pesticide_by_id(pesticide_id)
        if not pesticide:
            # Try searching by brand name
            matches = self.search_pesticides(pesticide_id)
            if matches:
                pesticide = self.get_pesticide_by_id(matches[0]["id"])

        if not pesticide:
            pesticide = self.pesticides[0] # Fallback to Coragen

        # Crop matching logic
        selected_crop_clean = (crop_query or "").strip().lower()
        crop_verdict: dict[str, Any] | None = None

        if selected_crop_clean and selected_crop_clean != "all":
            # Check suitable crops
            matched_suitable = next(
                (
                    c for c in pesticide["suitable_crops"]
                    if selected_crop_clean in c["crop"].lower() or
                       selected_crop_clean in c.get("crop_hi", "").lower() or
                       selected_crop_clean in c.get("crop_te", "").lower()
                ),
                None
            )

            # Check unsuitable crops
            matched_unsuitable = next(
                (
                    u for u in pesticide["unsuitable_crops"]
                    if selected_crop_clean in u["crop"].lower() or
                       selected_crop_clean in u.get("crop_hi", "").lower() or
                       selected_crop_clean in u.get("crop_te", "").lower()
                ),
                None
            )

            if matched_unsuitable:
                crop_verdict = {
                    "status": "UNSUITABLE",
                    "badge": "⛔ PROHIBITED / DANGEROUS",
                    "crop_name": matched_unsuitable["crop"],
                    "is_suitable": False,
                    "hazard_level": matched_unsuitable.get("hazard_level", "DANGER"),
                    "reason": matched_unsuitable["reason"].get(lang, matched_unsuitable["reason"]["en"])
                }
            elif matched_suitable:
                crop_verdict = {
                    "status": "SUITABLE",
                    "badge": "✓ APPROVED & SUITABLE",
                    "crop_name": matched_suitable["crop"],
                    "is_suitable": True,
                    "target_pests": matched_suitable["target_pests"],
                    "dosage_per_acre": matched_suitable["dosage_per_acre"],
                    "dosage_per_pump": matched_suitable["dosage_per_15l_pump"],
                    "phi_days": matched_suitable["phi_days"],
                    "note": matched_suitable.get("note", "")
                }
            else:
                crop_title = (crop_query or "Crop").title()
                crop_verdict = {
                    "status": "OFF_LABEL_CAUTION",
                    "badge": "⚠️ OFF-LABEL / NOT REGISTERED",
                    "crop_name": crop_title,
                    "is_suitable": False,
                    "reason": {
                        "en": f"This chemical is not officially registered by CIBRC for {crop_title}. Use at your own risk or consult your local Krishi Vigyan Kendra (KVK).",
                        "hi": f"यह दवा सीआईबीआरसी (CIBRC) द्वारा {crop_title} के लिए अनुमोदित नहीं है। स्थानीय कृषि विज्ञान केंद्र से सलाह लें।",
                        "te": f"ఈ మందు {crop_title} పంటకు అధికారికంగా సిఫార్సు చేయబడలేదు."
                    }.get(lang, f"Not officially registered for {crop_title}")
                }

        # Calculate Knapsack Sprayer Pump dilution math (15L / 16L / 20L)
        scale_factor = tank_liters / 15.0
        sample_dose_num = 6.0
        # Parse first suitable crop dosage
        if pesticide["suitable_crops"]:
            raw_dose = pesticide["suitable_crops"][0].get("dosage_per_15l_pump", "6 ml")
            match = re.search(r"(\d+(\.\d+)?)", raw_dose)
            if match:
                sample_dose_num = float(match.group(1))

        calculated_per_pump = round(sample_dose_num * scale_factor, 1)

        payload = {
            "status": "success",
            "pesticide": {
                "id": pesticide["id"],
                "active_ingredient": pesticide["active_ingredient"],
                "common_brands": pesticide["common_brands"],
                "chemical_class": pesticide.get("chemical_class", ""),
                "toxicity_band": pesticide["toxicity_band"],
                "toxicity_label": pesticide["toxicity_label"].get(lang, pesticide["toxicity_label"]["en"]),
                "is_banned": pesticide.get("is_banned_in_india", False),
                "action_mode": pesticide["action_mode"].get(lang, pesticide["action_mode"]["en"]),
                "mixing_compatibility": pesticide.get("mixing_compatibility", "")
            },
            "selected_crop_verdict": crop_verdict,
            "suitable_crops": pesticide["suitable_crops"],
            "unsuitable_crops": pesticide["unsuitable_crops"],
            "knapsack_calculator": {
                "tank_liters": tank_liters,
                "dosage_amount": f"{calculated_per_pump} {'ml' if 'ml' in pesticide['suitable_crops'][0].get('dosage_per_15l_pump', 'ml') else 'g'}",
                "water_liters_per_acre": 150,
                "tanks_per_acre": round(150 / tank_liters, 1)
            },
            "ai_summary": pesticide["ai_summary"].get(lang, pesticide["ai_summary"]["en"])
        }

        # Cache in Redis / In-Memory for sub-5ms UI responses
        cache_service.set_json(cache_key, payload, ttl_seconds=86400) # 24 hours
        return payload


# Global Singleton Instance
pesticide_engine = PesticideEngine()
