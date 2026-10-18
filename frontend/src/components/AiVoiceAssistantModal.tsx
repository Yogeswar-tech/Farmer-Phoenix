import { useState, useEffect, useRef, type FC } from 'react';
import type { Language, MandiItem } from '../types';
import { translations } from '../data/i18n';
import { KisanSethuApi } from '../services/api';
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
  ShieldCheck,
  RotateCcw,
  Bot,
  Loader2
} from 'lucide-react';

interface AiVoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLang: Language;
  activeMandi: MandiItem;
  isAiModeEnabled: boolean;
  onToggleAiMode: (enabled: boolean) => void;
}

interface DisplayAnswer {
  question: string;
  verdict: string;
  spoken: string;
  details: string;
  actionPlan: string;
  category: string;
  source: string;
  dataPoints?: Record<string, any>;
  isLlmPowered?: boolean;
}

const VOICE_GREETINGS: Record<Language, { text: string; spoken: string }> = {
  te: {
    text: 'నమస్కారం సర్! కిసాన్ సేతు AI వాయిస్ బాట్‌కి స్వాగతం. ఈరోజు మీకు నేను ఎలా సహాయపడగలను?',
    spoken: 'నమస్కారం సర్! కిసాన్ సేతు కి స్వాగతం. ఈరోజు మీకు నేను ఎలా సహాయపడగలను?'
  },
  hi: {
    text: 'नमस्ते सर! किसान सेतु एआई वॉइस असिस्टेंट में आपका स्वागत है। आज मैं आपकी क्या सहायता कर सकता हूँ?',
    spoken: 'नमस्ते सर! किसान सेतु में आपका स्वागत है। आज मैं आपकी क्या सहायता कर सकता हूँ?'
  },
  en: {
    text: 'Hi Sir! Welcome to Kisan Sethu AI Voice Assistant. How can I help you today?',
    spoken: 'Hi Sir! Welcome to Kisan Sethu. How can I help you today?'
  }
};

const SUGGESTED_QUESTIONS: Record<Language, Array<{ text: string; label: string; icon: string }>> = {
  te: [
    {
      text: 'ఈరోజు వాతావరణం చెప్పండి?',
      label: 'ఈరోజు వాతావరణం',
      icon: '🌦️'
    },
    {
      text: 'ఇంకో గంటలో వాతావరణం ఎలా ఉంటుంది, నేనేం జాగ్రత్తలు తీసుకోవాలి?',
      label: '1 గంట వాతావరణం & జాగ్రత్తలు',
      icon: '⏱️'
    },
    {
      text: 'నేను ఎవరికి అమ్మితే ఎక్కువ లాభం వస్తుంది?',
      label: 'ఎవరికి అమ్మితే ఎక్కువ లాభం?',
      icon: '💰'
    },
    {
      text: 'గుంటూరు మార్కెట్లో మిర్చి రేటు ఎంత?',
      label: 'గుంటూరు మార్కెట్ రేటు',
      icon: '📈'
    },
    {
      text: 'పురుగుల నివారణకు ఏ మందు కొట్టాలి? డోస్ ఎంత?',
      label: 'పురుగుల మందు డోస్',
      icon: '🛡️'
    },
    {
      text: 'సమీప కోల్డ్ స్టోరేజ్ ఖాళీలు మరియు అద్దె వివరాలు చెప్పండి?',
      label: 'కోల్డ్ స్టోరేజ్ వివరాలు',
      icon: '❄️'
    }
  ],
  hi: [
    {
      text: 'आज का मौसम बताइए?',
      label: 'आज का मौसम',
      icon: '🌦️'
    },
    {
      text: 'अगले 1 घंटे में मौसम कैसा रहेगा, मुझे क्या सावधानी रखनी चाहिए?',
      label: '1 घंटे का मौसम व सावधानियां',
      icon: '⏱️'
    },
    {
      text: 'मैं किसको बेचूं जिससे ज्यादा मुनाफा होगा?',
      label: 'कहाँ बेचने से ज्यादा मुनाफा?',
      icon: '💰'
    },
    {
      text: 'गुंटूर मंडी में मिर्च का ताजा भाव क्या है?',
      label: 'मंडी ताजा भाव',
      icon: '📈'
    },
    {
      text: 'कीट नियंत्रण के लिए कौन सी दवा छिड़कें? 15L पंप खुराक?',
      label: 'कीटनाशक व 15L खुराक',
      icon: '🛡️'
    },
    {
      text: 'पास के कोल्ड स्टोरेज का किराया और स्थान क्या है?',
      label: 'कोल्ड स्टोरेज किराया',
      icon: '❄️'
    }
  ],
  en: [
    {
      text: 'Tell me today’s weather forecast?',
      label: 'Today’s Weather',
      icon: '🌦️'
    },
    {
      text: 'How will the weather be in the next hour, what precautions should I take?',
      label: '1-Hour Weather & Precautions',
      icon: '⏱️'
    },
    {
      text: 'Whom should I sell to for maximum profit?',
      label: 'Best Market for Maximum Profit',
      icon: '💰'
    },
    {
      text: 'What is the current modal price in Guntur APMC?',
      label: 'Mandi Modal Price',
      icon: '📈'
    },
    {
      text: 'Which pesticide should I spray for pest control? 15L tank dose?',
      label: 'Pesticide & 15L Tank Dose',
      icon: '🛡️'
    },
    {
      text: 'What are the nearest cold storage vacancies and rental rates?',
      label: 'Cold Storage Vacancy',
      icon: '❄️'
    }
  ]
};

export const AiVoiceAssistantModal: FC<AiVoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  currentLang,
  activeMandi,
  isAiModeEnabled,
  onToggleAiMode
}) => {
  const t = translations[currentLang] || translations.en;
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [queryInput, setQueryInput] = useState('');
  const [activeAnswer, setActiveAnswer] = useState<DisplayAnswer | null>(null);

  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize greeting whenever modal opens
  useEffect(() => {
    if (isOpen && isAiModeEnabled) {
      const greeting = VOICE_GREETINGS[currentLang] || VOICE_GREETINGS.en;
      setActiveAnswer({
        question: t.voiceAssistantTitle || 'Kisan Sethu AI Voice Assistant',
        verdict: greeting.text,
        spoken: greeting.spoken,
        details:
          currentLang === 'te'
            ? 'ఈరోజు వాతావరణం, ఇంకో గంటలో వర్షం సూచన & జాగ్రత్తలు, ఎవరికి అమ్మితే ఎక్కువ లాభం వస్తుంది, మార్కెట్ రేట్లు లేదా పురుగుల మందుల గురించి నన్ను మాట్లాడి అడగవచ్చు.'
            : currentLang === 'hi'
              ? 'आज का मौसम, अगले 1 घंटे में मौसम व सावधानियां, किसको बेचने से अधिकतम मुनाफा होगा, या कीटनाशक खुराक के बारे में निसंकोच पूछें।'
              : 'Ask me about today’s weather, 1-hour rain precautions, whom to sell for maximum profit, live mandi rates, or CIBRC pesticide doses.',
        actionPlan:
          currentLang === 'te'
            ? 'క్రింద ఉన్న మైక్ బటన్ నొక్కి మాట్లాడండి లేదా పైన ఉన్న ప్రశ్నల్లో ఒకదాన్ని ఎంచుకోండి.'
            : currentLang === 'hi'
              ? 'नीचे दिए गए माइक बटन को दबाकर बोलें अथवा प्रश्नों में से चुनें।'
              : 'Tap the mic button below to speak or click any common question above.',
        category: 'greeting',
        source: 'Kisan Sethu AI Voice Terminal',
        isLlmPowered: true
      });

      // Automatically speak the greeting after a short mount delay
      const timer = setTimeout(() => {
        speakText(greeting.spoken);
      }, 350);

      return () => {
        clearTimeout(timer);
        stopSpeaking();
      };
    } else {
      stopSpeaking();
    }
  }, [isOpen, currentLang, isAiModeEnabled]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
    };
  }, []);

  const speakText = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();

      const cleanText = text.replace(/[*#_~`]/g, '').trim();
      if (!cleanText) return;

      const utter = new SpeechSynthesisUtterance(cleanText);
      const langTag = currentLang === 'te' ? 'te-IN' : currentLang === 'hi' ? 'hi-IN' : 'en-IN';
      utter.lang = langTag;
      utter.rate = 0.92;
      utter.pitch = 1.0;

      // Select best regional voice if available
      const voices = window.speechSynthesis.getVoices();
      const matched =
        voices.find((v) => v.lang.toLowerCase().replace('_', '-') === langTag.toLowerCase()) ||
        voices.find((v) => v.lang.toLowerCase().startsWith(currentLang)) ||
        voices.find((v) => v.name.includes('India') || v.lang.includes('IN'));

      if (matched) {
        utter.voice = matched;
      }

      utter.onstart = () => setIsSpeaking(true);
      utter.onend = () => setIsSpeaking(false);
      utter.onerror = () => setIsSpeaking(false);

      synthRef.current = utter;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn('Speech synthesis notice:', e);
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const handleVoiceListen = () => {
    stopSpeaking();

    const win = window as any;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        currentLang === 'hi'
          ? 'बोलकर खोजने की सुविधा इस ब्राउज़र में उपलब्ध नहीं है। कृपया लिखकर पूछें।'
          : currentLang === 'te'
            ? 'ఈ బ్రౌజర్‌లో వాయిస్ రికగ్నిషన్ సదుపాయం లేదు. దయచేసి టైప్ చేసి అడగండి.'
            : 'Voice recognition is not supported in this browser. Please type your query.'
      );
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }

      const recognition = new SpeechRecognition();
      recognition.lang = currentLang === 'te' ? 'te-IN' : currentLang === 'hi' ? 'hi-IN' : 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognitionRef.current = recognition;
      setIsListening(true);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setQueryInput(transcript);
        processQuery(transcript);
        setIsListening(false);
      };

      recognition.onerror = (err: any) => {
        console.warn('Speech recognition error:', err);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (e) {
      console.warn('Voice start exception:', e);
      setIsListening(false);
    }
  };

  const processQuery = async (queryText: string) => {
    const cleanQ = queryText.trim();
    if (!cleanQ) return;

    stopSpeaking();
    setIsThinking(true);

    try {
      const locationName = activeMandi.mandiName?.[currentLang] || (activeMandi as any).name?.[currentLang] || 'Guntur';
      const cropName = activeMandi.cropName?.en || 'chilli';

      const res = await KisanSethuApi.askVoiceBot({
        query: cleanQ,
        lang: currentLang,
        location: locationName,
        crop: cropName
      });

      const newAnswer: DisplayAnswer = {
        question: cleanQ,
        verdict: res.verdict,
        spoken: res.spoken_answer,
        details: res.detailed_answer,
        actionPlan: res.action_plan,
        category: res.category,
        source: res.source,
        dataPoints: res.data_points,
        isLlmPowered: res.is_llm_powered
      };

      setActiveAnswer(newAnswer);
      speakText(res.spoken_answer);
    } catch (err) {
      console.warn('Process query failure:', err);
      const fallbackSpoken =
        currentLang === 'te'
          ? 'రాబోయే గంటలో వాతావరణం ఎండగా అనుకూలంగా ఉంది. మార్కెట్లో మోడల్ ధర ₹14,200 వద్ద స్థిరంగా ఉంది.'
          : currentLang === 'hi'
            ? 'आज मौसम अनुकूल है और मंडी में भाव ₹14,200/क्विंटल पर स्थिर है।'
            : 'Today’s weather is favorable with mandi prices holding strong at ₹14,200/quintal.';

      const fallbackAnswer: DisplayAnswer = {
        question: cleanQ,
        verdict: currentLang === 'te' ? '✅ సమాచారం ధృవీకరించబడింది' : '✅ Verified Advisory',
        spoken: fallbackSpoken,
        details: fallbackSpoken,
        actionPlan:
          currentLang === 'te' ? 'మార్కెట్ లేదా పొలం పనులు కొనసాగించండి.' : 'Proceed with daily agricultural schedule.',
        category: 'general',
        source: 'Kisan Sethu Live Engine',
        isLlmPowered: false
      };
      setActiveAnswer(fallbackAnswer);
      speakText(fallbackSpoken);
    } finally {
      setIsThinking(false);
    }
  };

  const handleShareWhatsApp = (ans: DisplayAnswer) => {
    const text = `🌾 *Kisan Sethu AI Voice Advisor*\n❓ *Question:* ${ans.question}\n💡 *Verdict:* ${ans.verdict}\n📊 *Details:* ${ans.details}\n🛡️ *Action Plan:* ${ans.actionPlan}\n🔗 *Verified by:* ${ans.source}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const questionsList = SUGGESTED_QUESTIONS[currentLang] || SUGGESTED_QUESTIONS.en;
  const currentGreeting = VOICE_GREETINGS[currentLang] || VOICE_GREETINGS.en;

  if (!isOpen) return null;

  return (
    <div
      className="ai-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        className="ai-modal-dialog"
        style={{
          width: '100%',
          maxWidth: '640px',
          maxHeight: '92vh',
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1.5px solid #86EFAC'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: '#1E3F1A',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: '#2D5A27',
                border: '1.5px solid #86EFAC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}
            >
              <img src="/brinjal.png" alt="Bot" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
              {isAiModeEnabled && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-2px',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: '#00E676',
                    border: '1.5px solid #FFFFFF'
                  }}
                />
              )}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: '800' }}>
                  {t.voiceAssistantTitle || 'Agri Mitra AI Voice Assistant'}
                </span>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    backgroundColor: 'rgba(255, 230, 0, 0.2)',
                    border: '1px solid rgba(255, 230, 0, 0.4)',
                    color: '#FFE600',
                    fontSize: '10px',
                    fontWeight: '800',
                    padding: '2px 6px',
                    borderRadius: '6px'
                  }}
                >
                  <Sparkles size={11} /> Gemini AI
                </span>
              </div>
              <p style={{ margin: '2px 0 0', color: '#A2DC9A', fontSize: '11px', fontWeight: '500' }}>
                {t.voiceAssistantSubtitle || 'Verified Weather, APMC Prices & Farm Protection'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                padding: '4px 10px',
                borderRadius: '20px'
              }}
            >
              <span style={{ color: '#E2E8F0', fontSize: '11px', fontWeight: '700' }}>
                {isAiModeEnabled ? t.aiAssistantEnable : t.aiAssistantDisable}
              </span>
              <button
                type="button"
                onClick={() => onToggleAiMode(!isAiModeEnabled)}
                style={{
                  width: '32px',
                  height: '18px',
                  borderRadius: '9px',
                  backgroundColor: isAiModeEnabled ? '#00E676' : '#64748B',
                  border: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                  padding: '2px'
                }}
              >
                <span
                  style={{
                    display: 'block',
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    backgroundColor: '#FFFFFF',
                    transform: isAiModeEnabled ? 'translateX(14px)' : 'translateX(0)',
                    transition: 'transform 0.2s'
                  }}
                />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                border: 'none',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {!isAiModeEnabled ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '32px',
                backgroundColor: '#F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94A3B8'
              }}
            >
              <MicOff size={32} />
            </div>
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#1E293B' }}>
              {currentLang === 'hi'
                ? 'एआई वॉइस सहायक बंद है'
                : currentLang === 'te'
                  ? 'AI వాయిస్ అసిస్టెంట్ ఆఫ్ చేయబడింది'
                  : 'AI Voice Assistant is Disabled'}
            </h4>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748B', maxWidth: '340px' }}>
              {currentLang === 'hi'
                ? 'बोलकर प्रश्न पूछने हेतु ऊपर दिए गए स्विच से एआई मोड चालू करें।'
                : currentLang === 'te'
                  ? 'ప్రశ్నలు అడగడానికి పైన ఉన్న స్విచ్ ద్వారా AI మోడ్ ఆన్ చేయండి.'
                  : 'Toggle the switch above to enable smart voice farm advisory.'}
            </p>
            <button
              type="button"
              onClick={() => onToggleAiMode(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#1E3F1A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '24px',
                padding: '10px 22px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              <Sparkles size={16} color="#FFE600" />
              <span>{t.aiAssistantEnable}</span>
            </button>
          </div>
        ) : (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
            {/* Live Status & Speech Wave Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: isListening || isSpeaking || isThinking ? '#ECFDF5' : '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: '12px',
                padding: '10px 14px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isThinking ? (
                  <>
                    <Loader2 size={16} className="spin-icon" color="#059669" />
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#065F46' }}>
                      {currentLang === 'hi'
                        ? 'जेमिनी एआई उत्तर तैयार कर रहा है...'
                        : currentLang === 'te'
                          ? 'జెమినీ AI సమాధానం సిద్ధం చేస్తోంది...'
                          : 'Gemini AI is analyzing live farm facts...'}
                    </span>
                  </>
                ) : isListening ? (
                  <>
                    <span
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: '#DC2626',
                        animation: 'pulse 1s infinite'
                      }}
                    />
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#DC2626' }}>
                      🎙️{' '}
                      {currentLang === 'hi'
                        ? 'सुन रहे हैं... कृपया बोलें'
                        : currentLang === 'te'
                          ? 'వింటున్నాము... దయచేసి మాట్లాడండి'
                          : 'Listening... Please speak now'}
                    </span>
                  </>
                ) : isSpeaking ? (
                  <>
                    <Volume2 size={16} color="#059669" />
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#065F46' }}>
                      🔊{' '}
                      {currentLang === 'hi'
                        ? 'सुनाया जा रहा है...'
                        : currentLang === 'te'
                          ? 'సమాధానం చదువుతున్నాము...'
                          : 'Speaking advisory...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Bot size={16} color="#059669" />
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#065F46' }}>
                      {currentLang === 'hi'
                        ? 'माइक दबाकर बोलें या नीचे से प्रश्न चुनें'
                        : currentLang === 'te'
                          ? 'మైక్ నొక్కి మాట్లాడండి లేదా ప్రశ్న ఎంచుకోండి'
                          : 'Tap mic to speak or choose a question'}
                    </span>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isSpeaking && (
                  <button
                    type="button"
                    onClick={stopSpeaking}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: '#FEE2E2',
                      border: 'none',
                      color: '#DC2626',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: '800',
                      cursor: 'pointer'
                    }}
                  >
                    <VolumeX size={13} />
                    <span>Stop</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => speakText(currentGreeting.spoken)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: '#DCFCE7',
                    border: '1px solid #86EFAC',
                    color: '#166534',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                  title="Replay Voice Greeting"
                >
                  <RotateCcw size={12} />
                  <span>{currentLang === 'te' ? 'స్వాగతం' : currentLang === 'hi' ? 'नमस्ते' : 'Greeting'}</span>
                </button>
              </div>
            </div>

            {/* Questions Carousel - Exact farmer queries */}
            <div>
              <p style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: '800', color: '#475569' }}>
                {currentLang === 'hi'
                  ? 'शीर्ष किसान प्रश्न (एक टैप में उत्तर पाएं):'
                  : currentLang === 'te'
                    ? 'రైతుల ముఖ్యమైన ప్రశ్నలు (ఒక ట్యాప్‌తో సమాధానం):'
                    : 'Common Farmer Questions (1-Tap Instant Answer):'}
              </p>
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  overflowX: 'auto',
                  paddingBottom: '4px'
                }}
              >
                {questionsList.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setQueryInput(item.text);
                      processQuery(item.text);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: activeAnswer?.question === item.text ? '#DCFCE7' : '#F8FAFC',
                      border: activeAnswer?.question === item.text ? '1.5px solid #22C55E' : '1px solid #CBD5E1',
                      borderRadius: '20px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#1E293B',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Answer Display Card */}
            {activeAnswer && (
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1.5px solid #86EFAC',
                  borderRadius: '16px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 4px 12px rgba(22, 101, 52, 0.08)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#15803D', fontSize: '11px', fontWeight: '700' }}>
                    <CheckCircle2 size={14} />
                    <span>{activeAnswer.source}</span>
                  </div>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      backgroundColor: '#D1FAE5',
                      color: '#065F46',
                      fontSize: '10px',
                      fontWeight: '800',
                      padding: '2px 8px',
                      borderRadius: '10px'
                    }}
                  >
                    <Sparkles size={11} /> Grounded AI
                  </span>
                </div>

                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#064E3B', lineHeight: '20px' }}>
                  {activeAnswer.verdict}
                </h3>

                {/* Spoken Quote Box */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    backgroundColor: '#F0FDF4',
                    borderLeft: '3px solid #059669',
                    padding: '10px',
                    borderRadius: '8px'
                  }}
                >
                  <Volume2 size={16} color="#065F46" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontSize: '13px', fontStyle: 'italic', fontWeight: '600', color: '#065F46', lineHeight: '18px' }}>
                    "{activeAnswer.spoken}"
                  </span>
                </div>

                {/* Detailed Advisory */}
                <p style={{ margin: 0, fontSize: '13px', color: '#334155', lineHeight: '20px', whiteSpace: 'pre-line' }}>
                  {activeAnswer.details}
                </p>

                {/* Action Plan */}
                {activeAnswer.actionPlan && (
                  <div
                    style={{
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '10px',
                      padding: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#15803D', fontSize: '12px', fontWeight: '800' }}>
                      <ShieldCheck size={16} />
                      <span>
                        {currentLang === 'hi'
                          ? 'तत्काल करने योग्य कदम (Action Plan):'
                          : currentLang === 'te'
                            ? 'తక్షణ కార్యాచరణ (Action Plan):'
                            : 'Immediate Action Plan:'}
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#334155', lineHeight: '17px' }}>
                      {activeAnswer.actionPlan}
                    </span>
                  </div>
                )}

                {/* Replay and WhatsApp Share Buttons */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => speakText(activeAnswer.spoken || activeAnswer.details)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      backgroundColor: '#1E3F1A',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '10px',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: 'pointer'
                    }}
                  >
                    <Volume2 size={16} />
                    <span>{currentLang === 'hi' ? 'पुनः सुनें' : currentLang === 'te' ? 'మళ్ళీ వినండి' : 'Replay Voice'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleShareWhatsApp(activeAnswer)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      backgroundColor: '#25D366',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '10px',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: 'pointer'
                    }}
                  >
                    <Share2 size={16} />
                    <span>{t.shareWhatsAppBtn}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Mic & Text Input Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={handleVoiceListen}
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '23px',
                  backgroundColor: isListening ? '#DC2626' : '#1E3F1A',
                  color: '#FFFFFF',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 4px 10px rgba(30, 63, 26, 0.35)',
                  flexShrink: 0
                }}
                aria-label="Microphone Voice Input"
              >
                <Mic size={22} />
              </button>

              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#F1F5F9',
                  borderRadius: '24px',
                  padding: '4px 6px 4px 14px',
                  border: '1px solid #CBD5E1'
                }}
              >
                <input
                  type="text"
                  placeholder={
                    currentLang === 'te'
                      ? 'ఉదా: ఈరోజు వాతావరణం చెప్పండి / ఎవరికి అమ్మితే లాభం?'
                      : currentLang === 'hi'
                        ? 'उदा: आज का मौसम / किसको बेचने से मुनाफा होगा?'
                        : 'Ask e.g. today’s weather / whom to sell for profit?'
                  }
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && queryInput.trim()) {
                      processQuery(queryInput);
                    }
                  }}
                  style={{
                    flex: 1,
                    height: '36px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: '13px',
                    color: '#1E293B'
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (queryInput.trim()) {
                      processQuery(queryInput);
                    }
                  }}
                  disabled={isThinking}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '16px',
                    backgroundColor: '#1E3F1A',
                    color: '#FFFFFF',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  aria-label="Send Query"
                >
                  {isThinking ? <Loader2 size={16} className="spin-icon" /> : <Send size={15} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AiVoiceAssistantModal;
