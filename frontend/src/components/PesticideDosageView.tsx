import { useState, useEffect, useRef, type FC, type FormEvent } from 'react';
import type { Language, LocationOption } from '../types';
import { translations } from '../data/i18n';
import { KisanSethuApi } from '../services/api';
import {
  FlaskConical,
  ShieldAlert,
  AlertTriangle,
  Search,
  CheckCircle2,
  XCircle,
  Volume2,
  VolumeX,
  Loader2,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Check,
  Info,
  Bot,
  Send,
  Bug,
  Sprout,
  HelpCircle,
  Flame
} from 'lucide-react';

interface PesticideDosageViewProps {
  currentLang: Language;
  currentLocation?: LocationOption;
}

export const PesticideDosageView: FC<PesticideDosageViewProps> = ({ currentLang, currentLocation }) => {
  const t = translations[currentLang] || translations.en;

  // View Mode: 'crop_first' | 'pesticide_search' | 'gemini_rag'
  const [activeTab, setActiveTab] = useState<'crop_first' | 'pesticide_search' | 'gemini_rag'>('crop_first');

  // --- 1. Crop-First State ---
  const [cropSearchInput, setCropSearchInput] = useState('');
  const [selectedCropCategory, setSelectedCropCategory] = useState<string>('all');
  const [cropList, setCropList] = useState<any[]>([]);
  const [isSearchingCrops, setIsSearchingCrops] = useState(false);
  const [selectedCrop, setSelectedCrop] = useState<any | null>(null);

  // CIBRC Presets Data (from PostgreSQL cibrc_pesticide_registry)
  const [cibrcPresets, setCibrcPresets] = useState<any | null>(null);
  const [isLoadingPresets, setIsLoadingPresets] = useState(false);
  const [activePesticideCategory, setActivePesticideCategory] = useState<string>('ALL');

  // --- 2. Specific Pesticide Search & Suitability State ---
  const [pesticideSearchInput, setPesticideSearchInput] = useState('Chlorantraniliprole');
  const [pesticideSearchResults, setPesticideSearchResults] = useState<any[]>([]);
  const [isSearchingPesticides, setIsSearchingPesticides] = useState(false);
  const [showPesticideSuggestions, setShowPesticideSuggestions] = useState(false);
  const [selectedPesticideRecord, setSelectedPesticideRecord] = useState<any | null>(null);
  const [suitabilityCropInput, setSuitabilityCropInput] = useState('Tomato');
  const [cibrcSuitabilityResult, setCibrcSuitabilityResult] = useState<any | null>(null);
  const [isLoadingSuitability, setIsLoadingSuitability] = useState(false);

  // Pump Calculator State
  const [tankLiters, setTankLiters] = useState<number>(15);
  const [acreArea, setAcreArea] = useState<number>(1);

  // --- 3. Gemini RAG AI Doctor State ---
  const [ragQuery, setRagQuery] = useState('');
  const [ragCrop, setRagCrop] = useState('Tomato');
  const [ragPesticide, setRagPesticide] = useState('Chlorantraniliprole');
  const [ragResult, setRagResult] = useState<any | null>(null);
  const [isSubmittingRag, setIsSubmittingRag] = useState(false);

  // Audio Voice Advisory (TTS)
  const [isSpeaking, setIsSpeaking] = useState(false);
  const pesticideSearchRef = useRef<HTMLDivElement>(null);

  // Default Quick Chips for Gemini RAG
  const quickRagPrompts = [
    {
      label: currentLang === 'hi' ? '🍅 टमाटर में फल छेदक की दवा व 15L खुराक?' : '🍅 Dose for fruit borer in tomato?',
      query: 'What is the approved CIBRC pesticide and 15-liter knapsack pump dosage for fruit borer in tomato?',
      crop: 'Tomato',
      pesticide: 'Chlorantraniliprole 18.50 % SC'
    },
    {
      label: currentLang === 'hi' ? '⚠️ क्या टमाटर या कपास पर 2,4-D डाल सकते हैं?' : '⚠️ Can I spray 2,4-D on tomato or cotton?',
      query: 'Is 2,4-D herbicide suitable or harmful for tomato or cotton? What happens if sprayed?',
      crop: 'Tomato',
      pesticide: '2,4-D'
    },
    {
      label: currentLang === 'hi' ? '🥭 आम में कल्टार (Paclobutrazol) का प्रयोग?' : '🥭 Paclobutrazol (Cultar) in mango?',
      query: 'When and how much Paclobutrazol should be applied for alternate bearing and flowering in mango?',
      crop: 'Mango',
      pesticide: 'Paclobutrazol 23% SC'
    },
    {
      label: currentLang === 'hi' ? '🌾 धान में तना छेदक व पत्ती लपेटक की दवा?' : '🌾 Paddy stem borer & leaf folder dose?',
      query: 'What are the approved pesticides and waiting periods for stem borer and leaf folder in paddy?',
      crop: 'Paddy',
      pesticide: 'Chlorantraniliprole'
    },
    {
      label: currentLang === 'hi' ? '🥔 आलू भंडारण में अंकुरण रोकने की दवा (CIPC)?' : '🥔 Anti-sprouting dose for potato storage?',
      query: 'What is the approved dose of Chlorpropham (CIPC) for anti-sprouting in cold storage potatoes?',
      crop: 'Potato',
      pesticide: 'Chlorpropham 50% HN'
    },
    {
      label: currentLang === 'hi' ? '🧪 ट्राइकोडर्मा विरिडी से मिर्च बीज उपचार कैसे करें?' : '🧪 Trichoderma seed treatment in chilli?',
      query: 'How to use Trichoderma viride bio-fungicide for damping off in chilli seedlings?',
      crop: 'Chilli',
      pesticide: 'Trichoderma viride 1.0% WP'
    }
  ];

  // 1. Initial Load of Master Crops from Database
  useEffect(() => {
    let isMounted = true;
    const fetchCrops = async () => {
      setIsSearchingCrops(true);
      try {
        const crops = await KisanSethuApi.searchCrops(cropSearchInput, selectedCropCategory, currentLang);
        if (isMounted) {
          setCropList(crops);
          if (!selectedCrop && crops.length > 0) {
            setSelectedCrop(crops[0]);
            setSuitabilityCropInput(crops[0].name_en || crops[0].name);
            setRagCrop(crops[0].name_en || crops[0].name);
          }
        }
      } catch (err) {
        console.warn('Crop load error:', err);
      } finally {
        if (isMounted) setIsSearchingCrops(false);
      }
    };

    const timer = setTimeout(fetchCrops, 180);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [cropSearchInput, selectedCropCategory, currentLang]);

  // 2. Fetch CIBRC Statutory Crop Presets from PostgreSQL
  useEffect(() => {
    if (!selectedCrop) return;
    let isMounted = true;
    const fetchCibrcPresets = async () => {
      setIsLoadingPresets(true);
      try {
        const cropKey = selectedCrop.crop_key || selectedCrop.name_en || 'tomato';
        const data = await KisanSethuApi.getCibrcCropPresets(cropKey);
        if (isMounted && data && data.status === 'success') {
          setCibrcPresets(data);
        }
      } catch (err) {
        console.warn('CIBRC presets fetch error:', err);
      } finally {
        if (isMounted) setIsLoadingPresets(false);
      }
    };
    fetchCibrcPresets();
    return () => {
      isMounted = false;
    };
  }, [selectedCrop]);

  // 3. Search Specific Pesticides in CIBRC Database
  useEffect(() => {
    if (!pesticideSearchInput.trim() || pesticideSearchInput.trim().length < 2) {
      setPesticideSearchResults([]);
      setShowPesticideSuggestions(false);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingPesticides(true);
      try {
        const results = await KisanSethuApi.searchCibrcPesticides(pesticideSearchInput.trim());
        setPesticideSearchResults(results);
        setShowPesticideSuggestions(results.length > 0);
      } catch (err) {
        console.warn('CIBRC pesticide search error:', err);
      } finally {
        setIsSearchingPesticides(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [pesticideSearchInput]);

  // 4. Auto-check Suitability when in Pesticide Search Tab
  const triggerSuitabilityCheck = async (pesticide: string, crop: string) => {
    if (!pesticide.trim() || !crop.trim()) return;
    setIsLoadingSuitability(true);
    try {
      const res = await KisanSethuApi.checkCibrcSuitability(pesticide.trim(), crop.trim());
      setCibrcSuitabilityResult(res);
    } catch (err) {
      console.warn('Suitability check error:', err);
    } finally {
      setIsLoadingSuitability(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'pesticide_search' && pesticideSearchInput && suitabilityCropInput) {
      triggerSuitabilityCheck(pesticideSearchInput, suitabilityCropInput);
    }
  }, [activeTab, suitabilityCropInput]);

  // 5. Handle Outside Click for Suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pesticideSearchRef.current && !pesticideSearchRef.current.contains(e.target as Node)) {
        setShowPesticideSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 6. Handle Gemini RAG Query Submit
  const handleExecuteRag = async (e?: FormEvent, customQuery?: string, customCrop?: string, customPest?: string) => {
    if (e) e.preventDefault();
    const queryToUse = customQuery || ragQuery;
    const cropToUse = customCrop || ragCrop;
    const pestToUse = customPest || ragPesticide;

    if (!queryToUse.trim()) return;

    setIsSubmittingRag(true);
    try {
      const res = await KisanSethuApi.askCibrcAiAdvisor(
        queryToUse,
        cropToUse || undefined,
        pestToUse || undefined,
        currentLang
      );
      if (res && res.status === 'success') {
        setRagResult(res);
      }
    } catch (err) {
      console.warn('RAG request error:', err);
    } finally {
      setIsSubmittingRag(false);
    }
  };

  // Audio Voice Advisory (TTS)
  const handlePlayVoice = (textToSpeak?: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert(currentLang === 'hi' ? 'आपके डिवाइस में वॉइस सुविधा उपलब्ध नहीं है।' : 'Speech synthesis is not supported on this device.');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    let message = textToSpeak;
    if (!message) {
      if (activeTab === 'gemini_rag' && ragResult?.advisory) {
        // Strip markdown asterisks and hash tags for clean audio
        message = ragResult.advisory.replace(/[*#`_>]/g, '');
      } else if (activeTab === 'pesticide_search' && cibrcSuitabilityResult) {
        message = `${cibrcSuitabilityResult.title}. ${cibrcSuitabilityResult.hazard_reason || cibrcSuitabilityResult.safety_warnings || ''}`;
      } else if (cibrcPresets) {
        const cropName = cibrcPresets.crop_title || selectedCrop?.name || 'आपकी फसल';
        message = currentLang === 'hi'
          ? `${cropName} के लिए केंद्रीय कीटनाशी बोर्ड द्वारा कुल ${cibrcPresets.total_registered_presets} दवाएं पंजीकृत हैं। कृपया 15 लीटर पंप की सही खुराक व प्रतीक्षा समय का पालन करें।`
          : `Total ${cibrcPresets.total_registered_presets} CIBRC statutory registered pesticides available for ${cropName}. Please follow exact 15 liter pump dosage and waiting period.`;
      }
    }

    if (!message) return;

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = currentLang === 'hi' ? 'hi-IN' : currentLang === 'te' ? 'te-IN' : 'en-IN';
    utterance.rate = 0.95;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Filter presets based on category selection
  const allPresetsList: any[] = [];
  if (cibrcPresets?.categories) {
    Object.keys(cibrcPresets.categories).forEach((cat) => {
      cibrcPresets.categories[cat].forEach((item: any) => {
        allPresetsList.push(item);
      });
    });
  }

  const displayedPresets = activePesticideCategory === 'ALL'
    ? allPresetsList
    : (cibrcPresets?.categories?.[activePesticideCategory] || []);

  const categories = [
    { id: 'all', label: t.allCropsCat || 'All Crops' },
    { id: 'vegetable', label: t.vegetablesCat || 'Vegetables' },
    { id: 'cereal', label: t.cerealsCat || 'Cereals' },
    { id: 'fruit', label: t.fruitsCat || 'Fruits' },
    { id: 'commercial', label: t.commercialCat || 'Commercial' },
    { id: 'pulse', label: t.pulsesCat || 'Pulses' }
  ];

  return (
    <div className="pesticide-dosage-container" style={{ maxWidth: '1280px', margin: '0 auto', padding: '16px' }}>
      {/* 1. Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #064E3B 100%)',
        color: '#FFFFFF',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '20px',
        boxShadow: '0 10px 25px -5px rgba(6, 78, 59, 0.3)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ background: 'rgba(255,255,255,0.15)', padding: '10px', borderRadius: '12px', display: 'flex' }}>
              <FlaskConical size={28} style={{ color: '#34D399' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: '#FFFFFF' }}>
                {t.cropPesticideDoctorTitle || 'CIBRC Statutory Pesticide Registry & Gemini RAG Doctor'}
              </h2>
              <span style={{ fontSize: '13px', color: '#A7F3D0', marginTop: '2px', display: 'block' }}>
                🏛️ Ministry of Agriculture & Farmers Welfare • DPPQS Central Insecticide Board Database
              </span>
            </div>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#E2E8F0', maxWidth: '780px', lineHeight: '1.5' }}>
            {currentLang === 'hi'
              ? 'भारत सरकार के आधिकारिक राजपत्र के आधार पर: अपनी फसल (टमाटर, धान, आम, आलू, मिर्च आदि) की अनुमोदित दवाएं, 15-लीटर स्प्रे पंप खुराक, तुड़ाई प्रतीक्षा अवधि (PHI) व हानिकारक रसायनों की रोकथाम जांचें।'
              : currentLang === 'te'
              ? 'భారత ప్రభుత్వ CIBRC గెజిట్ ఆధారంగా: మీ పంట (టమోటా, వరి, మామిడి, బంగాళాదుంప, మిర్చి) కోసం ఆమోదించిన పురుగుమందులు, 15-లీటర్ల పంపు మోతాదు మరియు రక్షణ సలహాలు పొందండి.'
              : 'Official statutory database registered under the Insecticides Act, 1968: Verified 15L Knapsack pump dosages, Pre-Harvest Intervals (PHI), phytotoxicity hazard checks, and Gemini-powered RAG AI.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => handlePlayVoice()}
            style={{
              background: isSpeaking ? '#DC2626' : '#F59E0B',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '999px',
              padding: '10px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)'
            }}
          >
            {isSpeaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
            <span>{isSpeaking ? (currentLang === 'hi' ? 'आवाज़ रोकें' : 'Stop Audio') : (currentLang === 'hi' ? '🔊 बोलकर सुनाएं' : currentLang === 'te' ? '🔊 సలహా వినండి' : '🔊 Listen Audio')}</span>
          </button>
        </div>
      </div>

      {/* 2. Top Navigation Tabs: [Crop Presets] | [Check Specific Pesticide] | [Gemini RAG AI Doctor] */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '20px',
        background: '#FFFFFF',
        padding: '8px',
        borderRadius: '14px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('crop_first')}
          style={{
            flex: 1,
            padding: '12px 14px',
            borderRadius: '10px',
            border: 'none',
            background: activeTab === 'crop_first' ? '#059669' : 'transparent',
            color: activeTab === 'crop_first' ? '#FFFFFF' : '#334155',
            fontSize: '14px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <span>🌾 {currentLang === 'hi' ? '1. फसल अनुसार दवाएं (Presets)' : currentLang === 'te' ? '1. పంటల వారీగా మందుల మోతాదు' : '1. Crop Food Presets'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pesticide_search')}
          style={{
            flex: 1,
            padding: '12px 14px',
            borderRadius: '10px',
            border: 'none',
            background: activeTab === 'pesticide_search' ? '#2563EB' : 'transparent',
            color: activeTab === 'pesticide_search' ? '#FFFFFF' : '#334155',
            fontSize: '14px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <Search size={16} />
          <span>{currentLang === 'hi' ? '2. दवा खोजें व नुकसान जांचें' : currentLang === 'te' ? '2. పురుగుమందు \u0026 హానికర తనిఖీ' : '2. Pesticide & Hazard Checker'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('gemini_rag')}
          style={{
            flex: 1,
            padding: '12px 14px',
            borderRadius: '10px',
            border: 'none',
            background: activeTab === 'gemini_rag' ? 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)' : 'transparent',
            color: activeTab === 'gemini_rag' ? '#FFFFFF' : '#334155',
            fontSize: '14px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <Bot size={18} style={{ color: activeTab === 'gemini_rag' ? '#FDE047' : '#7C3AED' }} />
          <span>{currentLang === 'hi' ? '3. CIBRC AI डॉक्टर (Gemini RAG)' : currentLang === 'te' ? '3. CIBRC AI డాక్టర్ (Gemini RAG)' : '3. Gemini RAG AI Doctor'}</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: CROP PRESETS WORKFLOW                                           */}
      {/* ===================================================================== */}
      {activeTab === 'crop_first' && (
        <div>
          {/* Crop Selector Card */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '20px',
            marginBottom: '20px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
          }}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Search size={16} style={{ color: '#059669' }} />
                <span>{currentLang === 'hi' ? 'अपनी फसल चुनें (टमाटर, धान, आम, आलू, मिर्च, कपास, गेहूं, अंगूर, सेब):' : 'Select Target Crop (Tomato, Paddy, Mango, Potato, Chilli, Cotton, Wheat, Grapes, Apple):'}</span>
              </label>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: '#F8FAFC',
                border: '1.5px solid #CBD5E1',
                borderRadius: '12px',
                padding: '0 14px'
              }}>
                <Search size={18} style={{ color: '#64748B', marginRight: '10px' }} />
                <input
                  type="text"
                  value={cropSearchInput}
                  onChange={(e) => setCropSearchInput(e.target.value)}
                  placeholder={currentLang === 'hi' ? 'फसल का नाम लिखें (उदा. टमाटर, धान, आलू, आम, मिर्च)...' : 'Filter crops (e.g. Tomato, Paddy, Mango, Potato, Chilli)...'}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    padding: '12px 0',
                    fontSize: '14px',
                    color: '#0F172A',
                    outline: 'none',
                    fontWeight: '600'
                  }}
                />
                {isSearchingCrops && <Loader2 size={16} className="spin-icon" style={{ color: '#059669' }} />}
              </div>
            </div>

            {/* Quick Crops Chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {[
                { key: 'tomato', name: 'Tomato (टमाटर)', icon: '🍅' },
                { key: 'paddy', name: 'Paddy / Rice (धान)', icon: '🌾' },
                { key: 'mango', name: 'Mango (आम)', icon: '🥭' },
                { key: 'potato', name: 'Potato (आलू)', icon: '🥔' },
                { key: 'chilli', name: 'Chilli (मिर्च)', icon: '🌶️' },
                { key: 'cotton', name: 'Cotton (कपास)', icon: '🌱' },
                { key: 'wheat', name: 'Wheat (गेहूं)', icon: '🌾' },
                { key: 'grapes', name: 'Grapes (अंगूर)', icon: '🍇' },
                { key: 'apple', name: 'Apple (सेब)', icon: '🍎' }
              ].map((c) => {
                const isSelected = (selectedCrop?.crop_key || '').toLowerCase() === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => {
                      setSelectedCrop({ crop_key: c.key, name_en: c.name, name: c.name, icon: c.icon });
                      setSuitabilityCropInput(c.name.split(' ')[0]);
                      setRagCrop(c.name.split(' ')[0]);
                    }}
                    style={{
                      background: isSelected ? '#059669' : '#F1F5F9',
                      color: isSelected ? '#FFFFFF' : '#1E293B',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '8px 14px',
                      fontSize: '13px',
                      fontWeight: isSelected ? '800' : '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s',
                      boxShadow: isSelected ? '0 4px 10px rgba(5, 150, 105, 0.3)' : 'none'
                    }}
                  >
                    <span>{c.icon}</span>
                    <span>{c.name}</span>
                    {isSelected && <Check size={14} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Presets Header Banner */}
          {selectedCrop && (
            <div style={{
              background: '#F0FDF4',
              borderLeft: '5px solid #059669',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '32px' }}>{selectedCrop.icon || '🌱'}</span>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#064E3B', margin: 0 }}>
                    {selectedCrop.name || selectedCrop.name_en} — Official CIBRC Statutory Presets
                  </h3>
                  <span style={{ fontSize: '12px', color: '#047857' }}>
                    Registered under the Insecticides Act, 1968 (Govt of India Gazette)
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{
                  background: '#DCFCE7',
                  color: '#166534',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '800'
                }}>
                  ✅ {cibrcPresets?.total_registered_presets || 0} Registered Molecules
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('gemini_rag');
                    setRagCrop(selectedCrop.name_en || selectedCrop.crop_key);
                    handleExecuteRag(undefined, `What are the best CIBRC approved pesticide presets for ${selectedCrop.name_en}?`, selectedCrop.name_en);
                  }}
                  style={{
                    background: '#4F46E5',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Bot size={13} />
                  <span>Ask AI Doctor</span>
                </button>
              </div>
            </div>
          )}

          {/* Category Filter Chips for Crop Presets */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '16px' }}>
            {[
              { id: 'ALL', label: `🌟 All Presets (${allPresetsList.length})` },
              { id: 'INSECTICIDE', label: `🐛 Insecticides (${cibrcPresets?.categories?.['INSECTICIDE']?.length || 0})` },
              { id: 'FUNGICIDE', label: `🍄 Fungicides (${cibrcPresets?.categories?.['FUNGICIDE']?.length || 0})` },
              { id: 'HERBICIDE', label: `🌿 Herbicides (${cibrcPresets?.categories?.['HERBICIDE']?.length || 0})` },
              { id: 'PGR', label: `🌾 Plant Growth Regulators (${cibrcPresets?.categories?.['PGR']?.length || 0})` },
              { id: 'BIO-PESTICIDE', label: `🧪 Bio-Pesticides (${cibrcPresets?.categories?.['BIO-PESTICIDE']?.length || 0})` }
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActivePesticideCategory(cat.id)}
                style={{
                  background: activePesticideCategory === cat.id ? '#059669' : '#FFFFFF',
                  color: activePesticideCategory === cat.id ? '#FFFFFF' : '#334155',
                  border: activePesticideCategory === cat.id ? 'none' : '1px solid #CBD5E1',
                  borderRadius: '999px',
                  padding: '7px 16px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s'
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Presets Cards Grid */}
          {isLoadingPresets ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
              <Loader2 size={36} className="spin-icon" style={{ color: '#059669' }} />
            </div>
          ) : displayedPresets.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
              {displayedPresets.map((preset: any) => {
                const toxColor = preset.toxicity_band === 'red'
                  ? '#EF4444'
                  : preset.toxicity_band === 'yellow'
                  ? '#F59E0B'
                  : preset.toxicity_band === 'blue'
                  ? '#3B82F6'
                  : preset.toxicity_band === 'bio'
                  ? '#10B981'
                  : '#10B981';

                return (
                  <div
                    key={preset.id}
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '16px',
                      border: '1px solid #E2E8F0',
                      padding: '18px',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      position: 'relative'
                    }}
                  >
                    <div>
                      {/* Top Category Badge & Waiting Period */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '800',
                          textTransform: 'uppercase',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: '#F1F5F9',
                          color: '#475569'
                        }}>
                          {preset.category}
                        </span>

                        <span style={{
                          fontSize: '11px',
                          fontWeight: '800',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: '#FEF3C7',
                          color: '#92400E'
                        }}>
                          ⏳ PHI: {preset.waiting_period_days || 'N/A'}
                        </span>
                      </div>

                      {/* Molecule Name */}
                      <h4 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: '0 0 4px' }}>
                        {preset.pesticide_name}
                      </h4>
                      <span style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '10px' }}>
                        Active: {preset.active_ingredient} {preset.formulation ? `(${preset.formulation})` : ''}
                      </span>

                      {/* Target Pest Box */}
                      <div style={{
                        background: '#F8FAFC',
                        borderRadius: '8px',
                        padding: '10px',
                        marginBottom: '12px',
                        borderLeft: '3px solid #64748B'
                      }}>
                        <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '700', display: 'block', marginBottom: '2px' }}>
                          🎯 Target Pest / Disease:
                        </span>
                        <strong style={{ fontSize: '12px', color: '#1E293B', lineHeight: '1.4', display: 'block' }}>
                          {preset.target_pest_or_disease}
                        </strong>
                      </div>

                      {/* 15L Knapsack Pump Dosage Highlight Box */}
                      <div style={{
                        background: '#ECFDF5',
                        borderRadius: '10px',
                        padding: '10px 12px',
                        marginBottom: '12px',
                        border: '1.5px solid #A7F3D0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div>
                          <span style={{ fontSize: '11px', color: '#065F46', fontWeight: '700', display: 'block' }}>
                            💧 15-Liter Pump Dose:
                          </span>
                          <strong style={{ fontSize: '14px', color: '#064E3B' }}>
                            {preset.pump_dose_15l || 'Refer to label'}
                          </strong>
                        </div>
                        <span style={{ fontSize: '20px' }}>🎒</span>
                      </div>

                      {/* Dose per hectare & Dilution */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px', fontSize: '11px' }}>
                        <div style={{ background: '#F1F5F9', padding: '6px 8px', borderRadius: '6px' }}>
                          <span style={{ color: '#64748B', display: 'block' }}>Dose / Hectare:</span>
                          <strong style={{ color: '#0F172A' }}>{preset.formulation_dose || 'N/A'}</strong>
                        </div>
                        <div style={{ background: '#F1F5F9', padding: '6px 8px', borderRadius: '6px' }}>
                          <span style={{ color: '#64748B', display: 'block' }}>Water Dilution:</span>
                          <strong style={{ color: '#0F172A' }}>{preset.dilution_water_liters || '500 L'}</strong>
                        </div>
                      </div>

                      {/* Safety advice */}
                      {preset.safety_warnings && (
                        <p style={{ margin: '0 0 12px', fontSize: '11px', color: '#475569', lineHeight: '1.4' }}>
                          💡 <strong>Advice:</strong> {preset.safety_warnings}
                        </p>
                      )}
                    </div>

                    {/* Bottom Triangle Badge & CIBRC Link */}
                    <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          display: 'inline-block',
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: toxColor
                        }} />
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>
                          {preset.toxicity_label?.split(' ')[0] || preset.toxicity_band.toUpperCase()}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('gemini_rag');
                          setRagCrop(preset.crop);
                          setRagPesticide(preset.pesticide_name);
                          handleExecuteRag(
                            undefined,
                            `Tell me full application guidelines, mixing instructions, and safety precautions for ${preset.pesticide_name} on ${preset.crop}.`,
                            preset.crop,
                            preset.pesticide_name
                          );
                        }}
                        style={{
                          background: '#EEF2FF',
                          color: '#4F46E5',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        <Sparkles size={11} />
                        <span>Ask AI</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ background: '#FFFFFF', padding: '40px', borderRadius: '16px', textAlign: 'center', border: '1px solid #E2E8F0' }}>
              <Info size={36} style={{ color: '#94A3B8', margin: '0 auto 12px' }} />
              <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>
                {currentLang === 'hi'
                  ? 'इस श्रेणी में कोई दवा नहीं मिली। कृपया अन्य श्रेणी चुनें या AI डॉक्टर से पूछें।'
                  : 'No specific presets found for this category. Please check other tabs or consult the Gemini RAG AI Doctor.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: SPECIFIC PESTICIDE SEARCH & CROP SUITABILITY CHECKER           */}
      {/* ===================================================================== */}
      {activeTab === 'pesticide_search' && (
        <div>
          {/* Search Box */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '20px',
            marginBottom: '20px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '14px' }}>
              {/* Pesticide Search Input */}
              <div>
                <label style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Search size={16} style={{ color: '#2563EB' }} />
                  <span>{currentLang === 'hi' ? 'दवा या रसायन का नाम लिखें:' : 'Search Pesticide Name / Active Molecule:'}</span>
                </label>
                <div ref={pesticideSearchRef} style={{ position: 'relative' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: '#F8FAFC',
                    border: '1.5px solid #CBD5E1',
                    borderRadius: '12px',
                    padding: '0 14px'
                  }}>
                    <input
                      type="text"
                      value={pesticideSearchInput}
                      onChange={(e) => setPesticideSearchInput(e.target.value)}
                      onFocus={() => { if (pesticideSearchResults.length > 0) setShowPesticideSuggestions(true); }}
                      placeholder="e.g. Chlorantraniliprole, 2,4-D, Mancozeb, Paclobutrazol..."
                      style={{
                        width: '100%',
                        border: 'none',
                        background: 'transparent',
                        padding: '12px 0',
                        fontSize: '14px',
                        color: '#0F172A',
                        outline: 'none',
                        fontWeight: '600'
                      }}
                    />
                    {isSearchingPesticides && <Loader2 size={16} className="spin-icon" style={{ color: '#2563EB' }} />}
                  </div>

                  {/* Dropdown Suggestions */}
                  {showPesticideSuggestions && pesticideSearchResults.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: '#FFFFFF',
                      borderRadius: '12px',
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 12px 30px rgba(0, 0, 0, 0.15)',
                      zIndex: 50,
                      marginTop: '6px',
                      maxHeight: '260px',
                      overflowY: 'auto'
                    }}>
                      {pesticideSearchResults.map((item: any) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            setPesticideSearchInput(item.pesticide_name);
                            setSelectedPesticideRecord(item);
                            setShowPesticideSuggestions(false);
                            triggerSuitabilityCheck(item.pesticide_name, suitabilityCropInput);
                          }}
                          style={{
                            padding: '10px 14px',
                            borderBottom: '1px solid #F1F5F9',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#EFF6FF')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
                        >
                          <div>
                            <strong style={{ fontSize: '13px', color: '#0F172A', display: 'block' }}>
                              {item.pesticide_name}
                            </strong>
                            <span style={{ fontSize: '11px', color: '#64748B' }}>
                              Registered Crop: {item.crop} • Target: {item.target_pest_or_disease?.slice(0, 45)}...
                            </span>
                          </div>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: '800',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: '#DBEAFE',
                            color: '#1E40AF'
                          }}>
                            {item.category}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Target Crop Input for Suitability Check */}
              <div>
                <label style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Sprout size={16} style={{ color: '#059669' }} />
                  <span>{currentLang === 'hi' ? 'अपनी लक्षित फसल का नाम लिखें:' : 'Target Crop to Test Compatibility:'}</span>
                </label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#F8FAFC',
                  border: '1.5px solid #CBD5E1',
                  borderRadius: '12px',
                  padding: '0 14px'
                }}>
                  <input
                    type="text"
                    value={suitabilityCropInput}
                    onChange={(e) => setSuitabilityCropInput(e.target.value)}
                    placeholder="e.g. Tomato, Cotton, Paddy, Chilli, Mango..."
                    style={{
                      width: '100%',
                      border: 'none',
                      background: 'transparent',
                      padding: '12px 0',
                      fontSize: '14px',
                      color: '#0F172A',
                      outline: 'none',
                      fontWeight: '600'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => triggerSuitabilityCheck(pesticideSearchInput, suitabilityCropInput)}
                    style={{
                      background: '#2563EB',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 14px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Check
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Molecules Chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '700' }}>
                {currentLang === 'hi' ? 'त्वरित रासायनिक जांच:' : 'Quick Test Molecules:'}
              </span>
              {[
                { name: 'Chlorantraniliprole', crop: 'Tomato' },
                { name: '2,4-D', crop: 'Tomato', isWarning: true },
                { name: 'Paclobutrazol', crop: 'Mango' },
                { name: 'Bispyribac Sodium', crop: 'Paddy' },
                { name: 'Mancozeb', crop: 'Potato' },
                { name: 'Trichoderma viride', crop: 'Chilli' }
              ].map((m, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setPesticideSearchInput(m.name);
                    setSuitabilityCropInput(m.crop);
                    triggerSuitabilityCheck(m.name, m.crop);
                  }}
                  style={{
                    background: m.isWarning ? '#FEF2F2' : '#F1F5F9',
                    color: m.isWarning ? '#991B1B' : '#334155',
                    border: m.isWarning ? '1px solid #FCA5A5' : '1px solid #CBD5E1',
                    borderRadius: '999px',
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  {m.isWarning ? '⚠️ ' : ''}{m.name} + {m.crop}
                </button>
              ))}
            </div>
          </div>

          {/* Suitability Result Card */}
          {isLoadingSuitability ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <Loader2 size={32} className="spin-icon" style={{ color: '#2563EB' }} />
            </div>
          ) : cibrcSuitabilityResult && (
            <div>
              {/* Verdict Banner */}
              <div style={{
                background: cibrcSuitabilityResult.verdict === 'APPROVED' ? '#F0FDF4' : '#FEF2F2',
                borderLeft: `6px solid ${cibrcSuitabilityResult.verdict === 'APPROVED' ? '#16A34A' : '#DC2626'}`,
                borderRadius: '16px',
                padding: '20px',
                marginBottom: '20px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                  {cibrcSuitabilityResult.verdict === 'APPROVED' ? (
                    <CheckCircle2 size={32} style={{ color: '#16A34A', flexShrink: 0, marginTop: '2px' }} />
                  ) : (
                    <Flame size={32} style={{ color: '#DC2626', flexShrink: 0, marginTop: '2px' }} />
                  )}

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{
                        background: cibrcSuitabilityResult.verdict === 'APPROVED' ? '#DCFCE7' : '#FEE2E2',
                        color: cibrcSuitabilityResult.verdict === 'APPROVED' ? '#166534' : '#991B1B',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '800'
                      }}>
                        {cibrcSuitabilityResult.verdict === 'APPROVED' ? '✅ CIBRC APPROVED' : '⛔ PROHIBITED / UNAPPROVED'}
                      </span>

                      {cibrcSuitabilityResult.waiting_period_days && (
                        <span style={{ fontSize: '12px', color: '#475569', fontWeight: '700' }}>
                          ⏳ Mandatory PHI Waiting Period: <strong>{cibrcSuitabilityResult.waiting_period_days}</strong>
                        </span>
                      )}
                    </div>

                    <h3 style={{
                      fontSize: '18px',
                      fontWeight: '800',
                      color: cibrcSuitabilityResult.verdict === 'APPROVED' ? '#14532D' : '#7F1D1D',
                      margin: '10px 0 6px'
                    }}>
                      {cibrcSuitabilityResult.title}
                    </h3>

                    {cibrcSuitabilityResult.hazard_reason && (
                      <p style={{
                        margin: '6px 0 12px',
                        fontSize: '13px',
                        color: '#991B1B',
                        background: 'rgba(255,255,255,0.7)',
                        padding: '10px',
                        borderRadius: '8px',
                        lineHeight: '1.5'
                      }}>
                        {cibrcSuitabilityResult.hazard_reason}
                      </p>
                    )}

                    {/* If Approved, show details */}
                    {cibrcSuitabilityResult.verdict === 'APPROVED' && (
                      <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                        <div style={{ background: '#FFFFFF', padding: '10px 14px', borderRadius: '10px', border: '1px solid #DCFCE7' }}>
                          <span style={{ fontSize: '11px', color: '#047857', fontWeight: '700', display: 'block' }}>15-Liter Pump Dose:</span>
                          <strong style={{ fontSize: '15px', color: '#064E3B' }}>{cibrcSuitabilityResult.pump_dose_15l}</strong>
                        </div>

                        <div style={{ background: '#FFFFFF', padding: '10px 14px', borderRadius: '10px', border: '1px solid #DCFCE7' }}>
                          <span style={{ fontSize: '11px', color: '#047857', fontWeight: '700', display: 'block' }}>Formulation Dose / ha:</span>
                          <strong style={{ fontSize: '15px', color: '#064E3B' }}>{cibrcSuitabilityResult.formulation_dose}</strong>
                        </div>

                        <div style={{ background: '#FFFFFF', padding: '10px 14px', borderRadius: '10px', border: '1px solid #DCFCE7' }}>
                          <span style={{ fontSize: '11px', color: '#047857', fontWeight: '700', display: 'block' }}>Target Pest / Disease:</span>
                          <strong style={{ fontSize: '13px', color: '#064E3B' }}>{cibrcSuitabilityResult.target_pest_or_disease}</strong>
                        </div>
                      </div>
                    )}

                    {/* Safe Approved Alternatives if prohibited */}
                    {cibrcSuitabilityResult.safe_approved_alternatives_for_crop?.length > 0 && (
                      <div style={{ marginTop: '16px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#1E293B', margin: '0 0 8px' }}>
                          🌱 Recommended CIBRC Approved Alternatives for {suitabilityCropInput}:
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '8px' }}>
                          {cibrcSuitabilityResult.safe_approved_alternatives_for_crop.slice(0, 4).map((alt: any) => (
                            <div key={alt.id} style={{ background: '#FFFFFF', padding: '8px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' }}>
                              <strong style={{ color: '#065F46', display: 'block' }}>{alt.pesticide_name}</strong>
                              <span style={{ color: '#64748B' }}>Dose: {alt.pump_dose_15l}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Interactive 15L Knapsack Sprayer Pump Calculator */}
              <div style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                padding: '20px',
                marginBottom: '20px'
              }}>
                <h4 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FlaskConical size={18} style={{ color: '#2563EB' }} />
                  <span>{currentLang === 'hi' ? 'नैपसैक स्प्रे पंप (Knapsack Sprayer) वॉल्यूम कैलकुलेटर' : 'Knapsack Sprayer Tank Volume & Farm Area Calculator'}</span>
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '6px' }}>
                      {currentLang === 'hi' ? 'स्प्रेयर टैंक क्षमता (लीटर):' : 'Sprayer Tank Size (Liters):'}
                    </label>
                    <select
                      value={tankLiters}
                      onChange={(e) => setTankLiters(Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        fontSize: '14px',
                        fontWeight: '600'
                      }}
                    >
                      <option value={15}>15 Liters (Standard Backpack Pump)</option>
                      <option value={16}>16 Liters</option>
                      <option value={20}>20 Liters (Battery Sprayer)</option>
                      <option value={50}>50 Liters (Power Sprayer Trolley)</option>
                      <option value={200}>200 Liters (Tractor Drum Spray)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '6px' }}>
                      {currentLang === 'hi' ? 'खेत का क्षेत्रफल (एकड़):' : 'Farm Area (Acres):'}
                    </label>
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={acreArea}
                      onChange={(e) => setAcreArea(Math.max(0.5, Number(e.target.value)))}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        fontSize: '14px',
                        fontWeight: '600'
                      }}
                    />
                  </div>
                </div>

                <div style={{
                  marginTop: '16px',
                  background: '#EFF6FF',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-around',
                  flexWrap: 'wrap',
                  gap: '12px',
                  textAlign: 'center'
                }}>
                  <div>
                    <span style={{ fontSize: '12px', color: '#1E40AF', fontWeight: '700', display: 'block' }}>
                      {currentLang === 'hi' ? 'कुल आवश्यक टैंक (पंप)' : 'Total Sprayer Tanks'}
                    </span>
                    <strong style={{ fontSize: '20px', color: '#1E3A8A' }}>
                      {Math.ceil((acreArea * 150) / tankLiters)} {currentLang === 'hi' ? 'टंकियां' : 'Tanks'}
                    </strong>
                  </div>

                  <div>
                    <span style={{ fontSize: '12px', color: '#1E40AF', fontWeight: '700', display: 'block' }}>
                      {currentLang === 'hi' ? 'पानी की कुल मात्रा' : 'Total Water Required'}
                    </span>
                    <strong style={{ fontSize: '20px', color: '#1E3A8A' }}>
                      {Math.round(acreArea * 150)} {currentLang === 'hi' ? 'लीटर' : 'Liters'}
                    </strong>
                  </div>

                  <div>
                    <span style={{ fontSize: '12px', color: '#1E40AF', fontWeight: '700', display: 'block' }}>
                      {currentLang === 'hi' ? 'CIBRC मानक स्प्रे दर' : 'CIBRC Calibration'}
                    </span>
                    <strong style={{ fontSize: '15px', color: '#1E3A8A' }}>
                      375 - 500 L / Hectare
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: GEMINI RAG AI DOCTOR                                            */}
      {/* ===================================================================== */}
      {activeTab === 'gemini_rag' && (
        <div>
          {/* AI Input Form */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '24px',
            marginBottom: '20px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ background: '#EDE9FE', padding: '8px', borderRadius: '10px', display: 'flex' }}>
                <Bot size={22} style={{ color: '#7C3AED' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#1E1B4B', margin: 0 }}>
                  Ask CIBRC AI Doctor (Gemini RAG Engine)
                </h3>
                <span style={{ fontSize: '12px', color: '#6D28D9' }}>
                  PostgreSQL CIBRC Database + Google Gemini 2.5 Flash Grounded Verification
                </span>
              </div>
            </div>

            {/* Quick Prompt Chips */}
            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '700', display: 'block', marginBottom: '8px' }}>
                💡 {currentLang === 'hi' ? 'अक्सर पूछे जाने वाले किसान प्रश्न (Quick Queries):' : 'Popular Farmer Questions:'}
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {quickRagPrompts.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setRagQuery(p.query);
                      setRagCrop(p.crop);
                      setRagPesticide(p.pesticide);
                      handleExecuteRag(undefined, p.query, p.crop, p.pesticide);
                    }}
                    style={{
                      background: '#F5F3FF',
                      color: '#5B21B6',
                      border: '1px solid #DDD6FE',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={(e) => handleExecuteRag(e)}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '4px' }}>
                    Crop Name (Optional):
                  </label>
                  <input
                    type="text"
                    value={ragCrop}
                    onChange={(e) => setRagCrop(e.target.value)}
                    placeholder="e.g. Tomato, Paddy, Mango..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      fontWeight: '600'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '4px' }}>
                    Pesticide / Molecule (Optional):
                  </label>
                  <input
                    type="text"
                    value={ragPesticide}
                    onChange={(e) => setRagPesticide(e.target.value)}
                    placeholder="e.g. Chlorantraniliprole, 2,4-D..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      fontWeight: '600'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '4px' }}>
                  Your Question:
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    value={ragQuery}
                    onChange={(e) => setRagQuery(e.target.value)}
                    placeholder={
                      currentLang === 'hi'
                        ? 'अपना प्रश्न यहां लिखें (उदा. क्या टमाटर में 2,4-D छिड़क सकते हैं? या धान में तना छेदक की खुराक क्या है?)...'
                        : 'Ask anything (e.g. What is the 15L pump dose of Coragen for tomato? Is 2,4-D harmful?)...'
                    }
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: '1.5px solid #A78BFA',
                      fontSize: '14px',
                      outline: 'none',
                      fontWeight: '600'
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingRag || !ragQuery.trim()}
                    style={{
                      background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '12px 24px',
                      fontSize: '14px',
                      fontWeight: '800',
                      cursor: isSubmittingRag || !ragQuery.trim() ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
                      opacity: isSubmittingRag || !ragQuery.trim() ? 0.7 : 1
                    }}
                  >
                    {isSubmittingRag ? <Loader2 size={16} className="spin-icon" /> : <Send size={16} />}
                    <span>{currentLang === 'hi' ? 'पूछें' : 'Consult AI'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* RAG Results Display */}
          {isSubmittingRag ? (
            <div style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              padding: '40px',
              textAlign: 'center'
            }}>
              <Loader2 size={36} className="spin-icon" style={{ color: '#7C3AED', margin: '0 auto 16px' }} />
              <h4 style={{ fontSize: '16px', fontWeight: '800', color: '#1E1B4B', margin: '0 0 6px' }}>
                Querying PostgreSQL CIBRC Registry & Consulting Gemini AI...
              </h4>
              <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                Retrieving official statutory doses, Pre-Harvest Intervals, and phytotoxicity rules.
              </p>
            </div>
          ) : ragResult ? (
            <div style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              padding: '24px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}>
              {/* Header Badges */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    background: '#EDE9FE',
                    color: '#6D28D9',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Sparkles size={12} />
                    <span>Engine: {ragResult.llm_engine}</span>
                  </span>

                  <span style={{
                    background: '#ECFDF5',
                    color: '#065F46',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '700'
                  }}>
                    🏛️ {ragResult.rag_context_count} CIBRC Database Records Grounded
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handlePlayVoice(ragResult.advisory.replace(/[*#`_>]/g, ''))}
                  style={{
                    background: isSpeaking ? '#DC2626' : '#F59E0B',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  <span>{isSpeaking ? 'Stop Audio' : 'Listen Voice'}</span>
                </button>
              </div>

              {/* Advisory Content */}
              <div style={{
                fontSize: '14px',
                color: '#1E293B',
                lineHeight: '1.7',
                whiteSpace: 'pre-wrap',
                background: '#FAF5FF',
                border: '1px solid #F3E8FF',
                borderRadius: '12px',
                padding: '20px'
              }}>
                {ragResult.advisory}
              </div>

              {/* Grounded Records Accordion */}
              {ragResult.retrieved_records?.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#64748B', margin: '0 0 10px' }}>
                    📑 CIBRC Government Gazette Data Sources Used for this Answer:
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                    {ragResult.retrieved_records.slice(0, 4).map((rec: any) => (
                      <div key={rec.id} style={{
                        background: '#F8FAFC',
                        borderRadius: '8px',
                        padding: '10px',
                        border: '1px solid #E2E8F0',
                        fontSize: '12px'
                      }}>
                        <strong style={{ color: '#0F172A', display: 'block' }}>{rec.pesticide_name}</strong>
                        <span style={{ color: '#64748B', display: 'block' }}>Crop: {rec.crop} • Category: {rec.category}</span>
                        <span style={{ color: '#059669', fontWeight: '700' }}>15L Pump: {rec.pump_dose_15l}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              padding: '30px',
              textAlign: 'center'
            }}>
              <HelpCircle size={36} style={{ color: '#A78BFA', margin: '0 auto 12px' }} />
              <h4 style={{ fontSize: '15px', fontWeight: '800', color: '#1E1B4B', margin: '0 0 4px' }}>
                Ask any question above or click a popular prompt chip!
              </h4>
              <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                The Gemini RAG model queries official statutory CIBRC doses, 15L pump formulas, and verifies off-label hazards.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
