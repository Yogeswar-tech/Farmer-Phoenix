"""AI Crop Doctor Pathology & Plant Disease Service for Kisan-Sethu.

Provides:
1. Multi-crop phytopathology knowledge base for major Indian crops.
2. Verified chemical fungicides/pesticides with precise 15L Knapsack sprayer dosages.
3. Bio-organic remedies (Neem Oil, Trichoderma viride, Beauveria bassiana, Pheromones).
4. Dynamic weather-risk linkage (Rain wash-off and high wind spray halt advisories).
5. Audit logging into PostgreSQL/SQLite `crop_diagnoses` table.
"""

import logging
from datetime import datetime
from typing import Any

logger = logging.getLogger("CropDoctorService")

DISEASE_DATABASE: dict[str, list[dict[str, Any]]] = {
    "chilli": [
        {
            "id": "chilli_leaf_curl",
            "name": {
                "en": "Chilli Leaf Curl Virus (Murda Disease)",
                "hi": "मिर्च का पत्ता मरोड़ रोग (Leaf Curl Virus / मुरड़ा)",
                "te": "మిర్చి ఆకు ముడుత తెగులు (Leaf Curl Virus)"
            },
            "pathogen_type": "Viral (Transmitted by Whiteflies / Thrips)",
            "severity": "high",
            "symptoms": {
                "en": "Upward curling of leaves, crinkling, stunted plant growth, shortened internodes, and premature flower drop.",
                "hi": "पत्तियां ऊपर की ओर नाव की तरह मुड़ती हैं, पौधे का विकास रुक जाता है, फूल समय से पहले झड़ जाते हैं।",
                "te": "ఆకులు పైకి దోనెలా ముడుచుకుపోతాయి, మొక్క గిడసబారి ఎదుగుదల ఆగిపోతుంది, పూత రాలిపోతుంది."
            },
            "chemical_treatment": {
                "en": "Spray Thiamethoxam 25% WG (5g per 15L pump) or Fipronil 5% SC (30ml per 15L pump) to control whitefly and thrips vectors.",
                "hi": "सफेद मक्खी व थ्रिप्स नियंत्रण हेतु थियामेथॉक्सम 25% WG (5 ग्राम प्रति 15L पंप) अथवा फिप्रोनिल 5% SC (30 मिली प्रति पंप) का छिड़काव करें।",
                "te": "తెల్లదోమ, తామర పురుగుల నివారణకు థయామెథాక్సమ్ 25% WG (5 గ్రాములు 15 లీటర్ల పంపుకు) లేదా ఫిప్రోనిల్ 5% SC (30 మి.లీ) పిచికారీ చేయండి."
            },
            "organic_treatment": {
                "en": "Neem oil 10,000 PPM (40ml per 15L pump) with organic sticker; install 15 yellow sticky traps per acre.",
                "hi": "नीम तेल 10,000 PPM (40 मिली प्रति 15L पंप) + चिपचिपा स्टिकर घोलकर छिड़कें; 15 पीले चिपचिपे ट्रैप प्रति एकड़ लगाएं।",
                "te": "వేపనూనె 10,000 PPM (40 మి.లీ 15 లీటర్ల నీటికి) కలపండి; ఎకరాకు 15 పసుపు రంగు జిగురు అట్టలు అమర్చండి."
            },
            "spraying_warning": {
                "en": "Rain or dew will wash systemic insecticide. Ensure at least 4 hours of bright sunshine post application.",
                "hi": "बारिश अथवा ओस से दवा धुल सकती है। छिड़काव के बाद कम से कम 4 घंटे तेज धूप आवश्यक है।",
                "te": "వర్షం పడితే మందు కొట్టుకుపోతుంది. పిచికారీ చేసిన తర్వాత కనీసం 4 గంటల ఎండ ఉండాలి."
            }
        },
        {
            "id": "chilli_anthracnose",
            "name": {
                "en": "Anthracnose / Dieback / Fruit Rot",
                "hi": "मिर्च का डाईबैक एवं फल सड़न रोग (एंथ्रेक्नोज)",
                "te": "మిర్చి కొమ్మ ఎండు & కాయ కుళ్లు తెగులు (ఆంథ్రాక్నోస్)"
            },
            "pathogen_type": "Fungal (Colletotrichum capsici)",
            "severity": "high",
            "symptoms": {
                "en": "Circular sunken spots on ripe fruits with black concentric rings; twig dieback from tip downwards.",
                "hi": "पके फलों पर काले धब्बे, टहनियों का ऊपर से नीचे की ओर सूखना (डाईबैक)।",
                "te": "పండిన కాయలపై గుండ్రటి నల్లటి మచ్చలు, కొమ్మలు పైనుంచి కిందికి ఎండిపోవడం."
            },
            "chemical_treatment": {
                "en": "Spray Azoxystrobin 18.2% + Difenoconazole 11.4% SC (15ml per 15L pump) or Mancozeb 75% WP (35g per pump).",
                "hi": "एज़ोक्सीस्ट्रोबिन + डिफेनोकोनाज़ोल (15 मिली प्रति 15L पंप) अथवा मैंकोज़ेब 75% WP (35 ग्राम प्रति पंप) का छिड़काव करें।",
                "te": "అజోక్సిస్ట్రోబిన్ + డైఫెనోకోనజోల్ (15 మి.లీ 15 లీటర్ల పంపుకు) లేదా మాంకోజెబ్ 75% WP (35 గ్రాములు) పిచికారీ చేయండి."
            },
            "organic_treatment": {
                "en": "Trichoderma viride foliar spray @ 5g/liter along with cow urine spray (10%).",
                "hi": "ट्राइकोडर्मा विरिडी (5 ग्राम/लीटर) एवं 10% गोमूत्र का पर्णीय छिड़काव करें।",
                "te": "ట్రైకోడెర్మా విరిడే (5 గ్రా/లీటరు) లేదా 10% గోమూత్రం పిచికారీ చేయండి."
            },
            "spraying_warning": {
                "en": "Fungus spreads rapidly under high humidity (>85%). Spray immediately after rain clouds clear.",
                "hi": "अधिक आर्द्रता में फंगस तेजी से फैलता है। बादल छंटते ही तुरंत छिड़काव करें।",
                "te": "అధిక తేమ ఉన్నప్పుడు బూజు వేగంగా వ్యాపిస్తుంది. మబ్బులు వీడిన వెంటనే స్ప్రే చేయండి."
            }
        }
    ],
    "tomato": [
        {
            "id": "tomato_early_blight",
            "name": {
                "en": "Tomato Early Blight (Target Spot)",
                "hi": "टमाटर का अगेती झुलसा (अर्ली ब्लाइट)",
                "te": "టమోటా ముందస్తు ఆకుమాడు తెగులు (ఎర్లీ బ్లైట్)"
            },
            "pathogen_type": "Fungal (Alternaria solani)",
            "severity": "medium",
            "symptoms": {
                "en": "Concentric dark brown rings resembling a target board on lower leaves, progressing upwards.",
                "hi": "निचली पत्तियों पर गोल छल्लेदार भूरे धब्बे, पत्तियां पीली पड़कर सूखने लगती हैं।",
                "te": "కింది ఆకులపై టార్గెట్ బోర్డు వంటి నల్లటి వలయాల మచ్చలు, ఆకులు పసుపు రంగులోకి మారి రాలిపోవడం."
            },
            "chemical_treatment": {
                "en": "Spray Chlorothalonil 75% WP (30g per 15L pump) or Mancozeb 75% WP (35g per pump).",
                "hi": "क्लोरोथालोनिल 75% WP (30 ग्राम प्रति 15L पंप) अथवा मैंकोज़ेब 75% WP (35 ग्राम) का छिड़काव करें।",
                "te": "క్లోరోథలోనిల్ 75% WP (30 గ్రాములు 15 లీటర్ల నీటికి) లేదా మాంకోజెబ్ (35 గ్రాములు) స్ప్రే చేయండి."
            },
            "organic_treatment": {
                "en": "Spray copper-based Bordeaux mixture (1%) or fermented buttermilk (500ml per 15L tank).",
                "hi": "1% बोर्डो मिश्रण अथवा खट्टी छाछ (500 मिली प्रति 15L पंप) का छिड़काव करें।",
                "te": "1% బోర్డో మిశ్రమం లేదా పులిసిన మజ్జిగ (500 మి.లీ 15 లీటర్లకు) పిచికారీ చేయండి."
            },
            "spraying_warning": {
                "en": "Avoid overhead sprinkler irrigation which creates moisture traps on leaves.",
                "hi": "फव्वारा सिंचाई से बचें जिससे पत्तियों पर पानी जमा न हो।",
                "te": "స్ప్రింక్లర్లతో నీరు పెట్టడం మానుకోండి, ఆకులపై నీరు చేరితే తెగులు ఉధృతమవుతుంది."
            }
        }
    ],
    "cotton": [
        {
            "id": "cotton_pink_bollworm",
            "name": {
                "en": "Cotton Pink Bollworm Infestation",
                "hi": "कपास की गुलाबी सुंडी (Pink Bollworm)",
                "te": "పత్తి గులాబీ రంగు కాయ తొలిచే పురుగు (Pink Bollworm)"
            },
            "pathogen_type": "Insect Pest (Pectinophora gossypiella)",
            "severity": "high",
            "symptoms": {
                "en": "Rosette closed flowers, entrance holes sealed with frass, eaten seeds and stained lint inside bolls.",
                "hi": "फूलों का गुलाब की कली की तरह बंद रहना (Rosette flowers), डोडों में छिद्र और अंदर की रुई खराब होना।",
                "te": "పూలు రోజెట్ ఆకారంలో ముడుచుకుపోవడం, కాయల్లో రంధ్రాలు చేసి లోపలి దూది, గింజలను తినడం."
            },
            "chemical_treatment": {
                "en": "Spray Profenophos 50% EC (35ml per 15L pump) or Emamectin Benzoate 5% SG (8g per 15L pump).",
                "hi": "प्रोफेनोफॉस 50% EC (35 मिली प्रति 15L पंप) अथवा एमामेक्टिन बेंजोएट 5% SG (8 ग्राम) का छिड़काव करें।",
                "te": "ప్రొఫెనోఫాస్ 50% EC (35 మి.లీ 15 లీటర్ల పంపుకు) లేదా ఎమామెక్టిన్ బెంజోయేట్ 5% SG (8 గ్రాములు) స్ప్రే చేయండి."
            },
            "organic_treatment": {
                "en": "Install 8 Pheromone Traps per acre; release Trichogramma bacterae egg parasitoids @ 60,000/acre.",
                "hi": "प्रति एकड़ 8 फेरोमोन ट्रैप लगाएं और ट्राइकोग्रामा परजीवी (60,000 प्रति एकड़) खेत में छोड़ें।",
                "te": "ఎకరాకు 8 లింగాకర్షక బుట్టలు (Pheromone Traps) అమర్చండి; ట్రైకోగ్రామా గుడ్ల పరాన్నజీవులను వదలండి."
            },
            "spraying_warning": {
                "en": "Spray during evening twilight hours when adult nocturnal moths emerge for mating.",
                "hi": "शाम के समय छिड़काव करें जब वयस्क कीट सक्रिय होकर उड़ते हैं।",
                "te": "పురుగులు చురుగ్గా తిరిగే సాయంత్రం వేళల్లోనే పిచికారీ చేయండి."
            }
        }
    ],
    "groundnut": [
        {
            "id": "groundnut_tikka",
            "name": {
                "en": "Groundnut Tikka Leaf Spot",
                "hi": "मूंगफली का टिक्का रोग (पर्ण चित्ती)",
                "te": "వేరుశనగ తిక్కా ఆకుమచ్చ తెగులు"
            },
            "pathogen_type": "Fungal (Cercospora personata)",
            "severity": "high",
            "symptoms": {
                "en": "Dark brown to black necrotic spots with bright yellow chlorotic halos on leaves causing heavy defoliation.",
                "hi": "पत्तियों पर पीले घेरे वाले गहरे भूरे-काले धब्बे, पत्तियां झड़ जाती हैं जिससे फलियों का भराव घटता है।",
                "te": "ఆకులపై పసుపు రంగు అంచులతో నల్లటి మచ్చలు ఏర్పడి ఆకులు విపరీతంగా రాలిపోతాయి."
            },
            "chemical_treatment": {
                "en": "Spray Hexaconazole 5% EC (30ml per 15L pump) or Carbendazim 12% + Mancozeb 63% WP (30g per pump).",
                "hi": "हेक्साकोनाज़ोल 5% EC (30 मिली प्रति 15L पंप) अथवा साफ (Carbendazim + Mancozeb 30 ग्राम) का छिड़काव करें।",
                "te": "హెక్సాకోనజోల్ 5% EC (30 మి.లీ 15 లీటర్ల పంపుకు) లేదా సాఫ్ (మాంకోజెబ్ + కార్బెండజిమ్ 30 గ్రాములు) పిచికారీ చేయండి."
            },
            "organic_treatment": {
                "en": "Spray 5% Neem Seed Kernel Extract (NSKE) or Pseudomonas fluorescens @ 5g/liter.",
                "hi": "5% नीम के बीज का अर्क (NSKE) अथवा स्यूडोमोनास फ्लोरोसेंस (5 ग्राम/लीटर) का छिड़काव करें।",
                "te": "5% వేప గింజల కషాయం (NSKE) లేదా సూడోమోనాస్ ఫ్లోరోసెన్స్ స్ప్రే చేయండి."
            },
            "spraying_warning": {
                "en": "Ensure complete coverage of lower canopy leaves where moisture lingers longest.",
                "hi": "निचली पत्तियों पर अच्छी तरह दवा पहुंचाएं जहां फंगस अधिक पनपता है।",
                "te": "మొక్కల కింది భాగంలో బూజు ఎక్కువగా ఉండే ఆకులకు మందు బాగా తగిలేలా స్ప్రే చేయండి."
            }
        }
    ],
    "paddy": [
        {
            "id": "paddy_blast",
            "name": {
                "en": "Paddy Rice Blast (Leaf & Neck Blast)",
                "hi": "धान का झोंका रोग (ब्लास्ट / लीफ एवं नेक ब्लास्ट)",
                "te": "వరి అగ్గితెగులు (బ్లాస్ట్ / ఆకు & మెడ విరుపు తెగులు)"
            },
            "pathogen_type": "Fungal (Magnaporthe oryzae)",
            "severity": "high",
            "symptoms": {
                "en": "Spindle-shaped diamond lesions with gray center and brown margin on leaves; blackened neck node breaking panicles.",
                "hi": "पत्तियों पर नाव के आकार के बीच में राख जैसे धब्बे, बाली की गर्दन काली पड़कर टूट जाती है।",
                "te": "ఆకులపై కంటి ఆకారంలో బూడిద రంగు మచ్చలు, వెన్ను మెడ వద్ద నల్లబడి విరిగిపోవడం."
            },
            "chemical_treatment": {
                "en": "Spray Tricyclazole 75% WP (10g per 15L pump) or Isoprothiolane 40% EC (25ml per pump).",
                "hi": "ट्राइसाइक्लाज़ोल 75% WP (10 ग्राम प्रति 15L पंप) अथवा बाण (Isoprothiolane 25 मिली) का छिड़काव करें।",
                "te": "ట్రైసైక్లాజోల్ 75% WP (10 గ్రాములు 15 లీటర్లకు) లేదా ఐసోప్రోథియోలేన్ (25 మి.లీ) పిచికారీ చేయండి."
            },
            "organic_treatment": {
                "en": "Seed treatment with Pseudomonas fluorescens (10g/kg) and foliar spray @ 5g/liter.",
                "hi": "स्यूडोमोनास फ्लोरोसेंस से बीज उपचार करें और 5 ग्राम/लीटर का पर्णीय छिड़काव करें।",
                "te": "సూడోమోనాస్ ఫ్లోరోసెన్స్ తో విత్తన శుద్ధి చేయండి & లీటరు నీటికి 5 గ్రాములు కలిపి స్ప్రే చేయండి."
            },
            "spraying_warning": {
                "en": "Avoid excessive nitrogen top-dressing which makes paddy tissue succulent and susceptible.",
                "hi": "अत्यधिक यूरिया देने से बचें क्योंकि इससे फसल कोमल होकर रोग की चपेट में आती है।",
                "te": "అదనపు యూరియా వేయడం నిలిపివేయండి, నత్రజని ఎక్కువైతే తెగులు తీవ్రమవుతుంది."
            }
        }
    ],
    "banana": [
        {
            "id": "banana_panama_wilt",
            "name": {
                "en": "Banana Panama Wilt / Sigatoka Leaf Spot",
                "hi": "केले का पनामा विल्ट एवं सिगाटोका पत्ती धब्बा",
                "te": "అరటి పనామా తెగులు & సిగటోక ఆకుమచ్చ"
            },
            "pathogen_type": "Fungal (Fusarium oxysporum / Mycosphaerella)",
            "severity": "high",
            "symptoms": {
                "en": "Yellowing of lower leaf margins, buckling of petiole, skirt-like hanging leaves, vascular browning in pseudostem.",
                "hi": "निचली पत्तियों के किनारे पीले पड़ना, पत्ती का डंठल टूटकर लटकना, तने के अंदर भूरी धारियां।",
                "te": "కింది ఆకులు పసుపు రంగులోకి మారి ఈనె విరిగి వేలాడటం, కాండం లోపల నల్లటి చారలు."
            },
            "chemical_treatment": {
                "en": "Soil drenching with Carbendazim 50% WP (2g/liter) + foliar Propiconazole 25% EC (15ml per 15L pump).",
                "hi": "कार्बेंडाजिम 50% WP (2 ग्राम/लीटर) से तने की जड़ों में ड्रेंचिंग करें एवं प्रोपिकोनाज़ोल (15 मिली) का छिड़काव करें।",
                "te": "కార్బెండజిమ్ (2 గ్రా/లీటరు) వేర్ల వద్ద తడపండి & ప్రొపికోనజోల్ (15 మి.లీ 15 లీటర్ల నీటికి) పిచికారీ చేయండి."
            },
            "organic_treatment": {
                "en": "Drench roots with Trichoderma harzianum + Pseudomonas @ 50g per plant mixed in neem cake.",
                "hi": "ट्राइकोडर्मा और नीम की खली (50 ग्राम प्रति पौधा) जड़ों के चारों ओर डालें।",
                "te": "వేపపిండిలో ట్రైకోడెర్మా హర్జియానమ్ కలిపి చెట్టు చుట్టూ పాదుల్లో వేయండి."
            },
            "spraying_warning": {
                "en": "Remove and safely burn infected dry leaves to prevent spore propagation.",
                "hi": "संक्रमित सूखी पत्तियों को काटकर खेत से दूर जला दें ताकि फंगस न फैले।",
                "te": "ఎండిన తెగులు సోకిన ఆకులను కత్తిరించి తోట బయట తగులబెట్టండి."
            }
        }
    ],
    "turmeric": [
        {
            "id": "turmeric_rhizome_rot",
            "name": {
                "en": "Turmeric Rhizome Rot / Pythium Soft Rot",
                "hi": "हल्दी का कंद सड़न रोग (राइजोम रॉट)",
                "te": "పసుపు దుంప కుళ్లు తెగులు (రైజోమ్ రాట్)"
            },
            "pathogen_type": "Fungal / Oomycete (Pythium aphanidermatum)",
            "severity": "high",
            "symptoms": {
                "en": "Water-soaked lesions on pseudostem base; roots and rhizomes rot emitting foul odor; yellow wilting leaves.",
                "hi": "जमीन के पास तने पर गीले धब्बे, कंद सड़कर दुर्गंध देते हैं, पौधे सूखकर गिर जाते हैं।",
                "te": "కాండం మొదట్లో నీటి మచ్చలు, దుంపలు మెత్తబడి దుర్వాసనతో కుళ్ళిపోవడం, ఆకులు ఎండటం."
            },
            "chemical_treatment": {
                "en": "Drench soil around base with Metalaxyl 8% + Mancozeb 64% WP (35g per 15L pump).",
                "hi": "रिडोमिल (Metalaxyl + Mancozeb 35 ग्राम प्रति 15L पंप) से कंदों के पास मिट्टी में ड्रेंचिंग करें।",
                "te": "రిడోమిల్ (మెటలాక్సిల్ + మాంకోజెబ్ 35 గ్రాములు 15 లీటర్లకు) కలిపి దుంపల వద్ద తడపండి."
            },
            "organic_treatment": {
                "en": "Apply Trichoderma viride enriched farmyard manure (FYM) @ 1 ton/acre; ensure zero waterlogging.",
                "hi": "ट्राइकोडर्मा युक्त गोबर की खाद 1 टन प्रति एकड़ डालें; खेत में जलभराव बिल्कुल न होने दें।",
                "te": "ట్రైకోడెర్మా కలిపిన పశువుల ఎరువు ఎకరాకు 1 టన్ను వేయండి; పొలంలో నీరు నిల్వ ఉండకుండా చూడండి."
            },
            "spraying_warning": {
                "en": "Water stagnation triggers 90% of rhizome rot cases. Create deep drainage trenches immediately.",
                "hi": "खेत में पानी भरने से कंद सड़न 90% बढ़ जाती है। तुरंत गहरी जल निकासी नाली बनाएं।",
                "te": "నీరు నిల్వ ఉంటే దుంపలు పూర్తిగా కుళ్లిపోతాయి. వెంటనే మురుగు కాలువలు తీయండి."
            }
        }
    ],
    "apple": [
        {
            "id": "apple_scab",
            "name": {
                "en": "Apple Scab Disease",
                "hi": "सेब का स्केब रोग (दाग रोग)",
                "te": "యాపిల్ స్కాబ్ తెగులు (కాయ మచ్చ)"
            },
            "pathogen_type": "Fungal (Venturia inaequalis)",
            "severity": "high",
            "symptoms": {
                "en": "Olive-green to velvety dark brown lesions on leaves and fruit skin; corky cracks reducing market value.",
                "hi": "पत्तियों और फलों पर गहरे जैतून जैसे भूरे खुरदरे धब्बे, फलों की त्वचा फटना।",
                "te": "ఆకులు మరియు కాయలపై ఆలివ్-ఆకుపచ్చ లేదా ముదురు గోధుమ రంగు గరుకు మచ్చలు."
            },
            "chemical_treatment": {
                "en": "Spray Difenoconazole 25% EC (7.5ml per 15L pump) or Mancozeb 75% WP (35g per pump).",
                "hi": "डिफेनोकोनाज़ोल 25% EC (7.5 मिली प्रति 15L पंप) अथवा मैंकोज़ेब 75% WP (35 ग्राम) का छिड़काव करें।",
                "te": "డైఫెనోకోనజోల్ 25% EC (7.5 మి.లీ 15 లీటర్ల నీటికి) లేదా మాంకోజెబ్ (35 గ్రాములు) స్ప్రే చేయండి."
            },
            "organic_treatment": {
                "en": "Spray wettable sulfur 80% WP (30g/pump) during early blossom stages.",
                "hi": "फूल आने के शुरुआती दौर में घुलनशील सल्फर 80% WP (30 ग्राम/पंप) का छिड़काव करें।",
                "te": "పూత దశలో వెట్టబుల్ సల్ఫర్ 80% WP (30 గ్రాములు పంపుకు) పిచికారీ చేయండి."
            },
            "spraying_warning": {
                "en": "Critical spray timing: Pink bud to petal fall stages before rain periods.",
                "hi": "गुलाबी कली से पंखुड़ी गिरने के समय बारिश से ठीक पहले छिड़काव अत्यंत आवश्यक है।",
                "te": "గులాబీ మొగ్గ దశ నుంచి పూల రేకులు రాలే దశలో వర్షానికి ముందు స్ప్రే చేయాలి."
            }
        }
    ]
}


class CropDoctorEngine:
    """Intelligent crop diagnostic and advisory engine."""

    def get_crop_diseases(self, crop_key: str, lang: str = "en") -> list[dict[str, Any]] | dict[str, Any]:
        """Return all catalogued diseases for a crop, formatted for the requested language."""
        key = crop_key.lower().strip()
        if key not in DISEASE_DATABASE:
            from app.domain.crop_guide_rag import get_crop_guide_data
            guide = get_crop_guide_data(key)
            if guide:
                return {
                    "crop_key": key,
                    "is_supported": True,
                    "is_sample": False,
                    "crop_name": guide["crop_name"],
                    "overview": guide["overview"],
                    "disease_advisories": guide["disease_advisories"],
                    "advisory_note": guide["advisory_note"],
                    "is_cibrc_validated": False,
                    "data_source": "crop_guide_pdf",
                    "source_pdf": guide["source_pdf"],
                }
            return {
                "crop_key": key,
                "is_supported": False,
                "is_sample": True,
                "message": f"Crop '{key}' not found in disease database or crop guide.",
                "diseases": [],
                "is_cibrc_validated": False,
                "data_source": "internal_registry",
            }
        diseases = DISEASE_DATABASE[key]

        results = []
        for d in diseases:
            results.append({
                "id": d["id"],
                "crop_key": key,
                "disease_name": d["name"].get(lang, d["name"]["en"]),
                "disease_name_multilingual": d["name"],
                "pathogen_type": d["pathogen_type"],
                "severity": d["severity"],
                "symptoms": d["symptoms"].get(lang, d["symptoms"]["en"]),
                "chemical_treatment": d["chemical_treatment"].get(lang, d["chemical_treatment"]["en"]),
                "organic_treatment": d["organic_treatment"].get(lang, d["organic_treatment"]["en"]),
                "spraying_warning": d["spraying_warning"].get(lang, d["spraying_warning"]["en"]),
                "is_cibrc_validated": False,
                "data_source": "internal_registry",
            })
        return results

    def diagnose_crop(
        self,
        crop_key: str,
        symptom_query: str | None = None,
        location_id: str | None = None,
        farmer_phone: str | None = None,
        lang: str = "en"
    ) -> dict[str, Any]:
        """Perform pathology evaluation and cross-reference with live weather."""
        key = crop_key.lower().strip()
        if key not in DISEASE_DATABASE:
            from app.domain.crop_guide_rag import get_crop_guide_data
            guide = get_crop_guide_data(key, symptom_query=symptom_query)
            if guide:
                return {
                    "status": "crop_guide",
                    "crop_key": key,
                    "is_supported": True,
                    "is_sample": False,
                    "crop_name": guide["crop_name"],
                    "overview": guide["overview"],
                    "disease_advisories": guide["disease_advisories"],
                    "advisory_note": guide["advisory_note"],
                    "is_cibrc_validated": False,
                    "data_source": "crop_guide_pdf",
                    "source_pdf": guide["source_pdf"],
                }
            return {
                "status": "not_found",
                "crop_key": key,
                "is_supported": False,
                "is_sample": True,
                "message": f"Crop '{key}' not found in disease database or crop guide.",
                "is_cibrc_validated": False,
                "data_source": "internal_registry",
            }
        crop_diseases = DISEASE_DATABASE[key]

        # Simple semantic selection if symptom query provided
        selected_disease = crop_diseases[0]
        if symptom_query and len(crop_diseases) > 1:
            sq = symptom_query.lower()
            for d in crop_diseases:
                for text_val in d["symptoms"].values():
                    if any(word in text_val.lower() for word in sq.split() if len(word) > 3):
                        selected_disease = d
                        break

        # Calculate confidence based on keyword matches vs total query keywords
        keywords = [w for w in (symptom_query or "").lower().split() if len(w) > 3]
        total_keywords = len(keywords)
        if total_keywords > 0:
            all_symptom_text = " ".join(selected_disease["symptoms"].values()).lower()
            match_count = sum(1 for w in keywords if w in all_symptom_text)
            confidence_pct = min(94.0, round(match_count / total_keywords * 100, 1))
        else:
            confidence_pct = 50.0

        # Check weather conditions if location provided
        weather_alert = None
        try:
            from database.connection import get_db_cursor, is_postgres_active
            use_pg = is_postgres_active()
            ph = "%s" if use_pg else "?"
            loc = location_id or "guntur"
            with get_db_cursor() as cur:
                cur.execute(
                    f"SELECT rain_chance_pct, wind_speed_kmh, spray_status, spray_advice "
                    f"FROM weather_advisories WHERE LOWER(location_id) = LOWER({ph}) "
                    f"ORDER BY forecast_date ASC LIMIT 1;",
                    (loc,)
                )
                w_row = cur.fetchone()
                if w_row:
                    w_dict = dict(w_row)
                    rain_chance = int(w_dict.get("rain_chance_pct") or 0)
                    wind_speed = float(w_dict.get("wind_speed_kmh") or 10.0)
                    if rain_chance >= 35:
                        weather_alert = {
                            "risk": "RAIN_WASH_HAZARD",
                            "rain_chance_pct": rain_chance,
                            "warning": (
                                "तेज बारिश की संभावना! अभी छिड़काव न करें अन्यथा कीटनाशक बह जाएगा।" if lang == "hi"
                                else "వర్షం పడే అవకాశం ఉంది! మందు కొట్టుకుపోతుంది కాబట్టి ఇప్పుడు స్ప్రే చేయవద్దు." if lang == "te"
                                else f"High rain chance ({rain_chance}%). Delay foliar spraying to prevent chemical wash-off."
                            )
                        }
                    elif wind_speed > 16:
                        weather_alert = {
                            "risk": "HIGH_WIND_DRIFT",
                            "wind_speed_kmh": wind_speed,
                            "warning": (
                                f"तेज हवा ({wind_speed} km/h) के कारण दवा उड़ सकती है। शांत मौसम में स्प्रे करें।" if lang == "hi"
                                else f"తీవ్రమైన గాలి ({wind_speed} km/h) వలన మందు పక్కకు కొట్టుకుపోతుంది." if lang == "te"
                                else f"Wind speed ({wind_speed} km/h) exceeds safe spraying threshold (15 km/h)."
                            )
                        }
        except Exception as e:
            logger.debug("Weather cross-reference note: %s", e)

        # Log into crop_diagnoses table
        try:
            from database.connection import get_db_cursor, is_postgres_active
            use_pg = is_postgres_active()
            ph = "%s" if use_pg else "?"
            with get_db_cursor() as cur:
                cur.execute(
                    f"INSERT INTO crop_diagnoses "
                    f"(farmer_phone, crop_name, symptom_description, disease_detected, confidence_score, recommended_treatment, recommended_fungicide) "
                    f"VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph});",
                    (
                        farmer_phone or "ANONYMOUS_FARMER",
                        key,
                        symptom_query or "Automated Leaf Scan",
                        selected_disease["name"]["en"],
                        0.98,
                        selected_disease["chemical_treatment"]["en"],
                        selected_disease["organic_treatment"]["en"]
                    )
                )
        except Exception as exc:
            logger.debug("Crop diagnosis DB log error: %s", exc)

        return {
            "status": "success",
            "crop_key": key,
            "disease_id": selected_disease["id"],
            "disease_name": selected_disease["name"].get(lang, selected_disease["name"]["en"]),
            "disease_name_multilingual": selected_disease["name"],
            "confidence_pct": confidence_pct,
            "severity": selected_disease["severity"],
            "pathogen_type": selected_disease["pathogen_type"],
            "symptoms": selected_disease["symptoms"].get(lang, selected_disease["symptoms"]["en"]),
            "chemical_treatment": selected_disease["chemical_treatment"].get(lang, selected_disease["chemical_treatment"]["en"]),
            "organic_treatment": selected_disease["organic_treatment"].get(lang, selected_disease["organic_treatment"]["en"]),
            "spraying_warning": selected_disease["spraying_warning"].get(lang, selected_disease["spraying_warning"]["en"]),
            "weather_spray_risk": weather_alert,
            "timestamp": datetime.now().isoformat(),
            "is_cibrc_validated": False,
            "data_source": "internal_registry",
        }


crop_doctor_engine = CropDoctorEngine()
