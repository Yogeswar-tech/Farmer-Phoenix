import { useState, useEffect, useRef, type FC } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Pressable,
  StyleSheet
} from 'react-native';
import type { Language, MandiItem } from '../types';
import { translations } from '../data/i18n';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  Send,
  X,
  CheckCircle2,
  Share2,
  ShieldCheck
} from 'lucide-react';

interface AiVoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLang: Language;
  activeMandi: MandiItem;
  isAiModeEnabled: boolean;
  onToggleAiMode: (enabled: boolean) => void;
}

interface SmartAnswer {
  question: Record<Language, string>;
  category: 'price' | 'weather' | 'grading' | 'storage' | 'logistics';
  verdict: Record<Language, string>;
  details: Record<Language, string>;
  confidence: number;
  source: Record<Language, string>;
  suggestedAction: Record<Language, string>;
}

const PRESET_AI_KNOWLEDGE_BASE: SmartAnswer[] = [
  {
    category: 'price',
    question: {
      hi: 'मिर्च बेचने का सही समय क्या है?',
      te: 'మిర్చి అమ్మడానికి సరైన సమయం ఎప్పుడు?',
      en: 'When is the best time to sell my chilli?'
    },
    verdict: {
      hi: '✅ अगले 48 घंटों में बेचना सबसे लाभदायक है (Strong Sell Signal)',
      te: '✅ రాబోయే 48 గంటల్లో అమ్మడం అత్యంత లాభదాయకం (Strong Sell Signal)',
      en: '✅ Next 48 Hours is Ideal to Sell (Strong Positive Momentum)'
    },
    details: {
      hi: 'गुंटूर एपीएमसी में मॉडल भाव ₹14,200/क्विंटल पर 14 दिनों के उच्चतम स्तर पर है (+₹300 वृद्धि)। आज सुबह यार्ड में आवक 18% घटी है जिससे खरीदार आक्रामक बोली लगा रहे हैं। इसके अतिरिक्त गुरुवार को बारिश की चेतावनी है, अतः खुले यार्ड में भीगने से पूर्व आज या कल में माल रवाना करें।',
      te: 'గుంటూరు యార్డ్‌లో మోడల్ ధర క్వింటాకు ₹14,200తో గత 14 రోజుల్లో అత్యధిక స్థాయికి చేరింది. ఈ ఉదయం సరుకు రాక 18% తగ్గడంతో వ్యాపారులు పోటీపడి కొంటున్నారు. గురువారం భారీ వర్షం ఉన్నందున ఈరోజే అమ్మడం శ్రేయస్కరం.',
      en: 'Guntur APMC modal price is at a 14-day peak of ₹14,200/qtl (+₹300 uptick). Morning yard arrivals are down 18%, pushing buyers to bid aggressively. With heavy rain forecast for Thursday, liquidate before wet weather hits the open yards.'
    },
    confidence: 96,
    source: {
      hi: 'ई-नाम लाइव नीलामी एवं आईएमडी गुंटूर रडार',
      te: 'e-NAM లైవ్ వేలం & IMD వాతావరణ శాఖ',
      en: 'e-NAM Agmarknet Inflow Records & IMD Doppler Radar'
    },
    suggestedAction: {
      hi: 'आज दोपहर तक 1.5-टन या ट्रैक्टर ट्रॉली लोड करके रवाना करें।',
      te: 'ఈరోజు మధ్యాహ్నానికి లోడ్ సిద్ధం చేసుకుని మార్కెట్‌కు బయలుదేరండి.',
      en: 'Book transport today to reach market gate before 7:00 AM auction.'
    }
  },
  {
    category: 'weather',
    question: {
      hi: 'क्या कल बारिश में कीटनाशक छिड़काव कर सकते हैं?',
      te: 'రేపు వర్షం ఉంటే ఈరోజు మందు కొట్టవచ్చా?',
      en: 'Can I spray pesticide with tomorrow’s rain forecast?'
    },
    verdict: {
      hi: '⚠️ छिड़काव तुरंत रोकें! (Delay Spraying Notice)',
      te: '⚠️ పిచికారీని వాయిదా వేయండి! (Delay Spraying Notice)',
      en: '⚠️ Delay Chemical Spraying! (High Washout Risk)'
    },
    details: {
      hi: 'गुरुवार को 80% से अधिक बारिश की संभावना है। वर्षा से पूर्व छिड़काव करने पर पूरी दवा बह जाएगी (₹1,800/एकड़ का आर्थिक नुकसान) तथा पत्तों पर फंगस का प्रकोप बढ़ सकता है। शुक्रवार के बाद मौसम साफ होने पर ही छिड़कें।',
      te: 'గురువారం 80% కంటే ఎక్కువ వర్షం కురిసే అవకాశం ఉంది. ఇప్పుడు స్ప్రే చేస్తే మందు మొత్తం కొట్టుకుపోయి ఎకరానికి ₹1,800 వృధా అవుతుంది. శనివారం ఎండ వచ్చిన తర్వాతే పిచికారీ చేయండి.',
      en: 'Over 80% rain probability is forecasted for Thursday. Applying sprays now causes chemical washout (loss of ₹1,800/acre in chemical cost) without protecting foliage. Wait until Friday after the rain front clears.'
    },
    confidence: 98,
    source: {
      hi: 'आईएमडी कृषि मौसम वेधशाला एवं कृषि विश्वविद्यालय परामर्श',
      te: 'భారత వాతావరణ శాఖ (IMD) వ్యవసాయ విభాగం',
      en: 'IMD Agromet Advisory & ANGRAU Agronomy Bulletin'
    },
    suggestedAction: {
      hi: 'कीटनाशक स्प्रे पंप बंद रखें; नालियों में जल निकासी सुनिश्चित करें।',
      te: 'స్ప్రే చేయవద్దు; పొలంలో నీరు నిల్వ ఉండకుండా డ్రైనేజీ చూడండి.',
      en: 'Hold off chemical tanks; clear field drainage channels instead.'
    }
  },
  {
    category: 'grading',
    question: {
      hi: 'मंडी में नमी की कटौती से कैसे बचें?',
      te: 'మార్కెట్లో తేమ కోత నష్టాన్ని ఎలా తగ్గించాలి?',
      en: 'How to prevent moisture deduction at mandi yards?'
    },
    verdict: {
      hi: '✅ नीली तिरपाल पर 2 दिन सुखाएं (Save ₹18,000 on 20 Qtl)',
      te: '✅ బ్లూ టార్పాలిన్‌పై 2 రోజులు ఆరబెట్టండి (₹18,000 లాభం)',
      en: '✅ Sun-Dry 2 Days on Tarpaulin (Saves ₹18,000 on 20 Qtl)'
    },
    details: {
      hi: 'यदि मिर्च में नमी 16% से अधिक है, तो आढ़ती प्रति क्विंटल ₹600–₹1,000 की भारी कटौती लगाते हैं। यदि आप माल को स्वच्छ नीली तिरपाल पर 2 दिन धूप में सुखाकर नमी 11% तक ले आते हैं, तो आपको सुपर एक्सपोर्ट ग्रेड-ए (₹16,500/क्विंटल) भाव मिलेगा।',
      te: 'తేమ 16% దాటితే వ్యాపారులు క్వింటాకు ₹600-₹1,000 కోత పెడతారు. టార్పాలిన్‌పై 2 రోజులు ఎండబెట్టి తేమను 11%కి తెస్తే గ్రేడ్-ఎ ప్రీమియం ధర (₹16,500) లభిస్తుంది.',
      en: 'Moisture above 16% triggers docked penalties of ₹600–₹1,000/qtl by yard commission agents. Sun-drying on clean tarpaulins down to 11% moves your produce into Super Export Grade-A (₹16,500/qtl).'
    },
    confidence: 94,
    source: {
      hi: 'एपीडा एवं भारतीय मसाला बोर्ड गुणवत्ता मानक',
      te: 'స్పైసెస్ బోర్డ్ ఆఫ్ ఇండియా నాణ్యత మార్గదర్శకాలు',
      en: 'Spices Board of India Quality & Agmarknet Inspection Norms'
    },
    suggestedAction: {
      hi: 'मंडी में डिजिटल नमी मीटर से स्वयं 11% नमी जांचकर ही माल उतारें।',
      te: 'లోడ్ దించే ముందు తేమ మీటర్‌తో 11% ఉందో లేదో సరిచూసుకోండి.',
      en: 'Verify 11% moisture reading on yard meter before unloading bags.'
    }
  },
  {
    category: 'storage',
    question: {
      hi: 'निकटतम कोल्ड स्टोरेज में खाली जगह और किराया क्या है?',
      te: 'సమీప కోల్డ్ స్టోరేజ్ అద్దె మరియు ఖాళీ వివరాలు ఏమిటి?',
      en: 'What are the nearest cold storage vacancies and rental rates?'
    },
    verdict: {
      hi: '❄️ बालाजी कोल्ड स्टोरेज (12 किमी) में 3,200 बोरियां रिक्त',
      te: '❄️ బాలాజీ కోల్డ్ స్టోరేజ్ (12 కి.మీ) వద్ద 3,200 బస్తాలు ఖాళీ',
      en: '❄️ Balaji Cold Storage (12 km) has 3,200 Vacant Bags'
    },
    details: {
      hi: 'एनएच-16 चिल्लकलुरीपेटा रोड पर स्थित बालाजी कोल्ड स्टोरेज का किराया ₹35/बोरी/माह है। इसमें स्वचालित तापमान व धूमन (fumigation) सुविधा उपलब्ध है। फोन: 98480-11234 पर कॉल करके अग्रिम बुकिंग कर सकते हैं।',
      te: 'NH-16 చిలకలూరిపేట రోడ్డు వద్ద బాలాజీ కోల్డ్ స్టోరేజ్‌లో బస్తాకు ₹35/నెలకు అద్దె. ఆటోమేటిక్ టెంపరేచర్ మరియు ఫ్యూమిగేషన్ సదుపాయం ఉంది. ఫోన్: 98480-11234.',
      en: 'Located on NH-16 Chilakaluripeta bypass with rent of ₹35/bag/month. Includes automated temperature humidity sensors and certified pest fumigation. Call 98480-11234 to lock in chambers.'
    },
    confidence: 95,
    source: {
      hi: 'राज्य बागवानी एवं वेयरहाउसिंग विकास निगम',
      te: 'ఆంధ్రప్రదేశ్ వేర్‌హౌసింగ్ కార్పొరేషన్',
      en: 'State Horticulture & Warehousing Development Records'
    },
    suggestedAction: {
      hi: 'कीमतें स्थिर रहने तक 2–3 माह भंडारण से ₹2,000/क्विंटल अधिक मिल सकता है।',
      te: 'ధరలు పెరిగే వరకు 2-3 నెలలు నిల్వ ఉంచితే క్వింటాకు ₹2,000 ఎక్కువ రావచ్చు.',
      en: 'Store for 60-90 days during glut to capture post-harvest price spikes.'
    }
  }
];

export const AiVoiceAssistantModal: FC<AiVoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  currentLang,
  activeMandi,
  isAiModeEnabled,
  onToggleAiMode
}) => {
  const t = translations[currentLang];
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [queryInput, setQueryInput] = useState('');
  const [activeAnswer, setActiveAnswer] = useState<SmartAnswer | null>(PRESET_AI_KNOWLEDGE_BASE[0]);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!isOpen) return null;

  const handleVoiceListen = () => {
    const win = window as any;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(currentLang === 'hi' ? 'बोलकर खोजने की सुविधा उपलब्ध नहीं है।' : 'Voice recognition is not supported in this browser.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = currentLang === 'te' ? 'te-IN' : currentLang === 'hi' ? 'hi-IN' : 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = false;

      setIsListening(true);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setQueryInput(transcript);
        processQuery(transcript);
        setIsListening(false);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch (e) {
      console.warn('Voice error', e);
      setIsListening(false);
    }
  };

  const processQuery = (text: string) => {
    const lower = text.toLowerCase();
    let matched = PRESET_AI_KNOWLEDGE_BASE.find(
      (k) =>
        lower.includes(k.category) ||
        lower.includes(k.question[currentLang].toLowerCase()) ||
        (k.category === 'price' &&
          (lower.includes('price') || lower.includes('sell') || lower.includes('भाव') || lower.includes('ధర'))) ||
        (k.category === 'weather' &&
          (lower.includes('rain') || lower.includes('spray') || lower.includes('बारिश') || lower.includes('వర్షం'))) ||
        (k.category === 'grading' &&
          (lower.includes('moisture') || lower.includes('grade') || lower.includes('नमी') || lower.includes('తేమ'))) ||
        (k.category === 'storage' &&
          (lower.includes('storage') || lower.includes('cold') || lower.includes('कोल्ड') || lower.includes('స్టోరేజ్')))
    );

    if (!matched) {
      matched = {
        category: 'price',
        question: { hi: text, te: text, en: text },
        verdict: {
          hi: `✅ ${activeMandi.cropName[currentLang]} हेतु परामर्श: बेचने का उत्तम समय`,
          te: `✅ ${activeMandi.cropName[currentLang]} కొరకు సలహా: అమ్మడానికి మంచి సమయం`,
          en: `✅ Advisory for ${activeMandi.cropName[currentLang]}: Good time to sell`
        },
        details: {
          hi: `${activeMandi.mandiName[currentLang]} में मॉडल भाव ₹${activeMandi.grades[1]?.modalPrice || 14200}/क्विंटल है। आवक सामान्य है तथा मांग मजबूत बनी हुई है।`,
          te: `${activeMandi.mandiName[currentLang]} మార్కెట్లో ధర ₹${activeMandi.grades[1]?.modalPrice || 14200}/క్వింటా ఉంది. డిమాండ్ ఎక్కువగా ఉంది.`,
          en: `Modal price at ${activeMandi.mandiName[currentLang]} is ₹${activeMandi.grades[1]?.modalPrice || 14200}/quintal with solid commercial demand.`
        },
        confidence: 92,
        source: {
          hi: 'कृषि सेतु एआई इंजन एवं मंडी परिषद डेटा',
          te: 'కిసాన్ సేతు AI ఇంజిన్ & మార్కెట్ రికార్డులు',
          en: 'Kisan Setu AI Engine & Mandi Terminal Feed'
        },
        suggestedAction: {
          hi: 'नमी परीक्षण करवाएं और आज ही नजदीकी यार्ड के लिए रवाना करें।',
          te: 'తేమను పరీక్షించి వెంటనే మార్కెట్ యార్డ్‌కు రవాణా చేయండి.',
          en: 'Verify quality grades and proceed to nearest apex terminal yard.'
        }
      };
    }

    setActiveAnswer(matched);
    speakAnswer(matched.details[currentLang]);
  };

  const speakAnswer = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = currentLang === 'te' ? 'te-IN' : currentLang === 'hi' ? 'hi-IN' : 'en-IN';
    utter.rate = 0.95;
    utter.onstart = () => setIsSpeaking(true);
    utter.onend = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);
    synthRef.current = utter;
    window.speechSynthesis.speak(utter);
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const handleShareWhatsApp = (ans: SmartAnswer) => {
    const text = `🌾 *Agri Mitra AI Farmer Advisory*\n❓ *Question:* ${ans.question[currentLang]}\n💡 *Verdict:* ${ans.verdict[currentLang]}\n📊 *Details:* ${ans.details[currentLang]}\n✅ *Action:* ${ans.suggestedAction[currentLang]}\n🔗 Verified by Kisan Setu: https://kisansetu.in`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <Modal visible={isOpen} transparent={true} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.dialog} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.branding}>
              <View style={styles.avatar}>
                <Image
                  source={{ uri: '/brinjal.png' }}
                  style={{ width: 26, height: 26 }}
                  resizeMode="contain"
                />
                {isAiModeEnabled && <View style={styles.pulseDot} />}
              </View>
              <View>
                <Text style={styles.title}>{t.voiceAssistantTitle}</Text>
                <Text style={styles.subtitle}>{t.voiceAssistantSubtitle}</Text>
              </View>
            </View>

            <View style={styles.controls}>
              <View style={styles.switchPill}>
                <Text style={styles.switchLabel}>
                  {isAiModeEnabled ? t.aiAssistantEnable : t.aiAssistantDisable}
                </Text>
                <Switch
                  value={isAiModeEnabled}
                  onValueChange={onToggleAiMode}
                  trackColor={{ false: '#475569', true: '#00E676' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                <X size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {!isAiModeEnabled ? (
            <View style={styles.disabledCard}>
              <View style={styles.disabledIcon}>
                <MicOff size={32} color="#94A3B8" />
              </View>
              <Text style={styles.disabledHeading}>
                {currentLang === 'hi'
                  ? 'एआई वॉइस सहायक बंद है'
                  : currentLang === 'te'
                    ? 'AI వాయిస్ అసిస్టెంట్ ఆఫ్ చేయబడింది'
                    : 'AI Voice Assistant is Disabled'}
              </Text>
              <Text style={styles.disabledText}>
                {currentLang === 'hi'
                  ? 'बोलकर प्रश्न पूछने हेतु ऊपर दिए गए स्विच से एआई मोड चालू करें।'
                  : currentLang === 'te'
                    ? 'ప్రశ్నలు అడగడానికి పైన ఉన్న స్విచ్ ద్వారా AI మోడ్ ఆన్ చేయండి.'
                    : 'Toggle the switch above to enable smart voice farm advisory.'}
              </Text>
              <TouchableOpacity
                onPress={() => onToggleAiMode(true)}
                style={styles.enableBtn}
                activeOpacity={0.8}
              >
                <Sparkles size={16} color="#FFE600" />
                <Text style={styles.enableBtnText}>{t.aiAssistantEnable}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
              {/* Listening Banner */}
              <View style={[styles.listenBanner, (isListening || isSpeaking) && styles.listenBannerActive]}>
                <View style={styles.listenLeft}>
                  {isListening ? (
                    <Text style={styles.listenText}>
                      🎙️ {currentLang === 'hi' ? 'सुन रहे हैं...' : currentLang === 'te' ? 'వింటున్నాము...' : 'Listening...'}
                    </Text>
                  ) : isSpeaking ? (
                    <Text style={styles.listenText}>
                      🔊 {currentLang === 'hi' ? 'सुनाया जा रहा है...' : currentLang === 'te' ? 'చదువుతున్నాము...' : 'Speaking...'}
                    </Text>
                  ) : (
                    <Text style={styles.listenText}>
                      ✨ {currentLang === 'hi' ? 'माइक दबाकर बोलें' : currentLang === 'te' ? 'మైక్ నొక్కి మాట్లాడండి' : 'Tap mic to speak'}
                    </Text>
                  )}
                </View>

                {isSpeaking && (
                  <TouchableOpacity onPress={stopSpeaking} style={styles.stopBtn} activeOpacity={0.7}>
                    <VolumeX size={14} color="#DC2626" />
                    <Text style={styles.stopBtnText}>Stop</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Questions Carousel */}
              <View style={styles.presetsCol}>
                <Text style={styles.presetsLabel}>
                  {currentLang === 'hi' ? 'शीर्ष किसान प्रश्न:' : currentLang === 'te' ? 'ముఖ్యమైన ప్రశ్నలు:' : 'Popular Questions:'}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsRow}>
                  {PRESET_AI_KNOWLEDGE_BASE.map((item, idx) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => {
                        setActiveAnswer(item);
                        speakAnswer(item.details[currentLang]);
                      }}
                      style={[styles.presetChip, activeAnswer === item && styles.presetChipActive]}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.presetChipText}>🎙️ {item.question[currentLang]}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Response Card */}
              {activeAnswer && (
                <View style={styles.resCard}>
                  <View style={styles.resTop}>
                    <View style={styles.sourceTag}>
                      <CheckCircle2 size={14} color="#15803D" />
                      <Text style={styles.sourceText}>{activeAnswer.source[currentLang]}</Text>
                    </View>
                    <View style={styles.confPill}>
                      <Text style={styles.confText}>{activeAnswer.confidence}% Match</Text>
                    </View>
                  </View>

                  <Text style={styles.verdictText}>{activeAnswer.verdict[currentLang]}</Text>
                  <Text style={styles.detailsText}>{activeAnswer.details[currentLang]}</Text>

                  <View style={styles.actionBox}>
                    <View style={styles.actionHeaderRow}>
                      <ShieldCheck size={14} color="#15803D" />
                      <Text style={styles.actionHeader}>
                        {currentLang === 'hi' ? 'अनुशंसित कदम:' : currentLang === 'te' ? 'చేయవలసిన పని:' : 'Action Plan:'}
                      </Text>
                    </View>
                    <Text style={styles.actionBody}>{activeAnswer.suggestedAction[currentLang]}</Text>
                  </View>

                  <View style={styles.btnRow}>
                    <TouchableOpacity
                      onPress={() => speakAnswer(activeAnswer.details[currentLang])}
                      style={styles.listenBtn}
                      activeOpacity={0.8}
                    >
                      <Volume2 size={16} color="#FFFFFF" />
                      <Text style={styles.btnText}>
                        {currentLang === 'hi' ? 'पुनः सुनें' : currentLang === 'te' ? 'మళ్ళీ వినండి' : 'Listen'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleShareWhatsApp(activeAnswer)}
                      style={styles.waBtn}
                      activeOpacity={0.8}
                    >
                      <Share2 size={16} color="#FFFFFF" />
                      <Text style={styles.btnText}>{t.shareWhatsAppBtn}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Mic & Input */}
              <View style={styles.inputBar}>
                <TouchableOpacity
                  onPress={handleVoiceListen}
                  style={[styles.mainMicBtn, isListening && styles.mainMicBtnActive]}
                  activeOpacity={0.8}
                >
                  <Mic size={20} color="#FFFFFF" />
                </TouchableOpacity>

                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.textInput}
                    placeholder={t.askAiPlaceholder}
                    placeholderTextColor="#94A3B8"
                    value={queryInput}
                    onChangeText={setQueryInput}
                    onSubmitEditing={() => {
                      if (queryInput.trim()) {
                        processQuery(queryInput);
                        setQueryInput('');
                      }
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      if (queryInput.trim()) {
                        processQuery(queryInput);
                        setQueryInput('');
                      }
                    }}
                    style={styles.sendBtn}
                    activeOpacity={0.8}
                  >
                    <Send size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  dialog: {
    width: '100%',
    maxWidth: 580,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  header: {
    backgroundColor: '#1E3F1A',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  branding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#2D5A27',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pulseDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00E676',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 11,
    color: '#CBD5E1',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  switchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  switchLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  closeBtn: {
    padding: 4,
  },
  disabledCard: {
    padding: 36,
    alignItems: 'center',
    gap: 12,
  },
  disabledIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
  },
  disabledText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  enableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2D5A27',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 8,
  },
  enableBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  body: {
    maxHeight: 520,
  },
  bodyContent: {
    padding: 16,
    gap: 14,
  },
  listenBanner: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listenBannerActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#22C55E',
  },
  listenLeft: {
    flex: 1,
  },
  listenText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803D',
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  stopBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  presetsCol: {
    gap: 6,
  },
  presetsLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  presetsRow: {
    gap: 6,
  },
  presetChip: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChipActive: {
    backgroundColor: '#2D5A27',
    borderColor: '#2D5A27',
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  resCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  resTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sourceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  confPill: {
    backgroundColor: '#DCFCE7',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  confText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  verdictText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
    lineHeight: 18,
  },
  detailsText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  actionBox: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 3,
    borderLeftColor: '#2D5A27',
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  actionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
  actionBody: {
    fontSize: 12,
    color: '#1E293B',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  listenBtn: {
    flex: 1,
    backgroundColor: '#2D5A27',
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  waBtn: {
    flex: 1,
    backgroundColor: '#25D366',
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
  },
  mainMicBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2D5A27',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainMicBtnActive: {
    backgroundColor: '#DC2626',
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  textInput: {
    flex: 1,
    fontSize: 12,
    color: '#1E293B',
    paddingVertical: 6,
  },
  sendBtn: {
    backgroundColor: '#2D5A27',
    padding: 6,
    borderRadius: 14,
  },
});
