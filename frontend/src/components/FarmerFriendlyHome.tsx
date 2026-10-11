import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import {
  Mic,
  Volume2,
  Square,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ArrowRight,
  X,
  Layers,
} from "lucide-react-native";
import {
  COMMODITIES_DATA,
  CommodityRecord,
  MANDI_LOCATIONS,
  MandiLocation,
} from "@/data/mockMandiData";
import { LocationHeader } from "@/components/LocationHeader";
import { AiAnalystSheet } from "@/components/AiAnalystSheet";
import { speakText, stopSpeaking } from "@/lib/speech";
import { setLanguage, SupportedLanguage } from "@/lib/storage";

interface FarmerFriendlyHomeProps {
  onSwitchToTerminal: () => void;
}

// Multilingual regional names for all 20 vegetables
const REGIONAL_NAMES: Record<
  string,
  { hi: string; te: string; mr: string; en: string }
> = {
  tomato: { hi: "टमाटर", te: "టమాట", mr: "टोमॅटो", en: "Tomato" },
  onion: { hi: "प्याज", te: "ఉల్లిపాయ", mr: "कांदा", en: "Onion" },
  potato: { hi: "आलू", te: "బంగాళాదుంప", mr: "बटाटा", en: "Potato" },
  brinjal: { hi: "बैंगन", te: "వంకాయ", mr: "वांगी", en: "Brinjal" },
  chilli: { hi: "हरी मिर्च", te: "పచ్చిమిర్చి", mr: "हिरवी मिरची", en: "Green Chilli" },
  garlic: { hi: "लहसुन", te: "వెల్లుల్లి", mr: "लसूण", en: "Garlic" },
  ginger: { hi: "अदरक", te: "అల్లం", mr: "आले", en: "Ginger" },
  cabbage: { hi: "पत्ता गोभी", te: "క్యాబేజీ", mr: "कोबी", en: "Cabbage" },
  cauliflower: { hi: "फूल गोभी", te: "క్యాలీఫ్లవర్", mr: "फ्लॉवर", en: "Cauliflower" },
  carrot: { hi: "गाजर", te: "క్యారెట్", mr: "गाजर", en: "Carrot" },
  bhindi: { hi: "भिंडी", te: "బెండకాయ", mr: "भेंडी", en: "Ladyfinger" },
  matar: { hi: "मटर", te: "బఠానీ", mr: "मटार", en: "Green Peas" },
  capsicum: { hi: "शिमला मिर्च", te: "క్యాప్సికమ్", mr: "ढोबळी मिरची", en: "Capsicum" },
  cucumber: { hi: "खीरा", te: "దోసకాయ", mr: "काकडी", en: "Cucumber" },
  bottlegourd: { hi: "लौकी", te: "ఆనపకాయ", mr: "दुधी भोपळा", en: "Bottle Gourd" },
  bittergourd: { hi: "करेला", te: "కాకరకాయ", mr: "कारले", en: "Bitter Gourd" },
  palak: { hi: "पालक", te: "పాలకూర", mr: "पालक", en: "Spinach" },
  lemon: { hi: "नींबू", te: "నిమ్మకాయ", mr: "लिंबू", en: "Lemon" },
  coriander: { hi: "हरा धनिया", te: "కొత్తిమీర", mr: "कोथिंबीर", en: "Coriander" },
  beetroot: { hi: "चुकंदर", te: "బీట్‌రూట్", mr: "बीट", en: "Beetroot" },
};

const LANGUAGES: { code: SupportedLanguage; label: string; flag: string }[] = [
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "te", label: "తెలుగు", flag: "🇮🇳" },
  { code: "mr", label: "मराठी", flag: "🇮🇳" },
  { code: "en", label: "English", flag: "🌐" },
];

export const FarmerFriendlyHome: React.FC<FarmerFriendlyHomeProps> = ({
  onSwitchToTerminal,
}) => {
  const { i18n } = useTranslation();
  const currentLang = (i18n.language || "hi") as "hi" | "te" | "mr" | "en";

  const [activeMandi, setActiveMandi] = useState<MandiLocation>(MANDI_LOCATIONS[0]);
  const [selectedCrop, setSelectedCrop] = useState<CommodityRecord | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [speakingCropId, setSpeakingCropId] = useState<string | null>(null);
  const [aiSheetVisible, setAiSheetVisible] = useState(false);
  const [initialAiPrompt, setInitialAiPrompt] = useState<string | undefined>();

  const handleLanguageChange = async (langCode: SupportedLanguage) => {
    stopSpeaking();
    setSpeakingCropId(null);
    await i18n.changeLanguage(langCode);
    await setLanguage(langCode);
  };

  const getCropDisplayName = (cropId: string, englishFallback: string) => {
    const entry = REGIONAL_NAMES[cropId];
    if (!entry) return englishFallback;
    return entry[currentLang] || entry.hi || englishFallback;
  };

  const generateSpokenSentence = (c: CommodityRecord) => {
    const cropName = getCropDisplayName(c.id, c.name);
    const mandiName = activeMandi.name.split(" ")[0];

    if (currentLang === "hi") {
      const trendText =
        c.change24h > 0
          ? `कल के मुकाबले ${c.changeAmount} रुपये का उछाल आया है। बिक्री के लिए अच्छा समय है।`
          : c.change24h < 0
          ? `कल से ${Math.abs(c.changeAmount)} रुपये कम हुआ है।`
          : "भाव सामान्य बना हुआ है।";
      return `आज ${mandiName} मंडी में ${cropName} का थोक भाव ${c.modalPriceKg} रुपये प्रति किलो है। यानी ${c.modalPriceQtl} रुपये प्रति क्विंटल। ${trendText}`;
    } else if (currentLang === "te") {
      const trendText =
        c.change24h > 0
          ? `నిన్నటి కంటే ${c.changeAmount} రూపాయలు పెరిగింది.`
          : c.change24h < 0
          ? `ధర ${Math.abs(c.changeAmount)} రూపాయలు తగ్గింది.`
          : "ధర స్థిరంగా ఉంది.";
      return `ఈరోజు ${mandiName} మార్కెట్లో ${cropName} ధర కిలోకు ${c.modalPriceKg} రూపాయలు. ${trendText}`;
    } else if (currentLang === "mr") {
      const trendText =
        c.change24h > 0
          ? `कालपेक्षा ${c.changeAmount} रुपयांनी वाढ झाली आहे.`
          : c.change24h < 0
          ? `कालपेक्षा ${Math.abs(c.changeAmount)} रुपयांनी घसरण झाली आहे.`
          : "भाव स्थिर आहे.";
      return `आज ${mandiName} मार्केटमध्ये ${cropName} भाव ${c.modalPriceKg} रुपये किलो आहे. ${trendText}`;
    }

    return `Today at ${mandiName} mandi, ${c.name} modal price is ₹${c.modalPriceKg} per kg or ₹${c.modalPriceQtl} per quintal. Daily change is ${c.change24h}%.`;
  };

  const handleToggleSpeak = (c: CommodityRecord) => {
    if (speakingCropId === c.id) {
      stopSpeaking();
      setSpeakingCropId(null);
    } else {
      stopSpeaking();
      setSpeakingCropId(c.id);
      const text = generateSpokenSentence(c);
      speakText(
        text,
        currentLang,
        () => setSpeakingCropId(null),
        () => setSpeakingCropId(null)
      );
    }
  };

  const handleOpenAiForCrop = (c: CommodityRecord) => {
    setSelectedCrop(null);
    const cropName = getCropDisplayName(c.id, c.name);
    setInitialAiPrompt(
      currentLang === "hi"
        ? `आज ${activeMandi.name} में ${cropName} बेचना सही रहेगा या कल रुकें?`
        : `Should I sell ${c.name} at ${activeMandi.name} today or hold?`
    );
    setAiSheetVisible(true);
  };

  const filteredCrops = COMMODITIES_DATA.filter((c) => {
    if (selectedCategory === "All") return true;
    return c.category === selectedCategory;
  });

  return (
    <View style={styles.container}>
      {/* 1. TOP UTILITY BAR: Language Selector & Mode Switch */}
      <View style={styles.topUtilityBar}>
        <View style={styles.langChipsRow}>
          {LANGUAGES.map((l) => (
            <Pressable
              key={l.code}
              onPress={() => handleLanguageChange(l.code)}
              style={[
                styles.langChip,
                currentLang === l.code && styles.langChipActive,
              ]}
            >
              <Text style={styles.langFlag}>{l.flag}</Text>
              <Text
                style={[
                  styles.langChipText,
                  currentLang === l.code && styles.langChipTextActive,
                ]}
              >
                {l.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Button to toggle into Trader Terminal */}
        <Pressable
          onPress={onSwitchToTerminal}
          style={styles.terminalSwitchButton}
        >
          <Layers size={14} color="#f59e0b" />
          <Text style={styles.terminalSwitchText}>ट्रेडर टर्मिनल ➔</Text>
        </Pressable>
      </View>

      {/* 2. LOCATION & MANDI HEADER */}
      <LocationHeader
        activeMandi={activeMandi}
        onSelectMandi={(m) => setActiveMandi(m)}
      />

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 3. HERO VOICE ASSISTANT CARD (MANDI MITRA) */}
        <Pressable
          onPress={() => {
            setInitialAiPrompt(undefined);
            setAiSheetVisible(true);
          }}
          style={styles.voiceAssistantHero}
        >
          <View style={styles.voiceHeroLeft}>
            <View style={styles.micCircle}>
              <Mic size={28} color="#ffffff" />
            </View>
            <View style={styles.voiceHeroTextWrap}>
              <View style={styles.aiTagPill}>
                <Sparkles size={12} color="#047857" />
                <Text style={styles.aiTagText}>
                  {currentLang === "hi"
                    ? "मंडी मित्र बोलकर सहायता"
                    : currentLang === "te"
                    ? "మండి మిత్ర వాయిస్ అసిస్టెంట్"
                    : currentLang === "mr"
                    ? "मंडी मित्र आवाज सहाय्यक"
                    : "Mandi Mitra Voice Copilot"}
                </Text>
              </View>
              <Text style={styles.voiceHeroTitle}>
                {currentLang === "hi"
                  ? "माइक दबाएं और बोलकर पूछें"
                  : currentLang === "te"
                  ? "మైక్ నొక్కి మాట్లాడండి"
                  : currentLang === "mr"
                  ? "माईक दाबा आणि विचारा"
                  : "Tap Mic & Ask in Your Voice"}
              </Text>
              <Text style={styles.voiceHeroSubtitle}>
                {currentLang === "hi"
                  ? "“आज कौन सी सब्ज़ी का भाव बढ़ा है?”"
                  : currentLang === "te"
                  ? "“ఈరోజు టమాటా ధర ఎంత?”"
                  : currentLang === "mr"
                  ? "“आज कांद्याचा भाव काय आहे?”"
                  : "“What is the highest selling vegetable today?”"}
              </Text>
            </View>
          </View>
          <View style={styles.heroArrow}>
            <ArrowRight size={20} color="#047857" />
          </View>
        </Pressable>

        {/* 4. VISUAL CATEGORY TABS */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryScrollContent}
        >
          {[
            { id: "All", label: "🌟 सभी फसलें", en: "All Crops" },
            { id: "Essentials", label: "🥔 मुख्य सब्जियां", en: "Daily Essentials" },
            { id: "Greens", label: "🥬 हरी पत्तियां", en: "Fresh Greens" },
            { id: "Spices", label: "🌶️ मिर्च-मसाले", en: "Spices" },
            { id: "Gourds", label: "🥒 बेल वाली फसलें", en: "Gourds" },
            { id: "Roots", label: "🥕 जड़ वाली सब्जियां", en: "Roots" },
          ].map((cat) => (
            <Pressable
              key={cat.id}
              onPress={() => setSelectedCategory(cat.id)}
              style={[
                styles.categoryCard,
                selectedCategory === cat.id && styles.categoryCardActive,
              ]}
            >
              <Text
                style={[
                  styles.categoryCardText,
                  selectedCategory === cat.id && styles.categoryCardTextActive,
                ]}
              >
                {currentLang === "en" ? cat.en : cat.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* 5. CROP CARDS GRID */}
        <View style={styles.cropsGridHeader}>
          <Text style={styles.gridSectionTitle}>
            {currentLang === "hi"
              ? "आज के ताज़ा मंडी भाव (20 सब्जियां)"
              : currentLang === "te"
              ? "ఈరోజు తాజా మార్కెట్ ధరలు"
              : currentLang === "mr"
              ? "आजचे ताजे मंडी भाव"
              : "Today's Wholesale Mandi Prices"}
          </Text>
          <Text style={styles.gridSectionSub}>
            {currentLang === "hi"
              ? "स्पीकर बटन 🔊 दबाकर बोलकर सुनें"
              : currentLang === "te"
              ? "వినడానికి స్పీకర్ బటన్ నొక్కండి 🔊"
              : currentLang === "mr"
              ? "ऐकण्यासाठी स्पीकर बटण दाबा 🔊"
              : "Tap speaker 🔊 on any card to listen aloud"}
          </Text>
        </View>

        <View style={styles.cropsGrid}>
          {filteredCrops.map((crop) => {
            const isSpeakingThis = speakingCropId === crop.id;
            const isGain = crop.change24h > 0;
            const isDrop = crop.change24h < 0;
            const regionalName = getCropDisplayName(crop.id, crop.name);

            return (
              <View key={crop.id} style={styles.cropCard}>
                {/* Top Row: Picture + Names + Trend Badge */}
                <Pressable
                  onPress={() => setSelectedCrop(crop)}
                  style={styles.cardHeaderArea}
                >
                  <View style={styles.cropIconWrapper}>
                    <Text style={styles.cropLargeIcon}>{crop.icon}</Text>
                  </View>

                  <View style={styles.cropNameGroup}>
                    <Text style={styles.cropRegionalName}>{regionalName}</Text>
                    <Text style={styles.cropEnglishSubtitle}>
                      {crop.name} • {crop.variety.split(" ")[0]}
                    </Text>
                  </View>

                  {/* Trend Indicator Pill */}
                  <View
                    style={[
                      styles.trendPill,
                      isGain
                        ? styles.trendGain
                        : isDrop
                        ? styles.trendDrop
                        : styles.trendSteady,
                    ]}
                  >
                    {isGain ? (
                      <TrendingUp size={13} color="#15803d" />
                    ) : isDrop ? (
                      <TrendingDown size={13} color="#b91c1c" />
                    ) : null}
                    <Text
                      style={[
                        styles.trendPillText,
                        isGain
                          ? styles.trendGainText
                          : isDrop
                          ? styles.trendDropText
                          : styles.trendSteadyText,
                      ]}
                    >
                      {isGain
                        ? `+₹${crop.changeAmount}`
                        : isDrop
                        ? `-₹${Math.abs(crop.changeAmount)}`
                        : "स्थिर"}
                    </Text>
                  </View>
                </Pressable>

                {/* Price Display: Big ₹ per KG + Quintal */}
                <View style={styles.priceContainerRow}>
                  <View style={styles.priceLeft}>
                    <View style={styles.rateHighlightRow}>
                      <Text style={styles.rupeeSymbol}>₹</Text>
                      <Text style={styles.priceGiant}>{crop.modalPriceKg}</Text>
                      <Text style={styles.perKgText}>
                        /{currentLang === "en" ? "kg" : "किलो"}
                      </Text>
                    </View>
                    <Text style={styles.quintalRateText}>
                      ₹{crop.modalPriceQtl.toLocaleString()} /{" "}
                      {currentLang === "en" ? "quintal" : "क्विंटल"}
                    </Text>
                  </View>

                  {/* 1-TAP SPEAK BUTTON */}
                  <Pressable
                    onPress={() => handleToggleSpeak(crop)}
                    style={[
                      styles.speakButton,
                      isSpeakingThis && styles.speakButtonActive,
                    ]}
                  >
                    {isSpeakingThis ? (
                      <Square size={16} color="#ffffff" />
                    ) : (
                      <Volume2 size={18} color="#ffffff" />
                    )}
                    <Text style={styles.speakButtonText}>
                      {isSpeakingThis
                        ? currentLang === "en"
                          ? "Stop"
                          : "रोकें"
                        : currentLang === "en"
                        ? "Listen"
                        : "सुनें 🔊"}
                    </Text>
                  </Pressable>
                </View>

                {/* Card Action Row: Compare & Details */}
                <Pressable
                  onPress={() => setSelectedCrop(crop)}
                  style={styles.cardFooterAction}
                >
                  <Text style={styles.cardFooterText}>
                    {currentLang === "hi"
                      ? "नजदीकी मंडियों से भाव तुलना ➔"
                      : currentLang === "te"
                      ? "దగ్గరి మార్కెట్లతో పోల్చండి ➔"
                      : currentLang === "mr"
                      ? "जवळच्या बाजाराशी तुलना ➔"
                      : "Compare with nearby mandis ➔"}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* 6. CROP DETAIL MODAL FOR FARMERS */}
      <Modal
        visible={!!selectedCrop}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedCrop(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {selectedCrop && (
              <>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <View style={styles.modalCropTitleRow}>
                    <Text style={styles.modalCropIcon}>
                      {selectedCrop.icon}
                    </Text>
                    <View>
                      <Text style={styles.modalCropName}>
                        {getCropDisplayName(selectedCrop.id, selectedCrop.name)}
                      </Text>
                      <Text style={styles.modalCropSub}>
                        {selectedCrop.variety} • {activeMandi.name}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => {
                      stopSpeaking();
                      setSelectedCrop(null);
                    }}
                    style={styles.modalCloseBtn}
                  >
                    <X size={20} color="#374151" />
                  </Pressable>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Big Voice Button in Modal */}
                  <Pressable
                    onPress={() => handleToggleSpeak(selectedCrop)}
                    style={styles.modalListenHero}
                  >
                    <Volume2 size={24} color="#ffffff" />
                    <Text style={styles.modalListenHeroText}>
                      {currentLang === "hi"
                        ? "पूरी भाव सलाह बोलकर सुनें 🔊"
                        : currentLang === "te"
                        ? "పూర్తి సమాచారం వినండి 🔊"
                        : currentLang === "mr"
                        ? "संपूर्ण सल्ला ऐका 🔊"
                        : "Listen to Complete Price Advisory 🔊"}
                    </Text>
                  </Pressable>

                  {/* Mandi vs Retail Box */}
                  <View style={styles.comparisonBox}>
                    <View style={styles.compareItem}>
                      <Text style={styles.compareLabel}>
                        {currentLang === "hi"
                          ? "मंडी थोक भाव"
                          : currentLang === "te"
                          ? "మార్కెట్ హోల్‌సేల్"
                          : currentLang === "mr"
                          ? "घाऊक भाव"
                          : "Wholesale Mandi"}
                      </Text>
                      <Text style={styles.comparePriceBig}>
                        ₹{selectedCrop.modalPriceKg}
                        <Text style={styles.compareUnit}>/किलो</Text>
                      </Text>
                      <Text style={styles.compareSub}>
                        ₹{selectedCrop.modalPriceQtl}/क्विंटल
                      </Text>
                    </View>

                    <View style={styles.compareDivider} />

                    <View style={styles.compareItem}>
                      <Text style={styles.compareLabel}>
                        {currentLang === "hi"
                          ? "दुकान/खुदरा भाव"
                          : currentLang === "te"
                          ? "చిల్లర దుకాణం"
                          : currentLang === "mr"
                          ? "किरकोळ भाव"
                          : "Retail Market"}
                      </Text>
                      <Text style={styles.comparePriceRetail}>
                        ₹{Math.round(selectedCrop.modalPriceKg * 1.45)}
                        <Text style={styles.compareUnit}>/किलो</Text>
                      </Text>
                      <Text style={styles.compareSub}>बाजार में बिक्री</Text>
                    </View>
                  </View>

                  {/* Nearby Mandis Comparison List */}
                  <View style={styles.nearbySection}>
                    <Text style={styles.nearbySectionTitle}>
                      📍{" "}
                      {currentLang === "hi"
                        ? "नजदीकी मंडियों में भाव देखें"
                        : currentLang === "te"
                        ? "సమీప మార్కెట్లలో ధరలు"
                        : currentLang === "mr"
                        ? "जवळच्या मंड्यांमधील भाव"
                        : "Compare Adjacent Mandis"}
                    </Text>

                    {selectedCrop.nearbyMandis.map((nm, idx) => (
                      <View key={idx} style={styles.nearbyRow}>
                        <View>
                          <Text style={styles.nearbyName}>{nm.mandiName}</Text>
                          <Text style={styles.nearbyDist}>
                            ~{nm.distKm} किमी दूर
                          </Text>
                        </View>
                        <View style={styles.nearbyPriceTag}>
                          <Text style={styles.nearbyPriceVal}>
                            ₹{nm.pricePerKg}/किलो
                          </Text>
                          <Text
                            style={[
                              styles.spreadBadge,
                              nm.spread > 0
                                ? styles.spreadHigher
                                : styles.spreadLower,
                            ]}
                          >
                            {nm.spread > 0
                              ? `+₹${nm.spread} अधिक`
                              : nm.spread < 0
                              ? `-₹${Math.abs(nm.spread)} कम`
                              : "समान"}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>

                  {/* Ask AI Button */}
                  <Pressable
                    onPress={() => handleOpenAiForCrop(selectedCrop)}
                    style={styles.askAiModalButton}
                  >
                    <Sparkles size={18} color="#ffffff" />
                    <Text style={styles.askAiModalButtonText}>
                      {currentLang === "hi"
                        ? "मंडी मित्र से पूछें: क्या आज बेचना चाहिए? ➔"
                        : currentLang === "te"
                        ? "ఈరోజే అమ్మాలా? మండి మిత్రను అడగండి ➔"
                        : currentLang === "mr"
                        ? "आज विकावे की थांबावे? विचारा ➔"
                        : "Ask Mandi Mitra: Should I sell today? ➔"}
                    </Text>
                  </Pressable>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* 7. AI COPILOT BOTTOM SHEET */}
      <AiAnalystSheet
        visible={aiSheetVisible}
        onClose={() => setAiSheetVisible(false)}
        selectedCommodity={selectedCrop}
        activeMandiName={activeMandi.name}
        initialPrompt={initialAiPrompt}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FBF9F1",
  },
  topUtilityBar: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E3E8DA",
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  langChipsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  langChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F4F7EE",
    borderWidth: 1,
    borderColor: "#D2DECA",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
    ...(Platform.OS === "web" ? { cursor: "pointer" as const } : {}),
  },
  langChipActive: {
    backgroundColor: "#2F7D4F",
    borderColor: "#2F7D4F",
  },
  langFlag: {
    fontSize: 12,
  },
  langChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
  },
  langChipTextActive: {
    color: "#FFFFFF",
  },
  terminalSwitchButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#18181b",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 5,
    ...(Platform.OS === "web" ? { cursor: "pointer" as const } : {}),
  },
  terminalSwitchText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#f59e0b",
  },
  mainScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  voiceAssistantHero: {
    margin: 14,
    backgroundColor: "#EAF5E4",
    borderWidth: 2,
    borderColor: "#A8D5A2",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  voiceHeroLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  micCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2F7D4F",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2F7D4F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  voiceHeroTextWrap: {
    flex: 1,
    gap: 2,
  },
  aiTagPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  aiTagText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#047857",
  },
  voiceHeroTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1F2A24",
  },
  voiceHeroSubtitle: {
    fontSize: 12,
    color: "#4B5563",
    fontStyle: "italic",
  },
  heroArrow: {
    padding: 6,
  },
  categoryScroll: {
    maxHeight: 46,
    marginBottom: 8,
  },
  categoryScrollContent: {
    paddingHorizontal: 14,
    gap: 8,
  },
  categoryCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3E8DA",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
  },
  categoryCardActive: {
    backgroundColor: "#2F7D4F",
    borderColor: "#2F7D4F",
  },
  categoryCardText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4B5563",
  },
  categoryCardTextActive: {
    color: "#FFFFFF",
  },
  cropsGridHeader: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  gridSectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1F2A24",
  },
  gridSectionSub: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  cropsGrid: {
    paddingHorizontal: 14,
    gap: 12,
    marginTop: 8,
  },
  cropCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeaderArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cropIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#F4F7EE",
    alignItems: "center",
    justifyContent: "center",
  },
  cropLargeIcon: {
    fontSize: 32,
  },
  cropNameGroup: {
    flex: 1,
  },
  cropRegionalName: {
    fontSize: 19,
    fontWeight: "900",
    color: "#111827",
  },
  cropEnglishSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
  },
  trendPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 3,
  },
  trendGain: {
    backgroundColor: "#DCFCE7",
  },
  trendDrop: {
    backgroundColor: "#FEE2E2",
  },
  trendSteady: {
    backgroundColor: "#FEF3C7",
  },
  trendPillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  trendGainText: {
    color: "#15803d",
  },
  trendDropText: {
    color: "#b91c1c",
  },
  trendSteadyText: {
    color: "#b45309",
  },
  priceContainerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  priceLeft: {
    gap: 2,
  },
  rateHighlightRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
  },
  rupeeSymbol: {
    fontSize: 20,
    fontWeight: "900",
    color: "#15803d",
  },
  priceGiant: {
    fontSize: 30,
    fontWeight: "900",
    color: "#111827",
  },
  perKgText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "700",
  },
  quintalRateText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
  },
  speakButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2F7D4F",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 6,
    shadowColor: "#2F7D4F",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  speakButtonActive: {
    backgroundColor: "#b91c1c",
  },
  speakButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  cardFooterAction: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  cardFooterText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563eb",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  modalCropTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modalCropIcon: {
    fontSize: 34,
  },
  modalCropName: {
    fontSize: 20,
    fontWeight: "900",
    color: "#111827",
  },
  modalCropSub: {
    fontSize: 12,
    color: "#6B7280",
  },
  modalCloseBtn: {
    padding: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
  },
  modalListenHero: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2F7D4F",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  modalListenHeroText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  comparisonBox: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  compareItem: {
    flex: 1,
    alignItems: "center",
  },
  compareLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },
  comparePriceBig: {
    fontSize: 24,
    fontWeight: "900",
    color: "#15803d",
    marginTop: 4,
  },
  comparePriceRetail: {
    fontSize: 24,
    fontWeight: "900",
    color: "#374151",
    marginTop: 4,
  },
  compareUnit: {
    fontSize: 12,
    color: "#6B7280",
  },
  compareSub: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  compareDivider: {
    width: 1,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 10,
  },
  nearbySection: {
    backgroundColor: "#F4F7EE",
    borderWidth: 1,
    borderColor: "#D2DECA",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  nearbySectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#1F2A24",
    marginBottom: 4,
  },
  nearbyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 10,
    borderRadius: 8,
  },
  nearbyName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  nearbyDist: {
    fontSize: 11,
    color: "#6B7280",
  },
  nearbyPriceTag: {
    alignItems: "flex-end",
  },
  nearbyPriceVal: {
    fontSize: 15,
    fontWeight: "900",
    color: "#15803d",
  },
  spreadBadge: {
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    marginTop: 2,
  },
  spreadHigher: {
    backgroundColor: "#DCFCE7",
    color: "#15803d",
  },
  spreadLower: {
    backgroundColor: "#FEE2E2",
    color: "#b91c1c",
  },
  askAiModalButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#047857",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginBottom: 10,
  },
  askAiModalButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
