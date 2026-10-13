import { useState, type FC } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet
} from 'react-native';
import type { Language, LocationOption } from '../types';
import { translations } from '../data/i18n';
import { CROP_CHIPS, calculateLocationDistanceKm } from '../data/mockData';
import {
  TrendingUp,
  Droplets,
  Truck,
  ShieldCheck,
  Award,
  Info,
  Scale
} from 'lucide-react';

interface EducationalChartsViewProps {
  currentLang: Language;
  currentLocation?: LocationOption;
  onOpenHelpline?: (num: string) => void;
}

interface GradeComparisonRow {
  gradeCode: string;
  gradeName: Record<Language, string>;
  criteria: Record<Language, string>;
  moistureLimit: string;
  pricePerQtl: number;
  payoutOn20Qtl: number;
  deductionRisk: Record<Language, string>;
  badgeColor: string;
}

const GRADE_EDUCATION_DATA: GradeComparisonRow[] = [
  {
    gradeCode: 'GRADE-A',
    gradeName: {
      hi: 'ग्रेड-ए (सुपर एक्सपोर्ट / बोल्ड)',
      te: 'గ్రేడ్-ఎ (సూపర్ ఎగుమతి నాణ్యత)',
      en: 'Grade-A (Super Export Premium)'
    },
    criteria: {
      hi: 'गहरा लाल रंग, बिना दाग, 10–11% आदर्श नमी, बड़ा दाना',
      te: 'గాఢ ఎరుపు, మచ్చలు లేనివి, 10-11% తేమ, పెద్ద కాయలు',
      en: 'Deep bright color, zero blemishes, 10-11% moisture, bold uniform size'
    },
    moistureLimit: '10% – 11%',
    pricePerQtl: 16500,
    payoutOn20Qtl: 330000,
    deductionRisk: {
      hi: 'शून्य कटौती (0% Deduction, उच्चतम प्रीमियम भाव)',
      te: 'సున్నా కోత (0% Deduction, పూర్తి ప్రీమియం ధర)',
      en: 'Zero deductions (0% deduction, maximum exporter premium)'
    },
    badgeColor: '#1B5E20'
  },
  {
    gradeCode: 'GRADE-B',
    gradeName: {
      hi: 'ग्रेड-बी (मॉडल / मानक मंडी दर)',
      te: 'గ్రేడ్-బి (మోడల్ / సాధారణ మార్కెట్ ధర)',
      en: 'Grade-B (Modal Fair Average Quality)'
    },
    criteria: {
      hi: 'मध्यम आकार, 12–14% नमी, आंशिक रंग भिन्नता, मंडी मानक',
      te: 'మధ్యస్థ పరిమాణం, 12-14% తేమ, సాధారణ మార్కెట్ రకం',
      en: 'Medium size, 12-14% moisture, standard domestic mandi grade'
    },
    moistureLimit: '12% – 14%',
    pricePerQtl: 14200,
    payoutOn20Qtl: 284000,
    deductionRisk: {
      hi: 'सामान्य (₹0 से ₹250/क्विंटल नमी कटौती यदि 14% से अधिक हो)',
      te: 'సాధారణం (14% కంటే ఎక్కువ ఉంటే ₹0-₹250 కోత)',
      en: 'Standard (₹0 to ₹250/qtl moisture cut if moisture exceeds 14%)'
    },
    badgeColor: '#2E7D32'
  },
  {
    gradeCode: 'GRADE-C',
    gradeName: {
      hi: 'ग्रेड-सी (ताला / वर्षा प्रभावित / गीला माल)',
      te: 'గ్రేడ్-సి (తాల / వర్షం తగిలిన / తేమ సరుకు)',
      en: 'Grade-C (Tala / Rain Damaged / High Moisture)'
    },
    criteria: {
      hi: 'कालापन, टूटे दाने, >16% उच्च नमी, फंगस का जोखिम',
      te: 'నలుపు మచ్చలు, విరిగిన కాయలు, >16% అధిక తేమ, బూజు ప్రమాదం',
      en: 'Discoloration, broken pods, >16% high moisture, mold risk'
    },
    moistureLimit: '> 16%',
    pricePerQtl: 9800,
    payoutOn20Qtl: 196000,
    deductionRisk: {
      hi: 'भारी कटौती (₹1,500 से ₹2,500/क्विंटल कटौती अथवा बोली अस्वीकार)',
      te: 'భారీ కోత (₹1,500 - ₹2,500/క్వింటా కోత లేదా తిరస్కరణ)',
      en: 'Heavy penalty (₹1,500 to ₹2,500/qtl docked or auction rejected)'
    },
    badgeColor: '#C62828'
  }
];

interface MandiSpreadRow {
  locationId: string;
  mandiName: Record<Language, string>;
  state: Record<Language, string>;
  modalPrice: number;
  distanceKm: number;
  freightPerQtl: number;
  marketCessAndHamali: number;
  netInHandPerQtl: number;
  verdict: Record<Language, string>;
  isRecommended: boolean;
}

const REGIONAL_MANDI_SPREAD_DATA: MandiSpreadRow[] = [
  {
    locationId: 'guntur',
    mandiName: { hi: 'गुंटूर एपीएमसी यार्ड', te: 'గుంటూరు మార్కెట్ యార్డ్', en: 'Guntur APMC Yard' },
    state: { hi: 'आंध्र प्रदेश', te: 'ఆంధ్రప్రదేశ్', en: 'Andhra Pradesh' },
    modalPrice: 14200,
    distanceKm: 42,
    freightPerQtl: 180,
    marketCessAndHamali: 145,
    netInHandPerQtl: 13875,
    verdict: {
      hi: '⭐ सर्वोत्तम कुल लाभ (शीर्ष निर्यात केंद्र)',
      te: '⭐ అత్యుత్తమ నికర లాభం (ప్రధాన ఎగుమతి కేంద్రం)',
      en: '⭐ Highest Net Realization (Apex Export Terminal)'
    },
    isRecommended: true
  },
  {
    locationId: 'warangal',
    mandiName: { hi: 'वारंगल एनाममुला मंडी', te: 'వరంగల్ ఏనుమాముల మార్కెట్', en: 'Warangal Enamamula Mandi' },
    state: { hi: 'तेलंगाना', te: 'తెలంగాణ', en: 'Telangana' },
    modalPrice: 13950,
    distanceKm: 85,
    freightPerQtl: 290,
    marketCessAndHamali: 140,
    netInHandPerQtl: 13520,
    verdict: {
      hi: 'मध्यम लाभ (स्थानीय तेलंगाना किसानों हेतु उत्तम)',
      te: 'మధ్యస్థ లాభం (తెలంగాణ రైతులకు అనుకూలం)',
      en: 'Moderate Net Profit (Good for Telangana belt)'
    },
    isRecommended: false
  },
  {
    locationId: 'khammam',
    mandiName: { hi: 'खम्मम मंडी यार्ड', te: 'ఖమ్మం మార్కెట్ యార్డ్', en: 'Khammam Mandi Yard' },
    state: { hi: 'तेलंगाना', te: 'తెలంగాణ', en: 'Telangana' },
    modalPrice: 13800,
    distanceKm: 65,
    freightPerQtl: 220,
    marketCessAndHamali: 135,
    netInHandPerQtl: 13445,
    verdict: {
      hi: 'द्रुत नीलामी (पड़ोसी जिलों हेतु सुरक्षित)',
      te: 'వేగవంతమైన అమ్మకం (సమీప జిల్లాలకు సురక్షితం)',
      en: 'Fast Settlement (Safe for border districts)'
    },
    isRecommended: false
  },
  {
    locationId: 'chittoor',
    mandiName: { hi: 'मदनपल्ले यार्ड (टमाटर / बागवानी)', te: 'మదనపల్లె మార్కెట్ యార్డ్', en: 'Madanapalle Yard' },
    state: { hi: 'आंध्र प्रदेश', te: 'ఆంధ్రప్రదేశ్', en: 'Andhra Pradesh' },
    modalPrice: 13400,
    distanceKm: 140,
    freightPerQtl: 480,
    marketCessAndHamali: 150,
    netInHandPerQtl: 12770,
    verdict: {
      hi: '⚠️ अधिक दूरी (लंबी दूरी का भाड़ा लाभ घटाता है)',
      te: '⚠️ ఎక్కువ దూరం (రవాణా ఖర్చు వల్ల లాభం తగ్గుతుంది)',
      en: '⚠️ High Distance Freight (Freight eats net profit margin)'
    },
    isRecommended: false
  },
  {
    locationId: 'kurnool',
    mandiName: { hi: 'कर्नूल एपीएमसी यार्ड', te: 'కర్నూలు మార్కెట్ యార్డ్', en: 'Kurnool APMC Yard' },
    state: { hi: 'आंध्र प्रदेश', te: 'ఆంధ్రప్రదేశ్', en: 'Andhra Pradesh' },
    modalPrice: 13650,
    distanceKm: 78,
    freightPerQtl: 260,
    marketCessAndHamali: 140,
    netInHandPerQtl: 13250,
    verdict: {
      hi: 'संतुलित विकल्प (रायलसीमा क्षेत्र)',
      te: 'సమతుల్య ఎంపిక (రాయలసీమ ప్రాంతం)',
      en: 'Balanced Alternative (Rayalaseema region)'
    },
    isRecommended: false
  }
];

interface LogisticsVehicleRow {
  vehicleType: Record<Language, string>;
  capacityQtl: string;
  costPerKm: number;
  costPerQtlKm: number;
  optimalDistance: string;
  bestFor: Record<Language, string>;
}

const VEHICLE_LOGISTICS_DATA: LogisticsVehicleRow[] = [
  {
    vehicleType: { hi: '3-पहिया ऑटो / पियाजियो', te: '3-వీలర్ ఆటో / పియాజియో', en: '3-Wheeler Cargo Auto' },
    capacityQtl: '10 - 15 क्विंटल',
    costPerKm: 18,
    costPerQtlKm: 1.5,
    optimalDistance: '0 - 25 किमी (लोकल)',
    bestFor: {
      hi: 'छोटे किसान, कम दूरी की स्थानीय मंडी',
      te: 'చిన్న రైతులు, తక్కువ దూరం గల స్థానిక మార్కెట్',
      en: 'Smallholders, local short-haul mandi runs'
    }
  },
  {
    vehicleType: { hi: '1.5-टन छोटा हाथी (टाटा ऐस)', te: '1.5-టన్నుల టాటా ఏస్', en: '1.5-Ton Tata Ace (Pickup)' },
    capacityQtl: '25 - 35 क्विंटल',
    costPerKm: 26,
    costPerQtlKm: 0.86,
    optimalDistance: '25 - 80 किमी',
    bestFor: {
      hi: 'मध्यम किसान, अंतर-जिला प्रमुख यार्ड',
      te: 'మధ్యస్థ రైతులు, జిల్లా స్థాయి ప్రధాన మార్కెట్',
      en: 'Medium lots, inter-district terminal yard'
    }
  },
  {
    vehicleType: { hi: 'ट्रैक्टर ट्रॉली (4-पहिया)', te: 'ట్రాక్టర్ ట్రాలీ', en: 'Tractor Trolley (Farmer Owned)' },
    capacityQtl: '40 - 60 क्विंटल',
    costPerKm: 22,
    costPerQtlKm: 0.44,
    optimalDistance: '15 - 60 किमी',
    bestFor: {
      hi: 'सामूहिक परिवहन, भारी बोरियां, खेत से सीधा यार्ड',
      te: 'రైతుల సొంత రవాణా, పొలం నుండి నేరుగా మార్కెట్‌కు',
      en: 'Farmer-owned transport, farm-gate bulk dispatch'
    }
  },
  {
    vehicleType: { hi: '4-टन 6-पहिया ट्रक (आयशर)', te: '4-టన్నుల ట్రక్ (ఐషర్)', en: '4-Ton 6-Tyre Truck (Eicher)' },
    capacityQtl: '70 - 100 क्विंटल',
    costPerKm: 38,
    costPerQtlKm: 0.42,
    optimalDistance: '80 - 250 किमी',
    bestFor: {
      hi: 'एफपीओ समूह, लंबी दूरी की प्रमुख निर्यात मंडी',
      te: 'రైతు సంఘాలు (FPO), సుదూర ఎగుమతి మార్కెట్',
      en: 'FPO farmer producer groups, distant apex yard'
    }
  }
];

const COMMODITY_SAFE_MOISTURE = [
  { cropKey: 'chilli', name: { hi: 'मिर्च', te: 'మిర్చి', en: 'Dry Red Chilli' }, safePct: '10% - 11%', riskPct: '> 14%', lossPenalty: '₹450 - ₹900/qtl', storageSafeMonths: '8 - 12 महीने' },
  { cropKey: 'cotton', name: { hi: 'कपास', te: 'పత్తి', en: 'Cotton (Kapas)' }, safePct: '8% - 9%', riskPct: '> 12%', lossPenalty: '₹350 - ₹700/qtl', storageSafeMonths: '6 - 9 महीने' },
  { cropKey: 'paddy', name: { hi: 'धान', te: 'వరి', en: 'Paddy / Rice' }, safePct: '13% - 14%', riskPct: '> 17%', lossPenalty: '₹200 - ₹400/qtl', storageSafeMonths: '12 महीने' },
  { cropKey: 'groundnut', name: { hi: 'मूंगफली', te: 'వేరుశనగ', en: 'Groundnut Pods' }, safePct: '7% - 8%', riskPct: '> 10%', lossPenalty: '₹400 - ₹800/qtl', storageSafeMonths: '6 महीने' },
  { cropKey: 'maize', name: { hi: 'मक्का', te: 'మొక్కజొన్న', en: 'Maize / Corn' }, safePct: '12% - 13%', riskPct: '> 15%', lossPenalty: '₹250 - ₹500/qtl', storageSafeMonths: '8 महीने' },
  { cropKey: 'turmeric', name: { hi: 'हल्दी', te: 'పసుపు', en: 'Turmeric' }, safePct: '9% - 10%', riskPct: '> 13%', lossPenalty: '₹500 - ₹1,100/qtl', storageSafeMonths: '18 महीने' }
];

export const EducationalChartsView: FC<EducationalChartsViewProps> = ({ currentLang, currentLocation }) => {
  const t = translations[currentLang];
  const [selectedCommodity, setSelectedCommodity] = useState('chilli');
  const [simulatedMoisture, setSimulatedMoisture] = useState(15);

  const baseStandard = 11;
  const excessMoisture = Math.max(0, simulatedMoisture - baseStandard);
  const moistureDeductionRate = excessMoisture * 180;
  const simulatedNetRate = Math.max(7000, 14200 - moistureDeductionRate);

  const moistureOptions = [9, 11, 14, 16, 18, 22];

  // Dynamic Regional Mandi Spread based on user's current location
  const spreadData = REGIONAL_MANDI_SPREAD_DATA.map((item) => {
    if (!currentLocation) return item;
    const dist = calculateLocationDistanceKm(currentLocation.id, item.locationId);
    const isLocal = dist === 0 || currentLocation.id === item.locationId;
    const freight = isLocal ? 0 : Math.round(dist * 2.8);
    const net = item.modalPrice - freight - item.marketCessAndHamali;

    return {
      ...item,
      distanceKm: dist,
      freightPerQtl: freight,
      netInHandPerQtl: net,
      isRecommended: isLocal || dist < 60,
      verdict: isLocal
        ? {
            hi: '📍 आपका स्थानीय यार्ड (शून्य अतिरिक्त भाड़ा, अधिकतम तत्काल नकदी)',
            te: '📍 మీ స్థానిక మార్కెట్ (రవాణా ఖర్చు సున్నా, పూర్తి లాభం)',
            en: '📍 Your Local Yard (Zero freight overhead, maximum net take-home)'
          }
        : item.verdict
    };
  }).sort((a, b) => a.distanceKm - b.distanceKm);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerBox}>
        <View style={styles.badgeRow}>
          <View style={styles.eduTag}>
            <Award size={14} color="#2D5A27" />
            <Text style={styles.eduTagText}>
              {currentLang === 'hi' ? 'व्यापार शिक्षा केंद्र' : currentLang === 'te' ? 'మార్కెట్ శిక్షణా కేంద్రం' : 'Market Education'}
            </Text>
          </View>
          <View style={styles.verifiedTag}>
            <ShieldCheck size={14} color="#1E3F1A" />
            <Text style={styles.verifiedTagText}>
              {currentLang === 'hi' ? 'कृषि विपणन निदेशालय प्रमाणित' : currentLang === 'te' ? 'వ్యవసాయ మార్కెటింగ్ శాఖ ధృవీకరించిన సమాచారం' : 'Agmarknet Standards'}
            </Text>
          </View>
        </View>
        <Text style={styles.mainTitle}>{t.educationalChartsTitle}</Text>
        <Text style={styles.subtitle}>{t.educationalChartsDesc}</Text>
      </View>

      {/* Commodity Selector */}
      <View style={styles.selectorSection}>
        <Text style={styles.selectorLabel}>
          {currentLang === 'hi' ? 'फसल चुनें:' : currentLang === 'te' ? 'పంట ఎంచుకోండి:' : 'Select Commodity:'}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.commodityScroll}>
          {CROP_CHIPS.slice(0, 6).map((c) => (
            <TouchableOpacity
              key={c.key}
              onPress={() => setSelectedCommodity(c.key)}
              style={[styles.commPill, selectedCommodity === c.key && styles.commPillActive]}
              activeOpacity={0.7}
            >
              <Text style={styles.commIcon}>{c.icon}</Text>
              <Text style={[styles.commText, selectedCommodity === c.key && styles.commTextActive]}>
                {c.name[currentLang]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* CHART 1: Quality Grade & Deduction Matrix */}
      <View style={styles.cardBox}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.numberBadge}>
              <Text style={styles.numberBadgeText}>1</Text>
            </View>
            <View style={styles.headingCol}>
              <Text style={styles.cardHeading}>
                {currentLang === 'hi'
                  ? 'गुणवत्ता ग्रेड मूल्य एवं यार्ड कटौती मैट्रिक्स'
                  : currentLang === 'te'
                  ? 'నాణ్యత గ్రేడ్ ధర & మార్కెట్ కోత విశ్లేషణ'
                  : 'Quality Grade Pricing & Mandi Deduction Matrix'}
              </Text>
              <Text style={styles.cardCaption}>
                {currentLang === 'hi'
                  ? 'ग्रेड-ए (एक्सपोर्ट) बनाम ग्रेड-बी (मॉडल) बनाम ग्रेड-सी (ताला)'
                  : currentLang === 'te'
                  ? 'గ్రేడ్-ఎ (ఎగుమతి) vs గ్రేడ్-బి (మోడల్) vs గ్రేడ్-సి (తాల)'
                  : 'Grade A Export vs Grade B Modal vs Grade C Tala'}
              </Text>
            </View>
          </View>
          <View style={styles.spreadTag}>
            <TrendingUp size={14} color="#15803D" />
            <Text style={styles.spreadTagText}>+₹74,000</Text>
          </View>
        </View>

        {/* Grade Cards List */}
        <View style={styles.gradesList}>
          {GRADE_EDUCATION_DATA.map((row) => (
            <View key={row.gradeCode} style={styles.gradeCard}>
              <View style={styles.gradeCardTop}>
                <View style={[styles.gradeBadge, { backgroundColor: row.badgeColor }]}>
                  <Text style={styles.gradeBadgeText}>{row.gradeCode}</Text>
                </View>
                <Text style={styles.gradeTitle}>{row.gradeName[currentLang]}</Text>
                <Text style={styles.gradePrice}>₹{row.pricePerQtl.toLocaleString('en-IN')}/qtl</Text>
              </View>

              <Text style={styles.gradeCriteria}>{row.criteria[currentLang]}</Text>

              <View style={styles.gradeStatsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>
                    {currentLang === 'hi' ? 'आदर्श नमी' : currentLang === 'te' ? 'ఆదర్శ తేమ' : 'Moisture Limit'}
                  </Text>
                  <Text style={styles.statValue}>{row.moistureLimit}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>
                    {currentLang === 'hi' ? '20 क्विंटल भुगतान' : currentLang === 'te' ? '20 క్వింటాళ్ల రాబడి' : '20 Qtl Payout'}
                  </Text>
                  <Text style={[styles.statValue, { color: '#15803D' }]}>
                    ₹{row.payoutOn20Qtl.toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>

              <Text style={styles.riskNotice}>⚠️ {row.deductionRisk[currentLang]}</Text>
            </View>
          ))}
        </View>

        {/* Takeaway Advice Box */}
        <View style={styles.takeawayBox}>
          <Info size={22} color="#15803D" />
          <View style={styles.takeawayCol}>
            <Text style={styles.takeawayTitle}>
              {currentLang === 'hi'
                ? 'किसान व्यापार सीख: तिरपाल पर 2 दिन सुखाने से ₹18,000 की बचत!'
                : currentLang === 'te'
                ? 'రైతు గమనిక: టార్పాలిన్‌పై 2 రోజులు ఆరబెడితే ₹18,000 ఆదా!'
                : 'Farmer Golden Rule: 2 Days Sun-Drying on Tarpaulin Saves ₹18,000 per Trolley!'}
            </Text>
            <Text style={styles.takeawayDesc}>
              {currentLang === 'hi'
                ? 'जब किसान नमी 16% से घटाकर 11% कर लेता है, तो व्यापारी "गीले माल" के नाम पर प्रति क्विंटल ₹600–₹900 की कटौती नहीं कर पाते।'
                : currentLang === 'te'
                ? 'తేమను 16% నుండి 11%కి తగ్గించడం ద్వారా వ్యాపారులు క్వింటాకు ₹600-₹900 కోత విధించలేరు. 20 క్వింటాళ్ల సరుకుపై రైతుకు నేరుగా ₹18,000 అదనపు లాభం చేతికందుతుంది.'
                : 'Reducing moisture down to 11% prevents traders from docking ₹600–₹900/qtl penalty, preserving ₹18,000 on a 20-quintal tractor load.'}
            </Text>
          </View>
        </View>

        {/* Interactive Moisture Selector */}
        <View style={styles.moistureSimBox}>
          <View style={styles.simTop}>
            <View style={styles.simTitleRow}>
              <Droplets size={16} color="#0284C7" />
              <Text style={styles.simTitle}>
                {currentLang === 'hi'
                  ? 'नमी कटौती कैलकुलेटर'
                  : currentLang === 'te'
                  ? 'తేమ కోత కాలిక్యులేటర్'
                  : 'Moisture Deduction Calculator'}
              </Text>
            </View>
            <View style={styles.simMoisturePill}>
              <Text style={styles.simMoisturePillText}>{simulatedMoisture}% Moisture</Text>
            </View>
          </View>

          {/* Quick Moisture Tap Buttons */}
          <View style={styles.moistureButtonsRow}>
            {moistureOptions.map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setSimulatedMoisture(m)}
                style={[styles.mBtn, simulatedMoisture === m && styles.mBtnActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.mBtnText, simulatedMoisture === m && styles.mBtnTextActive]}>
                  {m}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.simResultsGrid}>
            <View style={styles.resCard}>
              <Text style={styles.resLabel}>
                {currentLang === 'hi' ? 'बेस मॉडल भाव' : currentLang === 'te' ? 'మోడల్ ధర' : 'Benchmark Rate'}
              </Text>
              <Text style={styles.resVal}>₹14,200</Text>
            </View>
            <View style={[styles.resCard, styles.resCardDanger]}>
              <Text style={styles.resLabel}>
                {currentLang === 'hi' ? 'व्यापारी कटौती' : currentLang === 'te' ? 'వ్యాపారి కోత' : 'Trader Cut'}
              </Text>
              <Text style={[styles.resVal, { color: '#DC2626' }]}>-₹{moistureDeductionRate}/qtl</Text>
            </View>
            <View style={[styles.resCard, styles.resCardSuccess]}>
              <Text style={styles.resLabel}>
                {currentLang === 'hi' ? 'शुद्ध प्राप्ति' : currentLang === 'te' ? 'చేతికి వచ్చే ధర' : 'Net in Bank'}
              </Text>
              <Text style={[styles.resVal, { color: '#15803D' }]}>
                ₹{simulatedNetRate.toLocaleString('en-IN')}/qtl
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* CHART 2: Regional Mandi Spread Table */}
      <View style={styles.cardBox}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.numberBadge, { backgroundColor: '#0284C7' }]}>
              <Text style={styles.numberBadgeText}>2</Text>
            </View>
            <View style={styles.headingCol}>
              <Text style={styles.cardHeading}>
                {currentLang === 'hi'
                  ? `क्षेत्रीय मंडियों का तुलनात्मक भाव (${currentLocation ? currentLocation.name[currentLang] : 'क्षेत्रीय'})`
                  : currentLang === 'te'
                  ? `ప్రాంతీయ మార్కెట్ల ధరల పోలిక (${currentLocation ? currentLocation.name[currentLang] : 'ప్రాంతీయ'})`
                  : `Regional Mandi Price Spread & Net Bank Realization (${currentLocation ? currentLocation.name[currentLang] : 'Regional'})`}
              </Text>
              <Text style={styles.cardCaption}>
                {currentLocation
                  ? (currentLang === 'hi'
                      ? `${currentLocation.name[currentLang]} से दूरी व भाड़ा काटकर किस मंडी में सबसे अधिक शुद्ध लाभ मिलेगा?`
                      : currentLang === 'te'
                      ? `${currentLocation.name[currentLang]} నుండి రవాణా ఖర్చులు పోను ఏ మార్కెట్లో ఎక్కువ నగదు మిగులుతుంది?`
                      : `Net cash take-home after transport freight from ${currentLocation.name[currentLang]}`)
                  : (currentLang === 'hi'
                      ? 'भाड़ा व हम्माली काटकर किस मंडी से बैंक खाते में सबसे अधिक पैसा आएगा?'
                      : currentLang === 'te'
                      ? 'రవాణా ఖర్చులు పోను ఏ మార్కెట్లో ఎక్కువ నగదు మిగులుతుంది?'
                      : 'Net cash take-home after freight, cess & unloading')}
              </Text>
            </View>
          </View>
          <View style={[styles.spreadTag, { backgroundColor: '#E0F2FE' }]}>
            <Scale size={14} color="#0369A1" />
            <Text style={[styles.spreadTagText, { color: '#0369A1' }]}>
              {currentLocation ? `📍 ${currentLocation.name[currentLang]}` : '5 Mandis'}
            </Text>
          </View>
        </View>

        <View style={styles.mandiList}>
          {spreadData.map((mandi, idx) => (
            <View
              key={idx}
              style={[styles.mandiCard, mandi.isRecommended && styles.mandiCardRecommended]}
            >
              <View style={styles.mandiCardHeader}>
                <View>
                  <Text style={styles.mandiNameText}>{mandi.mandiName[currentLang]}</Text>
                  <Text style={styles.mandiStateSub}>
                    {mandi.state[currentLang]} • {mandi.distanceKm} km
                  </Text>
                </View>
                <View style={styles.netCashCol}>
                  <Text style={styles.netCashLabel}>
                    {currentLang === 'hi' ? 'शुद्ध बैंक प्राप्ति' : currentLang === 'te' ? 'నికర మిగులు' : 'Net Cash'}
                  </Text>
                  <Text style={styles.netCashVal}>₹{mandi.netInHandPerQtl.toLocaleString('en-IN')}/qtl</Text>
                </View>
              </View>

              <View style={styles.mandiMetricsRow}>
                <Text style={styles.mandiMetricText}>Gross: ₹{mandi.modalPrice.toLocaleString('en-IN')}</Text>
                <Text style={styles.mandiMetricText}>Freight: -₹{mandi.freightPerQtl}</Text>
                <Text style={styles.mandiMetricText}>Cess: -₹{mandi.marketCessAndHamali}</Text>
              </View>

              <Text style={[styles.mandiVerdict, mandi.isRecommended && styles.mandiVerdictRec]}>
                {mandi.verdict[currentLang]}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* CHART 3: Vehicle Economics */}
      <View style={styles.cardBox}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.numberBadge, { backgroundColor: '#EA580C' }]}>
              <Text style={styles.numberBadgeText}>3</Text>
            </View>
            <View style={styles.headingCol}>
              <Text style={styles.cardHeading}>
                {currentLang === 'hi'
                  ? 'परिवहन वाहन चयन एवं दूरी ब्रेक-ईवन चार्ट'
                  : currentLang === 'te'
                  ? 'రవాణా వాహన ఎంపిక & దూరపు లాభ విశ్లేషణ'
                  : 'Transport Vehicle Selection & Distance Break-Even'}
              </Text>
              <Text style={styles.cardCaption}>
                {currentLang === 'hi'
                  ? 'ऑटो, छोटा हाथी, ट्रैक्टर या 4-टन ट्रक'
                  : currentLang === 'te'
                  ? 'ఆటో, టాటా ఏస్, ట్రాక్టర్ లేదా ట్రక్'
                  : 'Vehicle Capacity vs Rate Breakdown'}
              </Text>
            </View>
          </View>
          <View style={[styles.spreadTag, { backgroundColor: '#FFEDD5' }]}>
            <Truck size={14} color="#C2410C" />
            <Text style={[styles.spreadTagText, { color: '#C2410C' }]}>Freight ROI</Text>
          </View>
        </View>

        <View style={styles.vehiclesList}>
          {VEHICLE_LOGISTICS_DATA.map((v, i) => (
            <View key={i} style={styles.vehicleCard}>
              <View style={styles.vehicleTop}>
                <Text style={styles.vehicleTitle}>{v.vehicleType[currentLang]}</Text>
                <Text style={styles.vehicleDistBadge}>{v.optimalDistance}</Text>
              </View>
              <View style={styles.vehicleStatsRow}>
                <Text style={styles.vStat}>Capacity: {v.capacityQtl}</Text>
                <Text style={styles.vStat}>Rate: ₹{v.costPerKm}/km</Text>
                <Text style={styles.vStatBold}>Cost: ₹{v.costPerQtlKm}/qtl-km</Text>
              </View>
              <Text style={styles.vehicleBestFor}>{v.bestFor[currentLang]}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* CHART 4: Safe Moisture Standards */}
      <View style={styles.cardBox}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.numberBadge, { backgroundColor: '#7C3AED' }]}>
              <Text style={styles.numberBadgeText}>4</Text>
            </View>
            <View style={styles.headingCol}>
              <Text style={styles.cardHeading}>
                {currentLang === 'hi'
                  ? 'फसल अनुसार सुरक्षित नमी व भंडारण चार्ट'
                  : currentLang === 'te'
                  ? 'పంటల వారీగా సురక్షిత తేమ ప్రమాణాలు & నిల్వ గైడ్'
                  : 'Crop-Wise Safe Moisture & Storage Preservation Guide'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.moistureCardsGrid}>
          {COMMODITY_SAFE_MOISTURE.map((item) => (
            <View key={item.cropKey} style={styles.cropMoistureCard}>
              <View style={styles.cropMTop}>
                <Text style={styles.cropMTitle}>{item.name[currentLang]}</Text>
                <Text style={styles.cropMSafePill}>{item.safePct} Safe</Text>
              </View>
              <Text style={styles.cropMRisk}>Risk: {item.riskPct}</Text>
              <Text style={styles.cropMPenalty}>Yard Cut: {item.lossPenalty}</Text>
              <Text style={styles.cropMLife}>Safe Storage: {item.storageSafeMonths}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 20,
  },
  headerBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  eduTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF7EE',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  eduTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2D5A27',
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  verifiedTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E293B',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  selectorSection: {
    gap: 8,
  },
  selectorLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  commodityScroll: {
    gap: 8,
  },
  commPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  commPillActive: {
    backgroundColor: '#2D5A27',
    borderColor: '#2D5A27',
  },
  commIcon: {
    fontSize: 14,
  },
  commText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  commTextActive: {
    color: '#FFFFFF',
  },
  cardBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  numberBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#2D5A27',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  headingCol: {
    flex: 1,
    gap: 2,
  },
  cardHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  cardCaption: {
    fontSize: 12,
    color: '#64748B',
  },
  spreadTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  spreadTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
  gradesList: {
    gap: 10,
  },
  gradeCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  gradeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  gradeBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  gradeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  gradeTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  gradePrice: {
    fontSize: 14,
    fontWeight: '900',
    color: '#2D5A27',
  },
  gradeCriteria: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
  },
  gradeStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  statBox: {
    gap: 2,
  },
  statLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  statValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
  },
  riskNotice: {
    fontSize: 11,
    color: '#B45309',
    fontWeight: '600',
  },
  takeawayBox: {
    backgroundColor: '#F0FDF4',
    borderLeftWidth: 4,
    borderLeftColor: '#15803D',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  takeawayCol: {
    flex: 1,
    gap: 4,
  },
  takeawayTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803D',
  },
  takeawayDesc: {
    fontSize: 12,
    color: '#166534',
    lineHeight: 16,
  },
  moistureSimBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  simTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  simTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  simTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  simMoisturePill: {
    backgroundColor: '#0284C7',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  simMoisturePillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  moistureButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  mBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  mBtnActive: {
    backgroundColor: '#2D5A27',
    borderColor: '#2D5A27',
  },
  mBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  mBtnTextActive: {
    color: '#FFFFFF',
  },
  simResultsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  resCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 2,
  },
  resCardDanger: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  resCardSuccess: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  resLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  resVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  mandiList: {
    gap: 10,
  },
  mandiCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  mandiCardRecommended: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  mandiCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mandiNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  mandiStateSub: {
    fontSize: 11,
    color: '#64748B',
  },
  netCashCol: {
    alignItems: 'flex-end',
  },
  netCashLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  netCashVal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#15803D',
  },
  mandiMetricsRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFFFFF',
    padding: 6,
    borderRadius: 6,
  },
  mandiMetricText: {
    fontSize: 11,
    color: '#475569',
  },
  mandiVerdict: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  mandiVerdictRec: {
    color: '#15803D',
  },
  vehiclesList: {
    gap: 10,
  },
  vehicleCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  vehicleTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vehicleTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  vehicleDistBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1',
    backgroundColor: '#E0F2FE',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  vehicleStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  vStat: {
    fontSize: 11,
    color: '#64748B',
  },
  vStatBold: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
  vehicleBestFor: {
    fontSize: 11,
    color: '#475569',
  },
  moistureCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cropMoistureCard: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  cropMTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cropMTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
  },
  cropMSafePill: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
    backgroundColor: '#DCFCE7',
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  cropMRisk: {
    fontSize: 10,
    color: '#DC2626',
    fontWeight: '700',
  },
  cropMPenalty: {
    fontSize: 10,
    color: '#64748B',
  },
  cropMLife: {
    fontSize: 10,
    color: '#475569',
  },
});
