import { useState, useEffect, useRef, type FC, type ChangeEvent } from 'react';
import type { Language, LocationOption } from '../types';
import { KisanSethuApi } from '../services/api';
import {
  FlaskConical,
  Camera,
  Search,
  Volume2,
  VolumeX,
  Sparkles,
  Loader2,
  Send,
  Info,
  Bot,
  Clock,
  ShieldCheck,
  X
} from 'lucide-react';

interface CropPesticideDoctorViewProps {
  currentLang: Language;
  currentLocation?: LocationOption;
  initialCropKey?: string;
  onOpenHelpline?: (num: string) => void;
}

export const CropPesticideDoctorView: FC<CropPesticideDoctorViewProps> = ({
  currentLang,
  currentLocation,
  initialCropKey = 'tomato',
  onOpenHelpline: _onOpenHelpline
}) => {

  // Selected State
  const [selectedCropKey, setSelectedCropKey] = useState<string>(initialCropKey);
  const [selectedSymptomKey, setSelectedSymptomKey] = useState<string>('leaf_spot');
  const [tankLiters, setTankLiters] = useState<number>(15);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Multimodal Diagnostic Data
  const [diagnosticData, setDiagnosticData] = useState<any | null>(null);
  const [isLoadingDiagnosis, setIsLoadingDiagnosis] = useState<boolean>(false);

  // Photo Upload & Gemini Vision State
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bottom RAG Chat State
  const [chatInput, setChatInput] = useState<string>('');
  const [isSubmittingChat, setIsSubmittingChat] = useState<boolean>(false);
  const [ragDrawerOpen, setRagDrawerOpen] = useState<boolean>(false);
  const [ragResponse, setRagResponse] = useState<any | null>(null);

  // Audio Voice State (TTS)
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Master Crops with bilingual titles & visual badges
  const masterCrops = [
    { key: 'tomato', nameEn: 'Tomato', nameHi: 'टमाटर', nameTe: 'టమోటా', icon: '🍅', color: '#EF4444' },
    { key: 'chilli', nameEn: 'Chilli', nameHi: 'मिर्च', nameTe: 'మిర్చి', icon: '🌶️', color: '#DC2626' },
    { key: 'paddy', nameEn: 'Paddy', nameHi: 'धान', nameTe: 'వరి', icon: '🌾', color: '#16A34A' },
    { key: 'potato', nameEn: 'Potato', nameHi: 'आलू', nameTe: 'బంగాళాదుంప', icon: '🥔', color: '#D97706' },
    { key: 'mango', nameEn: 'Mango', nameHi: 'आम', nameTe: 'మామిడి', icon: '🥭', color: '#EA580C' },
    { key: 'cotton', nameEn: 'Cotton', nameHi: 'कपास', nameTe: 'పత్తి', icon: '🌱', color: '#059669' },
    { key: 'wheat', nameEn: 'Wheat', nameHi: 'गेहूं', nameTe: 'గోధుమ', icon: '🌾', color: '#CA8A04' },
    { key: 'grapes', nameEn: 'Grapes', nameHi: 'अंगूर', nameTe: 'ద్రాక్ష', icon: '🍇', color: '#7C3AED' },
    { key: 'apple', nameEn: 'Apple', nameHi: 'सेब', nameTe: 'ఆపిల్', icon: '🍎', color: '#E11D48' }
  ];

  // Crop-specific symptoms library
  const cropSymptomsMap: Record<string, any[]> = {
    tomato: [
      {
        key: 'leaf_spot',
        nameEn: 'Leaf Spot',
        nameHi: 'पत्ती धब्बा',
        nameTe: 'ఆకు మచ్చ',
        type: 'Fungal (Alternaria)',
        tag: 'Identify & Treat',
        imageSvg: 'leaf_spot'
      },
      {
        key: 'leaf_curl',
        nameEn: 'Leaf Curl',
        nameHi: 'पत्ती मरोड़',
        nameTe: 'ఆకు ముడుత',
        type: 'Viral (Whitefly Vector)',
        tag: 'Identify & Treat',
        imageSvg: 'leaf_curl'
      },
      {
        key: 'fruit_borer',
        nameEn: 'Fruit Borer',
        nameHi: 'फल छेदक',
        nameTe: 'కాయ తొలిచే పురుగు',
        type: 'Chewing Caterpillar',
        tag: 'Identify & Treat',
        imageSvg: 'fruit_borer'
      },
      {
        key: 'late_blight',
        nameEn: 'Late Blight',
        nameHi: 'पछेती झुलसा',
        nameTe: 'లేట్ బ్లైట్',
        type: 'Oomycete Fungus',
        tag: 'Identify & Treat',
        imageSvg: 'blight'
      }
    ],
    chilli: [
      {
        key: 'leaf_curl',
        nameEn: 'Leaf Curl / Murda',
        nameHi: 'पत्ती मरोड़ (मुरड़ा)',
        nameTe: 'మిర్చి ఆకు ముడుత',
        type: 'Thrips / Mites',
        tag: 'Identify & Treat',
        imageSvg: 'leaf_curl'
      },
      {
        key: 'fruit_rot',
        nameEn: 'Fruit Rot / Dieback',
        nameHi: 'फल सड़न (डाईबैक)',
        nameTe: 'కాయ కుళ్లు తెగులు',
        type: 'Fungal Anthracnose',
        tag: 'Identify & Treat',
        imageSvg: 'leaf_spot'
      },
      {
        key: 'yellow_mites',
        nameEn: 'Yellow Mites',
        nameHi: 'पीली मकड़ी',
        nameTe: 'పసుపు మైట్స్',
        type: 'Acarid Pest',
        tag: 'Identify & Treat',
        imageSvg: 'blight'
      },
      {
        key: 'fruit_borer',
        nameEn: 'Fruit Borer',
        nameHi: 'फल छेदक इल्ली',
        nameTe: 'కాయ తొలిచే పురుగు',
        type: 'Helicoverpa',
        tag: 'Identify & Treat',
        imageSvg: 'fruit_borer'
      }
    ],
    paddy: [
      {
        key: 'stem_borer',
        nameEn: 'Stem Borer',
        nameHi: 'तना छेदक (मृत गोभ)',
        nameTe: 'కాండం తొలిచే పురుగు',
        type: 'Scirpophaga incertulas',
        tag: 'Identify & Treat',
        imageSvg: 'fruit_borer'
      },
      {
        key: 'blast_disease',
        nameEn: 'Blast Disease',
        nameHi: 'झोंका रोग (ब्लास्ट)',
        nameTe: 'వరి అగ్గితెగులు',
        type: 'Fungal (Magnaporthe)',
        tag: 'Identify & Treat',
        imageSvg: 'leaf_spot'
      },
      {
        key: 'sheath_blight',
        nameEn: 'Sheath Blight',
        nameHi: 'शीथ ब्लाइट',
        nameTe: 'వరి పొడ తెగులు',
        type: 'Rhizoctonia solani',
        tag: 'Identify & Treat',
        imageSvg: 'blight'
      },
      {
        key: 'brown_plant_hopper',
        nameEn: 'Brown Plant Hopper (BPH)',
        nameHi: 'भूरा फुदका (हॉपर बर्न)',
        nameTe: 'సుడి దోమ',
        type: 'Nilaparvata lugens',
        tag: 'Identify & Treat',
        imageSvg: 'leaf_curl'
      }
    ],
    potato: [
      {
        key: 'late_blight',
        nameEn: 'Late Blight',
        nameHi: 'पछेती झुलसा',
        nameTe: 'ఆలు లేట్ బ్లైట్',
        type: 'Phytophthora infestans',
        tag: 'Identify & Treat',
        imageSvg: 'blight'
      },
      {
        key: 'black_scurf',
        nameEn: 'Black Scurf',
        nameHi: 'काली पपड़ी',
        nameTe: 'నల్లటి మచ్చ తెగులు',
        type: 'Rhizoctonia solani',
        tag: 'Identify & Treat',
        imageSvg: 'leaf_spot'
      },
      {
        key: 'sprouting_storage',
        nameEn: 'Storage Sprouting',
        nameHi: 'भंडारण में अंकुरण',
        nameTe: 'నిల్వలో మొలకలు',
        type: 'Physiological Storage Loss',
        tag: 'Storage Remedy',
        imageSvg: 'leaf_curl'
      }
    ],
    mango: [
      {
        key: 'mango_hopper',
        nameEn: 'Mango Hopper',
        nameHi: 'आम का भुनगा (हॉपर)',
        nameTe: 'మామిడి తేనెమంచు పురుగు',
        type: 'Idioscopus clypealis',
        tag: 'Identify & Treat',
        imageSvg: 'leaf_curl'
      },
      {
        key: 'powdery_mildew',
        nameEn: 'Powdery Mildew',
        nameHi: 'बौर का दहिया रोग',
        nameTe: 'బూడిద తెగులు',
        type: 'Oidium mangiferae',
        tag: 'Identify & Treat',
        imageSvg: 'leaf_spot'
      },
      {
        key: 'alternate_bearing',
        nameEn: 'Alternate Bearing / No Bloom',
        nameHi: 'बौर न आना / एक साल छोड़कर फल',
        nameTe: 'పూత లేకపోవడం (కల్టార్)',
        type: 'Hormonal Vegetative Imbalance',
        tag: 'PGR Solution',
        imageSvg: 'fruit_borer'
      }
    ],
    cotton: [
      {
        key: 'pink_bollworm',
        nameEn: 'Pink Bollworm',
        nameHi: 'गुलाबी सुंडी',
        nameTe: 'గులాబీ రంగు పురుగు',
        type: 'Pectinophora gossypiella',
        tag: 'Identify & Treat',
        imageSvg: 'fruit_borer'
      },
      {
        key: 'whitefly',
        nameEn: 'Whitefly & Aphids',
        nameHi: 'सफेद मक्खी व चेपा',
        nameTe: 'తెల్లదోమ & పేనుబంక',
        type: 'Sap Sucking Vectors',
        tag: 'Identify & Treat',
        imageSvg: 'leaf_curl'
      }
    ]
  };

  const currentSymptoms = cropSymptomsMap[selectedCropKey] || cropSymptomsMap['tomato'];

  // Load Actionable Solutions whenever Crop, Symptom, or Tank Size changes
  useEffect(() => {
    let isMounted = true;
    const fetchPrescriptions = async () => {
      setIsLoadingDiagnosis(true);
      try {
        const res = await KisanSethuApi.diagnoseMultimodalCropDoctor({
          cropKey: selectedCropKey,
          symptomKey: selectedSymptomKey,
          tankLiters: tankLiters,
          lang: currentLang
        });
        if (isMounted && res && res.status === 'success') {
          setDiagnosticData(res);
        }
      } catch (err) {
        console.warn('Diagnostic fetch error:', err);
      } finally {
        if (isMounted) setIsLoadingDiagnosis(false);
      }
    };

    fetchPrescriptions();
    return () => { isMounted = false; };
  }, [selectedCropKey, selectedSymptomKey, tankLiters, currentLang]);

  // Handle Photo Upload (Gemini Vision)
  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Str = reader.result as string;
      setUploadedImagePreview(base64Str);
      setIsAnalyzingPhoto(true);

      try {
        const res = await KisanSethuApi.diagnoseMultimodalCropDoctor({
          imageBase64: base64Str,
          mimeType: file.type || 'image/jpeg',
          tankLiters: tankLiters,
          lang: currentLang
        });

        if (res && res.status === 'success') {
          setDiagnosticData(res);
          if (res.detected_crop?.key) {
            setSelectedCropKey(res.detected_crop.key);
          }
          if (res.detected_symptom?.key) {
            setSelectedSymptomKey(res.detected_symptom.key);
          }
        }
      } catch (err) {
        console.warn('Photo diagnosis failed:', err);
      } finally {
        setIsAnalyzingPhoto(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Omni Search
  const handleSearchSubmit = (e?: any) => {
    if (e) e.preventDefault();
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;

    // Check if query is a crop
    const foundCrop = masterCrops.find(
      (c) => c.key === q || c.nameEn.toLowerCase().includes(q) || c.nameHi.includes(q) || c.nameTe.includes(q)
    );
    if (foundCrop) {
      setSelectedCropKey(foundCrop.key);
      return;
    }

    // Check if query is a symptom
    for (const cropKey of Object.keys(cropSymptomsMap)) {
      const s = cropSymptomsMap[cropKey].find(
        (sym) => sym.nameEn.toLowerCase().includes(q) || sym.nameHi.includes(q) || sym.key.includes(q)
      );
      if (s) {
        setSelectedCropKey(cropKey);
        setSelectedSymptomKey(s.key);
        return;
      }
    }

    // Otherwise, trigger Gemini RAG with the query
    executeRagQuery(searchQuery);
  };

  // Execute Gemini RAG query
  const executeRagQuery = async (queryText: string) => {
    if (!queryText.trim()) return;
    setIsSubmittingChat(true);
    setRagDrawerOpen(true);
    try {
      const res = await KisanSethuApi.askCibrcAiAdvisor(
        queryText,
        selectedCropKey,
        undefined,
        currentLang
      );
      if (res && res.status === 'success') {
        setRagResponse(res);
      }
    } catch (err) {
      console.warn('RAG query error:', err);
    } finally {
      setIsSubmittingChat(false);
    }
  };

  // Audio Playback
  const handlePlayVoice = (customText?: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported on this device.');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    let message = customText;
    if (!message) {
      if (ragDrawerOpen && ragResponse?.advisory) {
        message = ragResponse.advisory.replace(/[*#`_>]/g, '');
      } else if (diagnosticData?.audio_script) {
        message = diagnosticData.audio_script;
      } else {
        const cropObj = masterCrops.find((c) => c.key === selectedCropKey);
        const cropName = cropObj ? (currentLang === 'hi' ? cropObj.nameHi : cropObj.nameEn) : 'Crop';
        message = currentLang === 'hi'
          ? `${cropName} की जांच और CIBRC अनुमोदित दवाएं तैयार हैं।`
          : `CIBRC approved prescription loaded for ${cropName}.`;
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

  // Render Symptom Leaf Artwork SVG
  const renderSymptomArtwork = (type: string) => {
    if (type === 'leaf_curl') {
      return (
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', borderRadius: '10px' }}>
          <rect width="100" height="100" fill="#2E7D32" />
          <path d="M50 15 C30 35, 10 50, 25 85 C45 65, 55 45, 50 15 Z" fill="#4CAF50" />
          <path d="M50 15 C70 35, 90 50, 75 85 C55 65, 45 45, 50 15 Z" fill="#66BB6A" />
          <path d="M50 15 Q40 55 50 95" stroke="#1B5E20" strokeWidth="3" fill="none" />
          <path d="M25 40 Q40 50 50 45" stroke="#FFE082" strokeWidth="2.5" fill="none" />
          <path d="M75 50 Q60 60 50 55" stroke="#FFE082" strokeWidth="2.5" fill="none" />
          <circle cx="35" cy="55" r="4" fill="#FDD835" />
          <circle cx="65" cy="45" r="5" fill="#FDD835" />
        </svg>
      );
    }
    if (type === 'fruit_borer') {
      return (
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', borderRadius: '10px' }}>
          <rect width="100" height="100" fill="#B71C1C" />
          <circle cx="50" cy="55" r="35" fill="#E53935" />
          <path d="M48 20 L52 10 L50 20 Z" stroke="#2E7D32" strokeWidth="6" strokeLinecap="round" />
          <path d="M42 22 L35 15 M58 22 L65 15" stroke="#4CAF50" strokeWidth="3" strokeLinecap="round" />
          {/* Hole & caterpillar */}
          <ellipse cx="62" cy="50" rx="8" ry="6" fill="#212121" />
          <path d="M60 48 Q68 40 70 34" stroke="#8BC34A" strokeWidth="4" strokeLinecap="round" fill="none" />
          <circle cx="70" cy="34" r="2.5" fill="#33691E" />
        </svg>
      );
    }
    if (type === 'blight') {
      return (
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', borderRadius: '10px' }}>
          <rect width="100" height="100" fill="#33691E" />
          <path d="M50 10 C20 30, 20 80, 50 90 C80 80, 80 30, 50 10 Z" fill="#558B2F" />
          <path d="M25 50 Q45 60 40 80 Q25 75 25 50 Z" fill="#3E2723" opacity="0.8" />
          <path d="M60 30 Q75 40 70 60 Q55 55 60 30 Z" fill="#4E342E" opacity="0.85" />
          <circle cx="50" cy="40" r="12" fill="#D7CCC8" opacity="0.6" />
          <circle cx="50" cy="40" r="7" fill="#5D4037" />
        </svg>
      );
    }
    // Default Leaf Spot
    return (
      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', borderRadius: '10px' }}>
        <rect width="100" height="100" fill="#1B5E20" />
        <path d="M50 10 C20 35, 15 75, 50 92 C85 75, 80 35, 50 10 Z" fill="#43A047" />
        <line x1="50" y1="10" x2="50" y2="92" stroke="#2E7D32" strokeWidth="3" />
        {/* Concentric rings */}
        <circle cx="38" cy="38" r="9" fill="#5D4037" />
        <circle cx="38" cy="38" r="5" fill="#3E2723" />
        <circle cx="38" cy="38" r="2" fill="#D7CCC8" />
        <circle cx="62" cy="55" r="11" fill="#5D4037" />
        <circle cx="62" cy="55" r="6" fill="#3E2723" />
        <circle cx="62" cy="55" r="2.5" fill="#FFE082" />
        <circle cx="44" cy="72" r="7" fill="#5D4037" />
      </svg>
    );
  };

  // Render Realistic Visual Bottle Product Card
  const renderBottleCard = (sol: any) => {
    const isCoragen = sol.brand_name.toLowerCase().includes('coragen');
    const isAmistar = sol.brand_name.toLowerCase().includes('amistar');
    const capBg = sol.cap_color || (isCoragen ? '#2563EB' : isAmistar ? '#16A34A' : '#7C3AED');

    return (
      <div
        key={sol.id}
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '2px solid #E2E8F0',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
          transition: 'all 0.2s',
          position: 'relative'
        }}
      >
        {/* Bottle Silhouette SVG Graphic */}
        <div style={{ width: '120px', height: '160px', position: 'relative', marginBottom: '12px' }}>
          <svg viewBox="0 0 120 180" style={{ width: '100%', height: '100%' }}>
            {/* Bottle Cap */}
            <rect x="42" y="8" width="36" height="20" rx="4" fill={capBg} />
            <line x1="46" y1="13" x2="74" y2="13" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.6" />
            <line x1="46" y1="18" x2="74" y2="18" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.6" />
            <line x1="46" y1="23" x2="74" y2="23" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.6" />

            {/* Neck */}
            <rect x="47" y="28" width="26" height="14" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="1.5" />

            {/* Shoulder & Body */}
            <path
              d="M 47 42 C 30 46, 20 60, 20 80 L 20 160 C 20 168, 26 172, 34 172 L 86 172 C 94 172, 100 168, 100 160 L 100 80 C 100 60, 90 46, 73 42 Z"
              fill="#FFFFFF"
              stroke="#94A3B8"
              strokeWidth="2"
            />

            {/* Product Body Label */}
            <rect x="24" y="70" width="72" height="74" rx="4" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1" />
            <rect x="24" y="70" width="72" height="8" rx="2" fill={capBg} />

            {/* Brand Logo bar on label */}
            <circle cx="36" cy="90" r="4" fill="#F59E0B" />
            <text x="44" y="93" fontSize="8" fontWeight="800" fill="#0F172A">
              {sol.brand_name.slice(0, 8)}
            </text>

            {/* Hazard / Toxicity Diamond */}
            <polygon
              points="60,118 68,126 60,134 52,126"
              fill={sol.toxicity_band === 'red' ? '#EF4444' : sol.toxicity_band === 'yellow' ? '#F59E0B' : sol.toxicity_band === 'green' ? '#10B981' : '#3B82F6'}
              stroke="#FFFFFF"
              strokeWidth="1"
            />
          </svg>

          {/* Approved Safe Seal Sticker */}
          <div style={{
            position: 'absolute',
            bottom: '24px',
            right: '-6px',
            background: '#047857',
            color: '#FFFFFF',
            borderRadius: '50%',
            width: '42px',
            height: '42px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            border: '2px solid #FFFFFF'
          }}>
            <ShieldCheck size={14} style={{ color: '#A7F3D0' }} />
            <span style={{ fontSize: '7px', fontWeight: '900', letterSpacing: '-0.2px', lineHeight: 1 }}>
              APPROVED
            </span>
          </div>
        </div>

        {/* Product Title & Pump Dose */}
        <h3 style={{
          fontSize: '17px',
          fontWeight: '900',
          color: '#1E3A8A',
          margin: '0 0 2px',
          textAlign: 'center'
        }}>
          {sol.brand_name} {currentLang === 'hi' && sol.brand_name.toLowerCase().includes('coragen') ? '(कोराजेन)' : currentLang === 'hi' && sol.brand_name.toLowerCase().includes('amistar') ? '(एमिस्टार)' : ''}
        </h3>

        {/* Highlighted Pump Dose Badge */}
        <div style={{
          background: '#EFF6FF',
          color: '#1D4ED8',
          padding: '6px 12px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: '800',
          margin: '6px 0',
          textAlign: 'center',
          border: '1px solid #BFDBFE'
        }}>
          💧 {sol.pump_liters}L Pump: {sol.pump_dose.split(' per ')[0]}
        </div>

        {/* Target pest */}
        <span style={{ fontSize: '12px', color: '#334155', fontWeight: '700', marginBottom: '4px', textAlign: 'center' }}>
          🎯 Targets: {sol.target_pest}
        </span>

        {/* Waiting Period with clock icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748B', marginBottom: '8px' }}>
          <Clock size={12} style={{ color: '#D97706' }} />
          <span>Wait: <strong>{sol.waiting_period_days}</strong></span>
        </div>

        {/* Toxicity Band Pill */}
        <span style={{
          fontSize: '10px',
          fontWeight: '800',
          padding: '3px 8px',
          borderRadius: '6px',
          background: sol.toxicity_band === 'green' ? '#DCFCE7' : sol.toxicity_band === 'blue' ? '#DBEAFE' : sol.toxicity_band === 'yellow' ? '#FEF3C7' : '#FEE2E2',
          color: sol.toxicity_band === 'green' ? '#166534' : sol.toxicity_band === 'blue' ? '#1E40AF' : sol.toxicity_band === 'yellow' ? '#92400E' : '#991B1B',
          marginBottom: '10px'
        }}>
          {sol.toxicity_label.split(' - ')[0]}
        </span>

        {/* Action Button */}
        <button
          type="button"
          onClick={() => {
            executeRagQuery(`Provide complete safe application instructions, knapsack sprayer dosage, and waiting period cautions for ${sol.pesticide_name} on ${selectedCropKey}.`);
          }}
          style={{
            width: '100%',
            background: '#F1F5F9',
            color: '#1E293B',
            border: '1px solid #CBD5E1',
            borderRadius: '8px',
            padding: '7px',
            fontSize: '11px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px'
          }}
        >
          <Sparkles size={12} style={{ color: '#6366F1' }} />
          <span>{currentLang === 'hi' ? 'उपचार विधि देखें' : currentLang === 'te' ? 'వినియోగ వివరాలు' : 'View Application Advice'}</span>
        </button>
      </div>
    );
  };

  return (
    <div className="crop-pesticide-doctor-root" style={{ maxWidth: '1360px', margin: '0 auto', padding: '16px' }}>
      {/* 1. Header Bar matching screenshot */}
      <div style={{
        background: 'linear-gradient(135deg, #15803D 0%, #166534 60%, #14532D 100%)',
        color: '#FFFFFF',
        borderRadius: '16px',
        padding: '20px 24px',
        marginBottom: '16px',
        boxShadow: '0 8px 20px -4px rgba(21, 128, 61, 0.35)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', padding: '10px', borderRadius: '12px', display: 'flex' }}>
            <FlaskConical size={28} style={{ color: '#FFFFFF' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '900', margin: 0, color: '#FFFFFF' }}>
              {currentLang === 'hi' ? 'फसल परामर्श एवं सुरक्षा डॉक्टर' : currentLang === 'te' ? 'పంట సలహాలు & రక్షణ డాక్టర్' : 'Crop Advisory & Safety Doctor'}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
              <span style={{ fontSize: '13px', color: '#BBF7D0', fontWeight: '600' }}>
                🏛️ {currentLang === 'hi' ? 'कृषि विभाग प्रमाणित सलाह' : currentLang === 'te' ? 'వ్యవసాయ శాఖ ధృవీకరించిన సలహా' : 'Verified Agricultural Safety Advisory'}
              </span>
              <span style={{ color: '#86EFAC' }}>•</span>
              <span style={{ fontSize: '12px', color: '#E2E8F0' }}>
                {currentLocation ? `📍 ${currentLocation.name[currentLang]}` : 'National Safety Standards'}
              </span>
            </div>
          </div>
        </div>

        {/* Listen Audio (आवाज सुनें) Orange Button matching screenshot */}
        <button
          type="button"
          onClick={() => handlePlayVoice()}
          style={{
            background: isSpeaking ? '#DC2626' : '#EA580C',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '12px',
            padding: '12px 22px',
            fontSize: '14px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(234, 88, 12, 0.45)',
            transition: 'all 0.2s'
          }}
        >
          {isSpeaking ? <VolumeX size={18} /> : <Volume2 size={18} />}
          <span>{isSpeaking ? 'Stop Audio' : currentLang === 'hi' ? 'Listen Audio (आवाज सुनें)' : currentLang === 'te' ? 'Listen Audio (వినండి)' : 'Listen Audio 🔊'}</span>
        </button>
      </div>

      {/* 2. Top Search Bar: "Search Crop, Pest, or Pesticide..." */}
      <form onSubmit={handleSearchSubmit} style={{ marginBottom: '20px' }}>
        <div style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          border: '1.5px solid #CBD5E1',
          padding: '6px 16px',
          display: 'flex',
          alignItems: 'center',
          boxShadow: '0 3px 8px rgba(0,0,0,0.04)'
        }}>
          <Search size={20} style={{ color: '#64748B', marginRight: '10px' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              currentLang === 'hi'
                ? 'Search Crop, Pest, or Pesticide... (उदा. टमाटर, फल छेदक, Coragen, 2,4-D)'
                : 'Search Crop, Pest, or Pesticide... (e.g., Tomato, Fruit Borer, Coragen, 2,4-D)'
            }
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              padding: '10px 0',
              fontSize: '15px',
              fontWeight: '600',
              color: '#0F172A'
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px', marginRight: '8px' }}
            >
              <X size={16} />
            </button>
          )}
          <button
            type="submit"
            style={{
              background: '#15803D',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Search
          </button>
        </div>
      </form>

      {/* 3. Section Title: Universal Format Advisory */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#0F172A', margin: 0 }}>
          {currentLang === 'hi' ? 'फसल स्वास्थ्य एवं उपचार परामर्श' : currentLang === 'te' ? 'పంట ఆరోగ్యం & చికిత్స మార్గదర్శి' : 'Crop Health & Treatment Advisory'}
        </h2>
        <span style={{ fontSize: '13px', color: '#64748B' }}>
          {currentLang === 'hi'
            ? 'सार्वभौमिक 3-चरण प्रारूप: फसल चुनें ➔ पत्ती फोटो या लक्षण पहचानें ➔ सटीक खुराक व सुरक्षित समाधान पाएं'
            : currentLang === 'te'
            ? 'సార్వత్రిక 3-దశల విధానం: పంట ఎంచుకోండి ➔ ఆకు ఫోటో లేదా లక్షణాలు చూడండి ➔ ఖచ్చితమైన మోతాదు పొందండి'
            : 'Universal 3-Step Advisory Format: Select Crop ➔ Identify Symptoms or Upload Leaf Photo ➔ Verified Dose & Solution'}
        </span>
      </div>

      {/* 4. Three-Column Diagnostic Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(220px, 1fr) minmax(280px, 1.4fr) minmax(360px, 2fr)',
        gap: '20px',
        alignItems: 'start'
      }}>
        {/* =================================================================== */}
        {/* COLUMN 1: SELECT YOUR CROP                                          */}
        {/* =================================================================== */}
        <div style={{
          background: '#F8FAFC',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '16px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: '0 0 12px' }}>
            Select Your Crop
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {masterCrops.map((c) => {
              const isSelected = selectedCropKey === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => {
                    setSelectedCropKey(c.key);
                    // auto pick first symptom of crop
                    const syms = cropSymptomsMap[c.key];
                    if (syms && syms.length > 0) {
                      setSelectedSymptomKey(syms[0].key);
                    }
                  }}
                  style={{
                    background: isSelected ? '#FFFFFF' : '#FFFFFF',
                    border: isSelected ? '3px solid #15803D' : '1.5px solid #E2E8F0',
                    borderRadius: '14px',
                    padding: '16px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 6px 16px rgba(21, 128, 61, 0.2)' : '0 2px 4px rgba(0,0,0,0.02)',
                    transition: 'all 0.15s'
                  }}
                >
                  <span style={{ fontSize: '42px', marginBottom: '8px' }}>{c.icon}</span>
                  <strong style={{ fontSize: '16px', color: '#0F172A', display: 'block', marginBottom: '2px' }}>
                    {c.nameEn}
                  </strong>
                  <span style={{ fontSize: '13px', color: '#475569', fontWeight: '700' }}>
                    ({currentLang === 'te' ? c.nameTe : c.nameHi})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* =================================================================== */}
        {/* COLUMN 2: DIAGNOSE BY SYMPTOMS                                      */}
        {/* =================================================================== */}
        <div style={{
          background: '#F8FAFC',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
              Diagnose by Symptoms
            </h3>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: '#4F46E5',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Camera size={13} />
              <span>Upload Leaf</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoUpload}
            />
          </div>

          {/* Photo Analysis Status Banner */}
          {isAnalyzingPhoto && (
            <div style={{
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: '10px',
              padding: '10px 12px',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Loader2 size={16} className="spin-icon" style={{ color: '#2563EB' }} />
              <span style={{ fontSize: '12px', color: '#1E40AF', fontWeight: '700' }}>
                Gemini Vision inspecting plant leaf & symptoms...
              </span>
            </div>
          )}

          {uploadedImagePreview && (
            <div style={{
              position: 'relative',
              borderRadius: '12px',
              overflow: 'hidden',
              marginBottom: '12px',
              maxHeight: '140px',
              border: '2px solid #4F46E5'
            }}>
              <img
                src={uploadedImagePreview}
                alt="Uploaded plant scan"
                style={{ width: '100%', height: '140px', objectFit: 'cover' }}
              />
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'rgba(0,0,0,0.65)',
                color: '#FFFFFF',
                fontSize: '11px',
                padding: '4px 8px',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <span>📸 Gemini Vision Leaf Scan</span>
                <button
                  type="button"
                  onClick={() => setUploadedImagePreview(null)}
                  style={{ background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Symptom Cards Grid matching screenshot */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {currentSymptoms.map((sym) => {
              const isSelected = selectedSymptomKey === sym.key;
              return (
                <button
                  key={sym.key}
                  type="button"
                  onClick={() => setSelectedSymptomKey(sym.key)}
                  style={{
                    background: '#FFFFFF',
                    border: isSelected ? '3px solid #DC2626' : '1.5px solid #E2E8F0',
                    borderRadius: '14px',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 6px 16px rgba(220, 38, 38, 0.2)' : '0 2px 4px rgba(0,0,0,0.02)',
                    transition: 'all 0.15s'
                  }}
                >
                  {/* Artwork / Image placeholder */}
                  <div style={{ width: '100%', height: '100px', marginBottom: '8px', overflow: 'hidden' }}>
                    {renderSymptomArtwork(sym.imageSvg)}
                  </div>

                  <strong style={{ fontSize: '15px', color: '#B91C1C', display: 'block', textAlign: 'center', margin: '0 0 2px' }}>
                    {sym.nameEn}
                  </strong>
                  <span style={{ fontSize: '13px', color: '#991B1B', fontWeight: '800', textAlign: 'center', display: 'block', marginBottom: '4px' }}>
                    ({currentLang === 'te' ? sym.nameTe : sym.nameHi})
                  </span>
                  <span style={{ fontSize: '11px', color: '#475569', textAlign: 'center' }}>
                    {sym.tag}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* =================================================================== */}
        {/* COLUMN 3: ACTIONABLE SOLUTION                                      */}
        {/* =================================================================== */}
        <div style={{
          background: '#F8FAFC',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '16px'
        }}>
          {/* Header with Dynamic Pump Selector */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
              Actionable Solution
            </h3>

            {/* Dynamic Tank Volume Selector Buttons */}
            <div style={{ display: 'flex', gap: '4px', background: '#FFFFFF', padding: '3px', borderRadius: '8px', border: '1px solid #CBD5E1' }}>
              {[15, 20, 50, 200].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setTankLiters(size)}
                  style={{
                    background: tankLiters === size ? '#1E3A8A' : 'transparent',
                    color: tankLiters === size ? '#FFFFFF' : '#475569',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                >
                  {size}L
                </button>
              ))}
            </div>
          </div>

          {/* Actionable Solution Bottle Cards Grid matching screenshot */}
          {isLoadingDiagnosis ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
              <Loader2 size={36} className="spin-icon" style={{ color: '#16A34A' }} />
            </div>
          ) : diagnosticData?.actionable_solutions?.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px' }}>
              {diagnosticData.actionable_solutions.map((sol: any) => renderBottleCard(sol))}
            </div>
          ) : (
            <div style={{ background: '#FFFFFF', padding: '30px', borderRadius: '12px', textAlign: 'center', border: '1px solid #E2E8F0' }}>
              <Info size={32} style={{ color: '#94A3B8', margin: '0 auto 8px' }} />
              <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                No specific chemical registered for this exact symptom in isolated database. Consult the AI advisor below.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 5. Sticky Bottom Ask AI Doctor Input Bar matching screenshot */}
      <div style={{
        marginTop: '24px',
        position: 'sticky',
        bottom: '16px',
        zIndex: 40
      }}>
        <div style={{
          background: '#FFFFFF',
          borderRadius: '999px',
          border: '1.5px solid #CBD5E1',
          padding: '6px 14px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{ fontSize: '18px' }}>💬</span>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                executeRagQuery(chatInput);
              }
            }}
            placeholder={
              currentLang === 'hi'
                ? 'Ask anything... (e.g., tomato fruit borer dosage? / क्या टमाटर में 2,4-D डाल सकते हैं?)'
                : 'Ask anything... (e.g., tomato fruit borer dosage? / Can I spray 2,4-D on tomato?)'
            }
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '14px',
              fontWeight: '600',
              color: '#0F172A',
              background: 'transparent'
            }}
          />

          <button
            type="button"
            onClick={() => executeRagQuery(chatInput)}
            disabled={isSubmittingChat || !chatInput.trim()}
            style={{
              background: '#047857',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '999px',
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: '800',
              cursor: isSubmittingChat || !chatInput.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: isSubmittingChat || !chatInput.trim() ? 0.6 : 1
            }}
          >
            {isSubmittingChat ? <Loader2 size={14} className="spin-icon" /> : <Send size={14} />}
            <span>Consult AI</span>
          </button>

          {/* Floating trigger Ask AI matching screenshot eggplant button */}
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('open-ai-voice-bot'));
              }
            }}
            style={{
              background: '#064E3B',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '999px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(6, 78, 59, 0.4)'
            }}
          >
            <span>Ask AI</span>
            <span style={{ fontSize: '18px' }}>🍆</span>
          </button>
        </div>
      </div>

      {/* 6. Gemini RAG Grounded Answer Modal Drawer */}
      {ragDrawerOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 100,
          padding: '16px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            maxWidth: '760px',
            width: '100%',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #CBD5E1',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
              color: '#FFFFFF',
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Bot size={22} style={{ color: '#34D399' }} />
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#FFFFFF' }}>
                    {currentLang === 'hi' ? 'कृषि परामर्श सहायक (AI Advisor)' : 'Crop Advisory Assistant (AI Advisor)'}
                  </h3>
                  <span style={{ fontSize: '11px', color: '#A7F3D0' }}>
                    {currentLang === 'hi' ? 'सत्यापित कृषि डेटाबेस द्वारा संचालित सटीक खुराक व सुरक्षा सलाह' : 'Grounded on verified agricultural database & safe dosage standards'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handlePlayVoice(ragResponse?.advisory?.replace(/[*#`_>]/g, ''))}
                  style={{
                    background: isSpeaking ? '#DC2626' : '#EA580C',
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
                  {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  <span>{isSpeaking ? 'Stop' : 'Audio'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRagDrawerOpen(false);
                    if (isSpeaking) {
                      window.speechSynthesis?.cancel();
                      setIsSpeaking(false);
                    }
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.15)',
                    border: 'none',
                    color: '#FFFFFF',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {isSubmittingChat ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Loader2 size={36} className="spin-icon" style={{ color: '#059669', margin: '0 auto 12px' }} />
                  <h4 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: '0 0 4px' }}>
                    {currentLang === 'hi' ? 'सत्यापित फसल डेटा से परामर्श तैयार हो रहा है...' : 'Retrieving Verified Crop Advisory & Dosage Format...'}
                  </h4>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>
                    Cross-checking approved crops, off-label hazard risks, and pump dilution formulas.
                  </p>
                </div>
              ) : ragResponse ? (
                <div>
                  {/* Top metadata tags */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                    <span style={{
                      background: '#DCFCE7',
                      color: '#166534',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '800'
                    }}>
                      🏛️ {ragResponse.rag_context_count} CIBRC Database Rows Grounded
                    </span>
                    <span style={{
                      background: '#EFF6FF',
                      color: '#1E40AF',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '700'
                    }}>
                      Engine: {ragResponse.llm_engine}
                    </span>
                  </div>

                  {/* Advisory Text */}
                  <div style={{
                    fontSize: '14px',
                    color: '#1E293B',
                    lineHeight: '1.7',
                    whiteSpace: 'pre-wrap',
                    background: '#F8FAFC',
                    borderRadius: '12px',
                    padding: '16px',
                    border: '1px solid #E2E8F0'
                  }}>
                    {ragResponse.advisory}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
