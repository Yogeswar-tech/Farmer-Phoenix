import { useState, useEffect, useRef, type FC, type FormEvent } from 'react';
import type { Language, LocationOption } from '../types';
import { WEATHER_FORECAST, SEASONAL_CLIMATE, CROP_SUITABILITY_MAP } from '../data/mockData';
import { translations } from '../data/i18n';
import { KisanSethuApi } from '../services/api';
import {
  CloudSun,
  Calendar,
  AlertTriangle,
  ShieldCheck,
  Lock,
  Sun,
  Cloud,
  CloudRain,
  Search,
  MapPin,
  Radio,
  Sprout,
  CheckCircle2,
  Droplets,
  Wind,
  Navigation,
  Loader2,
  Volume2,
  VolumeX,
  Filter,
  Layers,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Tractor
} from 'lucide-react';

interface ClimatePredictionViewProps {
  currentLang: Language;
  isLoggedIn: boolean;
  onOpenLogin: (featureName: string) => void;
  currentLocation: LocationOption;
}

// Major Agricultural Belts across India for quick 1-tap switching
const ALL_INDIA_AGRI_BELTS = [
  { id: 'punjab-wheat', name: { en: 'Punjab & Haryana (Wheat / Paddy / Mustard)', hi: 'पंजाब-हरियाणा (गेहूं / धान / सरसों)', te: 'పంజాబ్ & హర్యానా (గోధుమ / వరి)' }, query: 'Ludhiana Punjab', lat: 30.9010, lon: 75.8573, pin: '141001', state: 'Punjab' },
  { id: 'maharashtra-onion', name: { en: 'Maharashtra (Onion / Grapes / Cotton)', hi: 'महाराष्ट्र (प्याज / अंगूर / सोयाबीन)', te: 'మహారాష్ట్ర (ఉల్లి / ద్రాక్ష)' }, query: 'Nashik Maharashtra', lat: 19.9975, lon: 73.7898, pin: '422001', state: 'Maharashtra' },
  { id: 'ap-chilli', name: { en: 'Andhra & Telangana (Chilli / Cotton / Turmeric)', hi: 'आंध्र-तेलंगाना (मिर्च / कपास / हल्दी)', te: 'ఆంధ్ర & తెలంగాణ (మిర్చి / పత్తి)' }, query: 'Guntur Andhra Pradesh', lat: 16.3067, lon: 80.4365, pin: '522004', state: 'Andhra Pradesh' },
  { id: 'up-gangetic', name: { en: 'Uttar Pradesh (Sugarcane / Potato / Wheat)', hi: 'उत्तर प्रदेश (गन्ना / आलू / गेहूं)', te: 'ఉత్తరప్రదేశ్ (చెరకు / బంగాళాదుంప)' }, query: 'Varanasi Uttar Pradesh', lat: 25.3176, lon: 82.9739, pin: '221001', state: 'Uttar Pradesh' },
  { id: 'mp-malwa', name: { en: 'Madhya Pradesh (Soybean / Gram / Wheat)', hi: 'मध्य प्रदेश (सोयाबीन / चना / गेहूं)', te: 'మధ్యప్రదేశ్ (సోయాబీన్ / శనగలు)' }, query: 'Indore Madhya Pradesh', lat: 22.7196, lon: 75.8577, pin: '452001', state: 'Madhya Pradesh' },
  { id: 'gujarat-saurashtra', name: { en: 'Gujarat (Groundnut / Cotton / Cumin)', hi: 'गुजरात (मूंगफली / कपास / जीरा)', te: 'గుజరాత్ (వేరుశనగ / పత్తి)' }, query: 'Rajkot Gujarat', lat: 22.3039, lon: 70.8022, pin: '360001', state: 'Gujarat' },
  { id: 'karnataka-horti', name: { en: 'Karnataka (Tomato / Maize / Arecanut)', hi: 'कर्नाटक (टमाटर / मक्का / सुपारी)', te: 'కర్ణాటక (టమోటా / మొక్కజొన్న)' }, query: 'Kolar Karnataka', lat: 13.1367, lon: 78.1292, pin: '563101', state: 'Karnataka' },
  { id: 'bihar-plains', name: { en: 'Bihar (Maize / Litchi / Pulses)', hi: 'बिहार (मक्का / लीची / दालें)', te: 'బీహార్ (మొక్కజొన్న / పప్పుధాన్యాలు)' }, query: 'Muzaffarpur Bihar', lat: 26.1209, lon: 85.3647, pin: '842001', state: 'Bihar' },
  { id: 'tn-delta', name: { en: 'Tamil Nadu (Paddy / Banana / Coconut)', hi: 'तमिलनाडु (धान / केला / नारियल)', te: 'తమిళనాడు (వరి / అరటి)' }, query: 'Thanjavur Tamil Nadu', lat: 10.7870, lon: 79.1378, pin: '613001', state: 'Tamil Nadu' }
];

type DayTypeFilter = 'all' | 'safe_spray' | 'rain_alert' | 'harvest_drying' | 'sowing_ready' | 'high_risk';

// Universal helper to safely extract localized text from strings, numbers, or multi-language objects
export const getLocText = (val: any, lang: Language): string => {
  if (val === undefined || val === null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    return val[lang] || val.en || val.hi || val.te || Object.values(val)[0] || '';
  }
  return String(val);
};

const initialForecastDays = WEATHER_FORECAST.map((d: any) => ({
  ...d,
  fullDayName: d.dayName,
  formattedDate: d.date,
  dryingWindow: 'Optimal Sun-Drying 9 AM - 4 PM',
  irrigationAdvice: 'Normal irrigation recommended'
}));

export const ClimatePredictionView: FC<ClimatePredictionViewProps> = ({
  currentLang,
  isLoggedIn,
  onOpenLogin,
  currentLocation
}) => {
  const t = translations[currentLang];

  // Search & Geocoding State (All India)
  const [searchInput, setSearchInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLocatingGps, setIsLocatingGps] = useState(false);

  // Active Selected Location
  const [activeLocation, setActiveLocation] = useState<any>({
    name: getLocText(currentLocation.name, currentLang),
    district: getLocText(currentLocation.district, currentLang),
    state: getLocText(currentLocation.state, currentLang),
    pincode: currentLocation.pincode,
    lat: currentLocation.lat || 16.3067,
    lon: currentLocation.lng || 80.4365,
    zone: `${getLocText(currentLocation.state, currentLang)} Agricultural Zone`,
    id: currentLocation.id
  });

  // Weather & Telemetry State
  const [unifiedData, setUnifiedData] = useState<any | null>(null);
  const [forecastDays, setForecastDays] = useState<any[]>(initialForecastDays);
  const [calendarDays, setCalendarDays] = useState<any[]>([]);
  const [isLiveSynced, setIsLiveSynced] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Just now');

  // Horizon & Calendar Navigation
  const [horizonDays, setHorizonDays] = useState<number>(16);
  const [activeViewMode, setActiveViewMode] = useState<'cards' | 'calendar'>('cards');
  const [selectedDayType, setSelectedDayType] = useState<DayTypeFilter>('all');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [expandedDayIndex, setExpandedDayIndex] = useState<number | null>(0); // Default open today

  // Farmer-Centric Date & Range Control
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDatePreset, setSelectedDatePreset] = useState<'today' | 'tomorrow' | '3days' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState<string>(todayStr);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  // Pictorial Agricultural Map Wizard State
  const [showMapWizard, setShowMapWizard] = useState<boolean>(false);
  const [mapWizardLayer, setMapWizardLayer] = useState<'radar' | 'soil_moisture' | 'temperature' | 'agro_scenario'>('radar');

  // Audio Voice Salla (TTS)
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync if global location changes from header
  useEffect(() => {
    setActiveLocation({
      name: getLocText(currentLocation.name, currentLang),
      district: getLocText(currentLocation.district, currentLang),
      state: getLocText(currentLocation.state, currentLang),
      pincode: currentLocation.pincode,
      lat: currentLocation.lat || 16.3067,
      lon: currentLocation.lng || 80.4365,
      zone: `${getLocText(currentLocation.state, currentLang)} Agricultural Zone`,
      id: currentLocation.id
    });
  }, [currentLocation.id, currentLang]);

  // Main Unified Climate Fetch (Open-Meteo Satellite + IMD + Farm Decisions)
  const fetchUnifiedClimate = async (loc: any, daysCount: number = horizonDays) => {
    setIsLoading(true);
    const startTime = performance.now();
    try {
      const res = await KisanSethuApi.getClimatePrediction(
        loc.id || 'custom',
        getLocText(loc.district, currentLang) || getLocText(loc.name, currentLang),
        loc.lat,
        loc.lon,
        currentLang,
        getLocText(loc.name, currentLang),
        daysCount
      );

      const endTime = performance.now();
      setLatencyMs(Math.round(endTime - startTime));

      if (res && res.status === 'success') {
        setUnifiedData(res);
        if (res.forecast_days && res.forecast_days.length > 0) {
          setForecastDays(res.forecast_days);
        } else if (res.forecast_7days) {
          setForecastDays(res.forecast_7days);
        }

        if (res.calendar_days) {
          setCalendarDays(res.calendar_days);
        }

        if (res.location) {
          setActiveLocation((prev: any) => ({
            ...prev,
            name: getLocText(res.location.name, currentLang),
            district: getLocText(res.location.district, currentLang),
            state: getLocText(res.location.state, currentLang),
            pincode: res.location.pincode || prev.pincode,
            zone: getLocText(res.location.agroClimaticZone || prev.zone, currentLang),
            lat: res.location.latitude || prev.lat,
            lon: res.location.longitude || prev.lon
          }));
        }

        setIsLiveSynced(true);
        setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (err) {
      console.warn('[Climate View] Backend fetch error:', err);
      setIsLiveSynced(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUnifiedClimate(activeLocation, horizonDays);
  }, [activeLocation.lat, activeLocation.lon, horizonDays, currentLang]);

  // All-India Dynamic Location Autocomplete
  useEffect(() => {
    if (!searchInput.trim() || searchInput.trim().length < 2) {
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const locations = await KisanSethuApi.searchClimateLocations(searchInput.trim());
        setSearchResults(locations);
        setShowSuggestions(locations.length > 0);
      } catch (err) {
        console.warn('Location search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Handle Search Submit
  const handleSearchSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;

    if (searchResults.length > 0) {
      selectLocationResult(searchResults[0]);
    } else {
      // Direct query to backend
      const customLoc = {
        name: searchInput.trim(),
        district: searchInput.trim(),
        state: 'India',
        pincode: '',
        lat: undefined,
        lon: undefined,
        id: searchInput.trim().toLowerCase().replace(/\s+/g, '-')
      };
      setShowSuggestions(false);
      setActiveLocation(customLoc);
    }
  };

  // Select a suggestion from All-India search
  const selectLocationResult = (loc: any) => {
    setActiveLocation({
      name: getLocText(loc.name, currentLang),
      district: getLocText(loc.district, currentLang),
      state: getLocText(loc.state, currentLang),
      pincode: loc.pincode,
      lat: loc.latitude,
      lon: loc.longitude,
      zone: getLocText(loc.zone, currentLang),
      id: loc.id
    });
    setSearchInput(getLocText(loc.name, currentLang));
    setShowSuggestions(false);
  };

  // 1-Tap Farm GPS Detector
  const handleDetectFarmGps = () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      alert(currentLang === 'hi' ? 'आपके ब्राउज़र में जीपीएस उपलब्ध नहीं है।' : 'GPS geolocation is not supported in this browser.');
      return;
    }

    setIsLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const resolved = await KisanSethuApi.reverseGeocodeLocation(lat, lon);

          if (resolved) {
            setActiveLocation({
              name: getLocText(resolved.name, currentLang),
              district: getLocText(resolved.district, currentLang),
              state: getLocText(resolved.state, currentLang),
              pincode: resolved.pincode,
              lat: resolved.latitude,
              lon: resolved.longitude,
              zone: getLocText(resolved.zone, currentLang),
              id: resolved.id
            });
            setSearchInput(`${getLocText(resolved.name, currentLang)}, ${getLocText(resolved.district, currentLang)}`);
          } else {
            setActiveLocation({
              name: `Farm (${lat.toFixed(2)}N, ${lon.toFixed(2)}E)`,
              district: 'Local District',
              state: 'India',
              pincode: '',
              lat,
              lon,
              zone: 'Indian Farm Zone',
              id: `gps-${lat.toFixed(2)}-${lon.toFixed(2)}`
            });
          }
        } catch (err) {
          console.warn('GPS reverse geocode error:', err);
        } finally {
          setIsLocatingGps(false);
        }
      },
      () => {
        setIsLocatingGps(false);
        alert(
          currentLang === 'hi'
            ? 'जीपीएस स्थान प्राप्त नहीं हुआ। कृपया ऊपर खोज बार में अपना गांव या पिनकोड दर्ज करें।'
            : currentLang === 'te'
              ? 'జీపీఎస్ స్థానం లభించలేదు. దయచేసి శోధన పెట్టెలో మీ గ్రామం పేరు నమోదు చేయండి.'
              : 'Could not access GPS. Please type your village, district, or PIN code above.'
        );
      },
      { enableHighAccuracy: true, timeout: 9000 }
    );
  };

  // Audio Kisan Salla (Speech Synthesis)
  const handlePlayAudioAdvice = (specificAdvice?: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported on this device.');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    let textToSpeak = specificAdvice;
    if (!textToSpeak) {
      if (unifiedData?.audio_advisory) {
        textToSpeak = getLocText(unifiedData.audio_advisory, currentLang);
      } else {
        const cur = unifiedData?.current_conditions;
        const temp = cur ? cur.temperatureC : 31;
        const wind = cur ? cur.windSpeedKmh : 12;
        const locName = getLocText(activeLocation.name, currentLang);
        if (currentLang === 'hi') {
          textToSpeak = `${locName} के किसान भाइयों के लिए आज का मौसम: तापमान ${temp} डिग्री सेल्सियस है। हवा की गति ${wind} किलोमीटर प्रति घंटा है। छिड़काव के लिए सुबह 7 से 11 बजे का समय सुरक्षित है।`;
        } else if (currentLang === 'te') {
          textToSpeak = `${locName} రైతులకు వాతావరణ సమాచారం: నేడు ఉష్ణోగ్రత ${temp} డిగ్రీలు. గాలి వేగం ${wind} కి.మీ. ఉదయం వేళల్లో స్ప్రే చేయడం సురక్షితం.`;
        } else {
          textToSpeak = `Weather advisory for farmers of ${locName}: Current temperature is ${temp} degrees Celsius, wind speed is ${wind} km per hour. Safe spraying window is active today.`;
        }
      }
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = currentLang === 'hi' ? 'hi-IN' : currentLang === 'te' ? 'te-IN' : 'en-IN';
    utterance.rate = 0.95; // Slightly slower for clear village audio

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Filter Days based on Day-Type
  const daysSliced = selectedDatePreset === 'today'
    ? forecastDays.slice(0, 2)
    : selectedDatePreset === '3days'
      ? forecastDays.slice(0, 3)
      : selectedDatePreset === 'custom'
        ? forecastDays.slice(0, 5)
        : forecastDays.slice(0, horizonDays);

  const filteredForecastDays = daysSliced.filter((day) => {
    if (selectedDayType === 'all') return true;
    if (selectedDayType === 'safe_spray') return day.sprayStatus === 'SAFE' || day.riskLevel === 'safe';
    if (selectedDayType === 'rain_alert') return day.rainChance >= 35 || (day.precipMm && day.precipMm >= 3.0);
    if (selectedDayType === 'harvest_drying') return day.riskLevel === 'safe' && day.rainChance <= 20;
    if (selectedDayType === 'sowing_ready') return day.soilSuitability?.status === 'FAVORABLE';
    if (selectedDayType === 'high_risk') return day.riskLevel === 'danger' || day.windSpeedKmh >= 18.0;
    return true;
  });

  // Extract Unified Conditions & Advisories
  const currentConditions = unifiedData?.current_conditions;
  const activeAlert = unifiedData?.risk_alert;
  const activeCrops = unifiedData?.crop_suitability || CROP_SUITABILITY_MAP[activeLocation.id] || CROP_SUITABILITY_MAP['default'] || CROP_SUITABILITY_MAP['kadapa'] || [];
  const activeSeasonal = unifiedData?.seasonal_outlook || SEASONAL_CLIMATE;
  const activeZone = getLocText(activeLocation.zone || `${getLocText(activeLocation.name, currentLang)} Agro-Climatic Zone`, currentLang);

  return (
    <div className="climate-prediction-view-container" style={{ maxWidth: '1280px', margin: '0 auto', padding: '16px' }}>
      {/* 1. Header Banner & Engine Telemetry Strip */}
      <div className="view-header-strip" style={{
        background: 'linear-gradient(135deg, #064E3B 0%, #065F46 60%, #047857 100%)',
        color: '#FFFFFF',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 10px 25px -5px rgba(6, 78, 59, 0.25)',
        position: 'relative',
        overflow: 'hidden',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div style={{ background: 'rgba(255,255,255,0.18)', padding: '10px', borderRadius: '12px', display: 'flex' }}>
                <CloudSun size={28} style={{ color: '#FDE047' }} />
              </div>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: '800', margin: 0, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
                  {currentLang === 'hi' ? 'अखिल भारतीय कृषि जलवायु एवं मौसम पूर्वानुमान' : currentLang === 'te' ? 'భారతదేశ వ్యవసాయ వాతావరణ అంచనా' : 'All-India Agricultural Climate & Weather Intelligence'}
                </h2>
                <div style={{ fontSize: '13px', color: '#A7F3D0', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <span>📍 {getLocText(activeLocation.name, currentLang)}, {getLocText(activeLocation.district, currentLang)} ({getLocText(activeLocation.state, currentLang)})</span>
                  <span>•</span>
                  <span>🌾 {activeZone}</span>
                </div>
              </div>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#D1FAE5', maxWidth: '780px', lineHeight: '1.5' }}>
              {currentLang === 'hi'
                ? 'उपग्रह एवं भारतीय मौसम विभाग (IMD) रडार द्वारा 16-दिवसीय सटीक मौसम, कीटनाशक छिड़काव खिड़की, स्मार्ट सिंचाई सलाह एवं फसल सुरक्षा।'
                : currentLang === 'te'
                  ? 'శాటిలైట్ మరియు IMD రాడార్ ద్వారా 16 రోజుల ఖచ్చితమైన వాతావరణం, స్ప్రే సమయాలు, స్మార్ట్ నీటి యాజమాన్యం మరియు పంట రక్షణ.'
                  : 'High-resolution satellite feeds & IMD radar predicting 16-day operational weather, safe spray windows, smart irrigation schedules, and crop disease prevention.'}
            </p>
          </div>

          {/* Telemetry / Live Sync Status & Voice Button */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handlePlayAudioAdvice()}
                className="audio-voice-btn"
                style={{
                  background: isSpeaking ? '#DC2626' : '#F59E0B',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '8px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
                  transition: 'all 0.2s'
                }}
              >
                {isSpeaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
                <span>
                  {isSpeaking
                    ? (currentLang === 'hi' ? 'सलाह रोकें' : 'Stop Audio')
                    : (currentLang === 'hi' ? '🔊 किसान सलाह सुनें' : currentLang === 'te' ? '🔊 వాతావరణం వినండి' : '🔊 Listen Audio Advisory')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => fetchUnifiedClimate(activeLocation, horizonDays)}
                disabled={isLoading}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  color: '#FFFFFF',
                  borderRadius: '999px',
                  padding: '8px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={14} className={isLoading ? 'spin-icon' : ''} />
                <span>{isLoading ? 'Syncing...' : `Sync (${latencyMs}ms)`}</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#A7F3D0' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: isLiveSynced ? '#34D399' : '#FBBF24' }}></span>
              <span>{isLiveSynced ? '🟢 IMD & Satellite Feed Live' : '🟡 Resilient Cache Mode'}</span>
              <span>•</span>
              <span>Updated: {lastSyncTime}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. All-India Universal Search Bar & GPS Detector */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '20px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={18} style={{ color: '#059669' }} />
              <span>{currentLang === 'hi' ? 'पूरे भारत में अपना गांव या खेत चुनें' : currentLang === 'te' ? 'భారతదేశంలో మీ గ్రామం ఎంచుకోండి' : 'Select Any Village, Tehsil, District, or PIN in India'}</span>
            </h3>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0' }}>
              {currentLang === 'hi'
                ? 'कोई सीमित सूची नहीं! भारत के सभी 28 राज्यों, 750+ जिलों एवं गांवों का सटीक मौसम उपलब्ध है।'
                : 'No restrictive list! High-precision operational weather available for all Indian villages, tehsils, and PIN codes.'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{
              background: '#ECFDF5',
              border: '1px solid #A7F3D0',
              color: '#065F46',
              borderRadius: '10px',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>🔒 📍 {t.lockedFarmLocation || 'Current Farm (GPS Locked)'}: {getLocText(currentLocation.name, currentLang)}</span>
            </span>

            {activeLocation.id !== currentLocation.id && (
              <button
                type="button"
                onClick={() => {
                  setActiveLocation({
                    name: getLocText(currentLocation.name, currentLang),
                    district: getLocText(currentLocation.district, currentLang),
                    state: getLocText(currentLocation.state, currentLang),
                    pincode: currentLocation.pincode,
                    lat: currentLocation.lat || 16.3067,
                    lon: currentLocation.lng || 80.4365,
                    zone: `${getLocText(currentLocation.state, currentLang)} Agricultural Zone`,
                    id: currentLocation.id
                  });
                  setSearchInput('');
                }}
                style={{
                  background: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  color: '#334155',
                  borderRadius: '10px',
                  padding: '8px 14px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                {t.returnToLockedFarm || '🔙 Return to My Farm'}
              </button>
            )}
          </div>
        </div>

        {/* Search Input with Dynamic Suggestions Dropdown */}
        <div ref={searchContainerRef} style={{ position: 'relative' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px' }}>
            <div style={{
              flex: 1,
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              background: '#F8FAFC',
              border: '1.5px solid #CBD5E1',
              borderRadius: '12px',
              padding: '0 14px'
            }}>
              <Search size={18} style={{ color: '#64748B', marginRight: '10px', flexShrink: 0 }} />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onFocus={() => { if (searchResults.length > 0) setShowSuggestions(true); }}
                placeholder={
                  currentLang === 'hi'
                    ? 'गांव का नाम, तहसील, जिला या 6-अंकीय पिनकोड लिखें (उदा. Fazilka, 518501, Baramati)...'
                    : currentLang === 'te'
                      ? 'గ్రామం, మండలం, జిల్లా లేదా పిన్‌కోడ్ నమోదు చేయండి (ఉదా. Nandyal, 522004)...'
                      : 'Type village, tehsil, district, or 6-digit PIN code anywhere in India (e.g. Fazilka, 518501, Nashik)...'
                }
                style={{
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  padding: '12px 0',
                  fontSize: '14px',
                  color: '#0F172A',
                  outline: 'none',
                  fontWeight: '500'
                }}
              />
              {isSearching && <Loader2 size={16} className="spin-icon" style={{ color: '#059669' }} />}
              {searchInput && !isSearching && (
                <button
                  type="button"
                  onClick={() => { setSearchInput(''); setSearchResults([]); setShowSuggestions(false); }}
                  style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px' }}
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                background: '#059669',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '12px',
                padding: '0 24px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Search size={16} />
              <span>{isLoading ? '...' : (currentLang === 'hi' ? 'मौसम देखें' : 'View Weather')}</span>
            </button>
          </form>

          {/* Floating Autocomplete Suggestions */}
          {showSuggestions && searchResults.length > 0 && (
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
              maxHeight: '320px',
              overflowY: 'auto'
            }}>
              <div style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: '#64748B', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {currentLang === 'hi' ? 'भारत भर से प्राप्त स्थान (सुझाव):' : 'All-India Location Matches:'}
              </div>
              {searchResults.map((loc: any, idx: number) => (
                <div
                  key={loc.id || idx}
                  onClick={() => selectLocationResult(loc)}
                  style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid #F1F5F9',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F0FDF4')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: '#E0F2FE', color: '#0284C7', padding: '6px', borderRadius: '8px' }}>
                      <MapPin size={16} />
                    </div>
                    <div>
                      <strong style={{ fontSize: '14px', color: '#0F172A', display: 'block' }}>
                        {getLocText(loc.name, currentLang)} {loc.pincode ? `(PIN ${loc.pincode})` : ''}
                      </strong>
                      <span style={{ fontSize: '12px', color: '#64748B' }}>
                        {getLocText(loc.district, currentLang)}, {getLocText(loc.state, currentLang)} • {getLocText(loc.zone, currentLang)}
                      </span>
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', color: '#059669', fontWeight: '700' }}>
                    {loc.source === 'india_post_pincode' ? '📮 Postal PIN' : '🛰️ Satellite Pin'} ➔
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Regional Agricultural Belts (Pan-India) */}
        <div style={{ marginTop: '14px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={14} style={{ color: '#059669' }} />
            <span>{currentLang === 'hi' ? 'प्रमुख भारतीय कृषि क्षेत्र (1-क्लिक चयन):' : currentLang === 'te' ? 'భారతదేశ వ్యవసాయ ప్రాంతాలు:' : 'Major Indian Agricultural Belts (1-Click Switch):'}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {ALL_INDIA_AGRI_BELTS.map((belt) => {
              const locNameStr = getLocText(activeLocation.name, currentLang).toLowerCase();
              const locDistStr = getLocText(activeLocation.district, currentLang).toLowerCase();
              const queryFirst = belt.query.split(' ')[0].toLowerCase();
              const isSelected = locNameStr.includes(queryFirst) || locDistStr.includes(queryFirst);
              return (
                <button
                  key={belt.id}
                  type="button"
                  onClick={() => {
                    setActiveLocation({
                      name: belt.query.split(' ')[0],
                      district: belt.query.split(' ')[0],
                      state: belt.state,
                      pincode: belt.pin,
                      lat: belt.lat,
                      lon: belt.lon,
                      zone: `${belt.state} Agricultural Belt`,
                      id: belt.id
                    });
                    setSearchInput(belt.query.split(' ')[0]);
                  }}
                  style={{
                    background: isSelected ? '#065F46' : '#F1F5F9',
                    color: isSelected ? '#FFFFFF' : '#334155',
                    border: isSelected ? '1px solid #065F46' : '1px solid #E2E8F0',
                    borderRadius: '999px',
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: isSelected ? '700' : '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s'
                  }}
                >
                  <span>{getLocText(belt.name, currentLang)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Current Active Location Microclimate Strip */}
        {currentConditions && (
          <div style={{
            marginTop: '16px',
            background: 'linear-gradient(to right, #F0FDF4, #ECFDF5)',
            border: '1px solid #BBF7D0',
            borderRadius: '12px',
            padding: '14px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: '#059669', color: '#FFFFFF', padding: '8px', borderRadius: '10px' }}>
                <Radio size={20} />
              </div>
              <div>
                <strong style={{ fontSize: '15px', color: '#064E3B', display: 'block' }}>
                  📍 {getLocText(activeLocation.name, currentLang)}, {getLocText(activeLocation.district, currentLang)} ({getLocText(activeLocation.state, currentLang)})
                </strong>
                <span style={{ fontSize: '12px', color: '#047857' }}>
                  {activeLocation.pincode ? `PIN ${activeLocation.pincode} • ` : ''}Lat {Number(activeLocation.lat || 0).toFixed(2)}°N, Lon {Number(activeLocation.lon || 0).toFixed(2)}°E
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ background: '#FFFFFF', padding: '6px 12px', borderRadius: '8px', border: '1px solid #D1FAE5', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>
                <Sun size={15} style={{ color: '#F59E0B' }} />
                <span>{currentConditions.temperatureC}°C</span>
              </div>
              <div style={{ background: '#FFFFFF', padding: '6px 12px', borderRadius: '8px', border: '1px solid #D1FAE5', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>
                <Droplets size={15} style={{ color: '#0284C7' }} />
                <span>{currentConditions.humidityPct}% {currentLang === 'hi' ? 'नमी' : 'Humidity'}</span>
              </div>
              <div style={{ background: '#FFFFFF', padding: '6px 12px', borderRadius: '8px', border: '1px solid #D1FAE5', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>
                <Wind size={15} style={{ color: '#059669' }} />
                <span>{currentConditions.windSpeedKmh} km/h {currentLang === 'hi' ? 'हवा' : 'Wind'}</span>
              </div>
              <div style={{
                background: currentConditions.windSpeedKmh < 15 ? '#DCFCE7' : '#FEF3C7',
                color: currentConditions.windSpeedKmh < 15 ? '#166534' : '#92400E',
                padding: '6px 12px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: '800'
              }}>
                <ShieldCheck size={14} />
                <span>{getLocText(currentConditions.sprayWindowToday, currentLang)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Dynamic Weather Risk Banner (Squall / Heavy Rain / Frost) */}
      {activeAlert && activeAlert.hasAlert ? (
        <div style={{
          background: activeAlert.riskLevel === 'danger' ? '#FEF2F2' : '#FFFBEB',
          borderLeft: `5px solid ${activeAlert.riskLevel === 'danger' ? '#DC2626' : '#F59E0B'}`,
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '14px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
        }}>
          <AlertTriangle size={24} style={{ color: activeAlert.riskLevel === 'danger' ? '#DC2626' : '#F59E0B', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ fontSize: '15px', color: activeAlert.riskLevel === 'danger' ? '#991B1B' : '#92400E', display: 'block' }}>
              {getLocText(activeAlert.title, currentLang)} ({getLocText(activeLocation.name, currentLang)}):
            </strong>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: activeAlert.riskLevel === 'danger' ? '#B91C1C' : '#78350F', lineHeight: '1.5' }}>
              {getLocText(activeAlert.description, currentLang)}
            </p>
          </div>
        </div>
      ) : (
        <div style={{
          background: '#F0FDF4',
          borderLeft: '5px solid #16A34A',
          borderRadius: '12px',
          padding: '14px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <CheckCircle2 size={20} style={{ color: '#16A34A', flexShrink: 0 }} />
          <div style={{ fontSize: '13px', color: '#166534' }}>
            <strong>{currentLang === 'hi' ? 'खेती के लिए स्थिर मौसम अनुकूलता:' : 'Stable Farm Window Active:'} </strong>
            <span>
              {currentLang === 'hi'
                ? 'अगले 16 दिनों में भारी वर्षा या तेज आंधी का खतरा कम है। कीटनाशक छिड़काव, फसल सुखाई एवं सिंचाई सामान्य रूप से जारी रखें।'
                : 'Favorable operational window across the horizon. Safe for pesticide spraying, sun-drying, and scheduled irrigation.'}
            </span>
          </div>
        </div>
      )}

      {/* 4. Horizon Control, Interactive Calendar Button, & Day-Type Filters */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '20px',
        marginBottom: '20px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
      }}>
        {/* Horizon Tabs & Calendar Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={20} style={{ color: '#059669' }} />
              <span>{currentLang === 'hi' ? 'दैनिक कृषि मौसम एवं कार्ययोजना (Multi-Day Farm Outlook)' : 'Operational Farm Weather Outlook'}</span>
            </h3>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              {currentLang === 'hi'
                ? 'कैलेंडर बटन दबाकर किसी भी दिन का मौसम चुनें या दिन के प्रकार अनुसार छांटें'
                : 'Select any day from the calendar or filter by specific farming task'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {/* 1. Today & Tomorrow */}
            <button
              type="button"
              onClick={() => {
                setSelectedDatePreset('today');
                setHorizonDays(2);
                setShowMapWizard(false);
                setActiveViewMode('cards');
              }}
              style={{
                background: selectedDatePreset === 'today' && !showMapWizard ? '#059669' : '#F1F5F9',
                color: selectedDatePreset === 'today' && !showMapWizard ? '#FFFFFF' : '#334155',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              ⚡ {t.weatherToday || 'Today & Tomorrow'}
            </button>

            {/* 2. Next 3 Days Spray Planning */}
            <button
              type="button"
              onClick={() => {
                setSelectedDatePreset('3days');
                setHorizonDays(3);
                setShowMapWizard(false);
                setActiveViewMode('cards');
              }}
              style={{
                background: selectedDatePreset === '3days' && !showMapWizard ? '#059669' : '#F1F5F9',
                color: selectedDatePreset === '3days' && !showMapWizard ? '#FFFFFF' : '#334155',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              🚜 {t.weatherNext3Days || 'Next 3 Days (Spray Planning)'}
            </button>

            {/* 3. Custom Date or Range Calendar */}
            <button
              type="button"
              onClick={() => {
                setSelectedDatePreset('custom');
                setShowMapWizard(false);
                setActiveViewMode('calendar');
              }}
              style={{
                background: selectedDatePreset === 'custom' && !showMapWizard ? '#D97706' : '#FEF3C7',
                color: selectedDatePreset === 'custom' && !showMapWizard ? '#FFFFFF' : '#92400E',
                border: '1px solid #FCD34D',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>🗓️ {t.weatherCustomDatePicker || 'Pick Date / Range (Calendar)'}</span>
            </button>

            {/* 4. Pictorial Map Wizard Button */}
            <button
              type="button"
              onClick={() => {
                setShowMapWizard(!showMapWizard);
              }}
              style={{
                background: showMapWizard ? '#4338CA' : '#EEF2FF',
                color: showMapWizard ? '#FFFFFF' : '#3730A3',
                border: '1px solid #C7D2FE',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>🗺️ {t.weatherMapWizardTitle || 'Agri Map Wizard'}</span>
            </button>
          </div>
        </div>

        {/* Custom Date Range Inputs (When Custom Range is Selected) */}
        {selectedDatePreset === 'custom' && !showMapWizard && (
          <div style={{
            background: '#FFFBEB',
            borderRadius: '12px',
            border: '1px solid #FDE68A',
            padding: '14px 18px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} style={{ color: '#D97706' }} />
              <div>
                <strong style={{ fontSize: '13px', color: '#92400E' }}>
                  {currentLang === 'hi' ? 'अपनी इच्छित तारीख या समयावधि चुनें:' : 'Search Specific Date or Range for Farm Planning:'}
                </strong>
                <span style={{ fontSize: '11px', color: '#B45309', display: 'block' }}>
                  {currentLang === 'hi' ? 'छिड़काव व फसल कटाई हेतु उस दिन की मौसम अनुकूलता देखें' : 'Select target date to verify spray & harvesting conditions'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#78350F', display: 'block', marginBottom: '2px' }}>
                  {currentLang === 'hi' ? 'प्रारंभिक तिथि:' : 'Start Date:'}
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    fontWeight: '600',
                    background: '#FFFFFF'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#78350F', display: 'block', marginBottom: '2px' }}>
                  {currentLang === 'hi' ? 'समाप्ति तिथि:' : 'End Date:'}
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    fontWeight: '600',
                    background: '#FFFFFF'
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Pictorial Agricultural Map Wizard Component */}
        {showMapWizard && (
          <div style={{
            background: '#F8FAFC',
            borderRadius: '16px',
            border: '1.5px solid #CBD5E1',
            padding: '20px',
            marginBottom: '20px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
          }}>
            {/* Map Header & Layer Selector */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🗺️ {t.weatherMapWizardTitle || 'Farm Scenario & Land Conditions Map Wizard'}</span>
                </h4>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748B' }}>
                  {currentLang === 'hi'
                    ? 'चित्रमय मानचित्र: आपके क्षेत्र की वर्षा, मृदा नमी, भूमि तापमान एवं कृषि परिस्थितियों का त्वरित दृश्य।'
                    : 'Visual Land Conditions Map: Pictorial representation of regional rain, soil moisture, and land scenarios.'}
                </p>
              </div>

              {/* Map Layer Switcher */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setMapWizardLayer('radar')}
                  style={{
                    background: mapWizardLayer === 'radar' ? '#0284C7' : '#FFFFFF',
                    color: mapWizardLayer === 'radar' ? '#FFFFFF' : '#334155',
                    border: '1px solid #BAE6FD',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  🌧️ {t.mapRadarRain || 'Rain Radar'}
                </button>

                <button
                  type="button"
                  onClick={() => setMapWizardLayer('soil_moisture')}
                  style={{
                    background: mapWizardLayer === 'soil_moisture' ? '#059669' : '#FFFFFF',
                    color: mapWizardLayer === 'soil_moisture' ? '#FFFFFF' : '#334155',
                    border: '1px solid #A7F3D0',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  💧 {t.mapSoilMoisture || 'Soil Moisture'}
                </button>

                <button
                  type="button"
                  onClick={() => setMapWizardLayer('temperature')}
                  style={{
                    background: mapWizardLayer === 'temperature' ? '#D97706' : '#FFFFFF',
                    color: mapWizardLayer === 'temperature' ? '#FFFFFF' : '#334155',
                    border: '1px solid #FDE68A',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  ☀️ {t.mapTemperature || 'Heat Stress'}
                </button>

                <button
                  type="button"
                  onClick={() => setMapWizardLayer('agro_scenario')}
                  style={{
                    background: mapWizardLayer === 'agro_scenario' ? '#4F46E5' : '#FFFFFF',
                    color: mapWizardLayer === 'agro_scenario' ? '#FFFFFF' : '#334155',
                    border: '1px solid #C7D2FE',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  🌾 {t.mapZoneScenarios || 'Agro Scenarios'}
                </button>
              </div>
            </div>

            {/* Visual Pictorial Grid Map Display */}
            <div style={{
              background: '#0F172A',
              borderRadius: '14px',
              padding: '20px',
              color: '#FFFFFF',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontSize: '13px', color: '#94A3B8', fontWeight: '700' }}>
                  📍 {getLocText(activeLocation.name, currentLang)} Sector • {getLocText(activeLocation.district, currentLang)}
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '800',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: 'rgba(255,255,255,0.15)',
                  color: '#34D399'
                }}>
                  ● LIVE SATELLITE RADAR OVERLAY
                </span>
              </div>

              {/* Pictorial Visual Map Cells */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '12px',
                marginBottom: '16px'
              }}>
                {[
                  {
                    zone: currentLang === 'hi' ? 'उत्तर क्षेत्र (खेत)' : 'North Fields',
                    rain: '0.0 mm',
                    rainColor: '#10B981',
                    moisture: '42% (Optimal)',
                    moistureColor: '#10B981',
                    temp: '29°C',
                    tempColor: '#10B981',
                    terrain: currentLang === 'hi' ? 'काली चिकनी मिट्टी' : 'Black Clay Soil',
                    status: 'SAFE'
                  },
                  {
                    zone: currentLang === 'hi' ? 'पूर्व क्षेत्र (मंडी)' : 'East Sector',
                    rain: '1.5 mm',
                    rainColor: '#38BDF8',
                    moisture: '48% (Good)',
                    moistureColor: '#10B981',
                    temp: '31°C',
                    tempColor: '#F59E0B',
                    terrain: currentLang === 'hi' ? 'दोमट उपजाऊ' : 'Loamy Plain',
                    status: 'OPTIMAL'
                  },
                  {
                    zone: currentLang === 'hi' ? 'दक्षिण क्षेत्र (नदी तट)' : 'South Basin',
                    rain: '8.2 mm',
                    rainColor: '#6366F1',
                    moisture: '68% (High)',
                    moistureColor: '#38BDF8',
                    temp: '27°C',
                    tempColor: '#10B981',
                    terrain: currentLang === 'hi' ? 'जलोढ़ मिट्टी' : 'River Alluvial',
                    status: 'WET'
                  },
                  {
                    zone: currentLang === 'hi' ? 'पश्चिम क्षेत्र (पहाड़ी)' : 'West Upland',
                    rain: '0.0 mm',
                    rainColor: '#10B981',
                    moisture: '22% (Dry)',
                    moistureColor: '#F59E0B',
                    temp: '33°C',
                    tempColor: '#F59E0B',
                    terrain: currentLang === 'hi' ? 'लाल रेतीली मिट्टी' : 'Red Sandy Loam',
                    status: 'DRY'
                  }
                ].map((zoneItem, zIdx) => {
                  let primaryVal = zoneItem.rain;
                  let primaryColor = zoneItem.rainColor;
                  let label = currentLang === 'hi' ? 'अनुमानित वर्षा' : 'Precipitation';

                  if (mapWizardLayer === 'soil_moisture') {
                    primaryVal = zoneItem.moisture;
                    primaryColor = zoneItem.moistureColor;
                    label = currentLang === 'hi' ? 'मृदा नमी' : 'Soil Moisture';
                  } else if (mapWizardLayer === 'temperature') {
                    primaryVal = zoneItem.temp;
                    primaryColor = zoneItem.tempColor;
                    label = currentLang === 'hi' ? 'भूमि तापमान' : 'Surface Temp';
                  } else if (mapWizardLayer === 'agro_scenario') {
                    primaryVal = zoneItem.terrain;
                    primaryColor = '#A5B4FC';
                    label = currentLang === 'hi' ? 'मृदा प्रकार' : 'Terrain Type';
                  }

                  return (
                    <div
                      key={zIdx}
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: `1.5px solid ${primaryColor}`,
                        borderRadius: '12px',
                        padding: '14px',
                        textAlign: 'center'
                      }}
                    >
                      <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '700', display: 'block' }}>
                        {zoneItem.zone}
                      </span>
                      <strong style={{ fontSize: '18px', color: primaryColor, display: 'block', margin: '6px 0 2px' }}>
                        {primaryVal}
                      </strong>
                      <span style={{ fontSize: '10px', color: '#CBD5E1' }}>
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Map Legend */}
              <div style={{
                background: 'rgba(0,0,0,0.3)',
                padding: '10px 14px',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
                fontSize: '11px'
              }}>
                <span style={{ color: '#E2E8F0', fontWeight: '700' }}>
                  🎨 {currentLang === 'hi' ? 'संकेत व्याख्या:' : 'Pictorial Legend:'}
                </span>
                <span style={{ color: '#34D399' }}>🟢 {currentLang === 'hi' ? 'अनुकूल / सुरक्षित' : 'Optimal / Safe'}</span>
                <span style={{ color: '#38BDF8' }}>🔵 {currentLang === 'hi' ? 'वर्षा / अधिक नमी' : 'Rain / Moisture'}</span>
                <span style={{ color: '#FBBF24' }}>🟡 {currentLang === 'hi' ? 'शुष्क / सतर्कता' : 'Dry / Caution'}</span>
                <span style={{ color: '#F87171' }}>🔴 {currentLang === 'hi' ? 'उच्च जोखिम / गर्मी' : 'High Heat / Danger'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Day-Type Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Filter size={14} />
            <span>{currentLang === 'hi' ? 'दिन का प्रकार (काम अनुसार):' : 'Farm Activity Type:'}</span>
          </span>

          <button
            type="button"
            onClick={() => setSelectedDayType('all')}
            style={{
              background: selectedDayType === 'all' ? '#0F172A' : '#F8FAFC',
              color: selectedDayType === 'all' ? '#FFFFFF' : '#475569',
              border: '1px solid #CBD5E1',
              borderRadius: '999px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            📋 {currentLang === 'hi' ? `सभी ${forecastDays.length} दिन` : `All ${forecastDays.length} Days`}
          </button>

          <button
            type="button"
            onClick={() => setSelectedDayType('safe_spray')}
            style={{
              background: selectedDayType === 'safe_spray' ? '#16A34A' : '#F0FDF4',
              color: selectedDayType === 'safe_spray' ? '#FFFFFF' : '#166534',
              border: '1px solid #86EFAC',
              borderRadius: '999px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            🚜 {currentLang === 'hi' ? 'सुरक्षित छिड़काव (Safe Spray)' : 'Safe Spray Windows'}
          </button>

          <button
            type="button"
            onClick={() => setSelectedDayType('rain_alert')}
            style={{
              background: selectedDayType === 'rain_alert' ? '#0284C7' : '#F0F9FF',
              color: selectedDayType === 'rain_alert' ? '#FFFFFF' : '#075985',
              border: '1px solid #BAE6FD',
              borderRadius: '999px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            🌧️ {currentLang === 'hi' ? 'बारिश अलर्ट (सिंचाई रोकें)' : 'Rain Days (Hold Irrigation)'}
          </button>

          <button
            type="button"
            onClick={() => setSelectedDayType('harvest_drying')}
            style={{
              background: selectedDayType === 'harvest_drying' ? '#D97706' : '#FEF3C7',
              color: selectedDayType === 'harvest_drying' ? '#FFFFFF' : '#92400E',
              border: '1px solid #FDE68A',
              borderRadius: '999px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            ☀️ {currentLang === 'hi' ? 'फसल सुखाई (Sun-Drying)' : 'Produce Sun-Drying'}
          </button>

          <button
            type="button"
            onClick={() => setSelectedDayType('sowing_ready')}
            style={{
              background: selectedDayType === 'sowing_ready' ? '#4F46E5' : '#EEF2FF',
              color: selectedDayType === 'sowing_ready' ? '#FFFFFF' : '#3730A3',
              border: '1px solid #C7D2FE',
              borderRadius: '999px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            🌱 {currentLang === 'hi' ? 'बुवाई व जुताई (Sowing)' : 'Sowing & Tillage'}
          </button>

          <button
            type="button"
            onClick={() => setSelectedDayType('high_risk')}
            style={{
              background: selectedDayType === 'high_risk' ? '#DC2626' : '#FEF2F2',
              color: selectedDayType === 'high_risk' ? '#FFFFFF' : '#991B1B',
              border: '1px solid #FECDD3',
              borderRadius: '999px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            ⚠️ {currentLang === 'hi' ? 'तेज हवा / जोखिम (High Wind)' : 'High Wind Caution'}
          </button>
        </div>

        {/* 5. Interactive Farm Calendar Grid (When Calendar View is Active) */}
        {activeViewMode === 'calendar' && (
          <div style={{
            marginTop: '20px',
            background: '#F8FAFC',
            borderRadius: '16px',
            border: '1.5px solid #E2E8F0',
            padding: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <strong style={{ fontSize: '16px', color: '#0F172A' }}>
                  🗓️ {currentLang === 'hi' ? 'कृषि कार्य कैलेंडर - किसी भी तारीख पर क्लिक करें' : 'Farm Decision Calendar - Tap any date'}
                </strong>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B' }}>
                  {currentLang === 'hi' ? 'तारीख चुनकर उस दिन का छिड़काव, वर्षा व सिंचाई विवरण तुरंत देखें' : 'Click any date to see exact spraying window, rainfall, and irrigation advisory'}
                </p>
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', gap: '10px', fontSize: '11px', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#16A34A' }}></span>
                  <span>{currentLang === 'hi' ? 'छिड़काव सुरक्षित' : 'Safe Spray'}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#0284C7' }}></span>
                  <span>{currentLang === 'hi' ? 'बारिश अलर्ट' : 'Rain Alert'}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#D97706' }}></span>
                  <span>{currentLang === 'hi' ? 'धूप सुखाई' : 'Sun Drying'}</span>
                </span>
              </div>
            </div>

            {/* Calendar Matrix Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: '10px'
            }}>
              {(calendarDays.length > 0 ? calendarDays : forecastDays).map((cDay: any, idx: number) => {
                const isSelected = selectedCalendarDate === cDay.date || (selectedCalendarDate === null && idx === 0);
                const dayObj = forecastDays[idx] || cDay;
                const isDanger = cDay.riskLevel === 'danger' || dayObj.rainChance >= 60;
                const isSafe = cDay.sprayStatus === 'SAFE' || dayObj.riskLevel === 'safe';

                return (
                  <div
                    key={cDay.date || idx}
                    onClick={() => {
                      setSelectedCalendarDate(cDay.date);
                      setExpandedDayIndex(idx);
                      setActiveViewMode('cards'); // Automatically focus card
                    }}
                    style={{
                      background: isSelected ? '#F0FDF4' : '#FFFFFF',
                      border: isSelected ? '2px solid #059669' : '1px solid #E2E8F0',
                      borderRadius: '12px',
                      padding: '12px',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 4px 12px rgba(5, 150, 105, 0.15)' : 'none',
                      transition: 'all 0.15s',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
                        {getLocText(cDay.dayNumber || dayObj.formattedDate || dayObj.date, currentLang)}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B' }}>
                        {getLocText(cDay.dayName || dayObj.dayName, currentLang)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      {dayObj.condition === 'rain' ? <CloudRain size={20} style={{ color: '#0284C7' }} /> :
                        dayObj.condition === 'cloudy' ? <Cloud size={20} style={{ color: '#64748B' }} /> :
                          <Sun size={20} style={{ color: '#F59E0B' }} />}
                      <span style={{ fontSize: '13px', fontWeight: '800', color: '#1E293B' }}>
                        {cDay.tempMax || dayObj.tempMax}°C
                      </span>
                    </div>

                    {/* Suitability Badge on Calendar */}
                    <div style={{
                      fontSize: '10px',
                      fontWeight: '800',
                      padding: '3px 6px',
                      borderRadius: '4px',
                      textAlign: 'center',
                      background: isDanger ? '#FEE2E2' : isSafe ? '#DCFCE7' : '#FEF3C7',
                      color: isDanger ? '#991B1B' : isSafe ? '#166534' : '#92400E'
                    }}>
                      {isDanger ? '⛔ ' + (currentLang === 'hi' ? 'बारिश' : 'Rain') :
                        isSafe ? '✓ ' + (currentLang === 'hi' ? 'स्प्रे सुरक्षित' : 'Safe Spray') :
                          '⚠️ ' + (currentLang === 'hi' ? 'सावधानी' : 'Caution')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 6. Multi-Day Detailed Forecast Cards Grid */}
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#475569' }}>
              {currentLang === 'hi' ? `दिखाए जा रहे हैं: ${filteredForecastDays.length} दिन` : `Showing: ${filteredForecastDays.length} Days`}
            </span>
            <span style={{ fontSize: '11px', color: '#64748B' }}>
              💡 {currentLang === 'hi' ? 'किसी भी कार्ड पर क्लिक करके प्रति-घंटे का विवरण खोलें' : 'Tap any card to expand hour-by-hour farm advice'}
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '14px'
          }}>
            {filteredForecastDays.map((day: any, idx: number) => {
              const isDanger = day.riskLevel === 'danger';
              const isWarning = day.riskLevel === 'warning';
              const dayName = getLocText(day.dayName, currentLang);
              const fullDayName = getLocText(day.fullDayName || day.dayName, currentLang);
              const conditionText = getLocText(day.conditionText, currentLang);
              const sprayAdvice = getLocText(day.sprayingAdvice, currentLang);
              const dryingWin = getLocText(day.dryingWindow, currentLang);
              const irrigAdvice = day.irrigationAdvice ? getLocText(day.irrigationAdvice, currentLang) : null;
              const thermalWarning = day.thermalStress?.warning ? getLocText(day.thermalStress.warning, currentLang) : null;
              const soilDesc = day.soilSuitability?.description ? getLocText(day.soilSuitability.description, currentLang) : null;

              const isExpanded = expandedDayIndex === idx;

              return (
                <div
                  key={day.date || idx}
                  style={{
                    background: isDanger ? '#FFF5F5' : isWarning ? '#FFFBEB' : '#FFFFFF',
                    border: isExpanded ? '2px solid #059669' : (isDanger ? '1px solid #FECDD3' : isWarning ? '1px solid #FDE68A' : '1px solid #E2E8F0'),
                    borderRadius: '16px',
                    padding: '16px',
                    boxShadow: isExpanded ? '0 8px 20px rgba(5, 150, 105, 0.12)' : '0 2px 4px rgba(0, 0, 0, 0.03)',
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }}
                  onClick={() => setExpandedDayIndex(isExpanded ? null : idx)}
                >
                  {/* Card Header: Weekday & Date */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div>
                      <strong style={{ fontSize: '15px', color: '#0F172A' }}>
                        {fullDayName}
                      </strong>
                      <span style={{ fontSize: '12px', color: '#64748B', marginLeft: '6px' }}>
                        {getLocText(day.formattedDate || day.date, currentLang)} {idx === 0 ? `(${currentLang === 'hi' ? 'आज' : 'Today'})` : idx === 1 ? `(${currentLang === 'hi' ? 'कल' : 'Tomorrow'})` : ''}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayAudioAdvice(`${dayName}: ${conditionText}. ${sprayAdvice}`);
                      }}
                      style={{
                        background: '#F1F5F9',
                        border: 'none',
                        borderRadius: '50%',
                        width: '28px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: '#475569'
                      }}
                      title="Listen audio"
                    >
                      <Volume2 size={14} />
                    </button>
                  </div>

                  {/* Icon, Temp, Rain, Wind */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {day.condition === 'rain' ? <CloudRain size={32} style={{ color: '#0284C7' }} /> :
                        day.condition === 'cloudy' ? <Cloud size={32} style={{ color: '#64748B' }} /> :
                          <Sun size={32} style={{ color: '#F59E0B' }} />}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                          <span style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A' }}>{day.tempMax}°C</span>
                          <span style={{ fontSize: '13px', color: '#64748B' }}>/{day.tempMin}°C</span>
                        </div>
                        <span style={{ fontSize: '12px', color: '#475569' }}>{conditionText}</span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', fontSize: '12px' }}>
                      <div style={{ color: '#0284C7', fontWeight: '700' }}>
                        💧 {day.rainChance}% {currentLang === 'hi' ? 'बारिश' : 'Rain'}
                      </div>
                      <div style={{ color: '#059669', fontWeight: '600', marginTop: '2px' }}>
                        💨 {day.windSpeedKmh} km/h
                      </div>
                    </div>
                  </div>

                  {/* Action Advisory 1: Spraying Window */}
                  <div style={{
                    background: isDanger ? '#FEE2E2' : isWarning ? '#FEF3C7' : '#DCFCE7',
                    borderRadius: '10px',
                    padding: '10px',
                    marginBottom: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: isDanger ? '#991B1B' : isWarning ? '#92400E' : '#166534', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Tractor size={13} />
                        <span>{isDanger ? '⛔ ' + (currentLang === 'hi' ? 'छिड़काव बंद' : 'Spray Paused') :
                          isWarning ? '⚠️ ' + (currentLang === 'hi' ? 'सावधानी से स्प्रे' : 'Caution Spray') :
                            '✓ ' + (currentLang === 'hi' ? 'सुरक्षित स्प्रे खिड़की' : 'Safe Spray Window')}</span>
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: isDanger ? '#7F1D1D' : isWarning ? '#78350F' : '#14532D', lineHeight: '1.4' }}>
                      {sprayAdvice}
                    </p>
                  </div>

                  {/* Action Advisory 2: Irrigation Guidance */}
                  {irrigAdvice && (
                    <div style={{
                      background: '#F0F9FF',
                      borderLeft: '3px solid #0284C7',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      marginBottom: '8px',
                      fontSize: '11px',
                      color: '#075985',
                      lineHeight: '1.4'
                    }}>
                      <strong>💧 {currentLang === 'hi' ? 'सिंचाई सलाह:' : 'Irrigation Advice:'} </strong>
                      <span>{irrigAdvice}</span>
                    </div>
                  )}

                  {/* Action Advisory 3: Sun-Drying */}
                  {dryingWin && (
                    <div style={{ fontSize: '11px', color: '#B45309', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>☀️ {dryingWin}</span>
                    </div>
                  )}

                  {/* Expand/Collapse Hourly Breakdown Indicator */}
                  <div style={{
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px solid #E2E8F0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '11px',
                    fontWeight: '700',
                    color: '#059669'
                  }}>
                    <span>{isExpanded ? (currentLang === 'hi' ? 'घंटे-वार विवरण छुपाएं' : 'Hide hourly details') : (currentLang === 'hi' ? 'प्रति-घंटे का स्प्रे समय देखें' : 'View hourly spray timeline')}</span>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>

                  {/* Expanded Hourly Timeline & Deep Diagnostics */}
                  {isExpanded && day.hourlyBreakdown && (
                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #CBD5E1' }}>
                      <div style={{ fontSize: '11px', fontWeight: '800', color: '#334155', marginBottom: '6px' }}>
                        ⏰ {currentLang === 'hi' ? 'प्रति-घंटे हवा व स्प्रे खिड़की:' : 'Hourly Spray & Wind Slots:'}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', textAlign: 'center' }}>
                        {day.hourlyBreakdown.map((slot: any, sIdx: number) => (
                          <div
                            key={sIdx}
                            style={{
                              background: slot.spraySafe ? '#DCFCE7' : '#FEE2E2',
                              borderRadius: '6px',
                              padding: '6px 2px',
                              fontSize: '10px'
                            }}
                          >
                            <div style={{ fontWeight: '700', color: '#1E293B' }}>{slot.hour}</div>
                            <div style={{ color: '#0284C7', marginTop: '2px' }}>{slot.rainProb}%</div>
                            <div style={{ color: '#059669', fontWeight: '600' }}>{slot.wind}k</div>
                            <div style={{
                              marginTop: '2px',
                              fontWeight: '800',
                              color: slot.spraySafe ? '#15803D' : '#B91C1C'
                            }}>
                              {slot.spraySafe ? '✓ OK' : '✕ NO'}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Soil & Thermal Diagnostic Box */}
                      {soilDesc && (
                        <div style={{ marginTop: '10px', fontSize: '11px', color: '#475569', background: '#F8FAFC', padding: '6px 8px', borderRadius: '6px' }}>
                          <strong>🚜 {currentLang === 'hi' ? 'जुताई व मिट्टी:' : 'Soil & Tillage:'} </strong>
                          <span>{soilDesc}</span>
                        </div>
                      )}

                      {thermalWarning && (
                        <div style={{ marginTop: '6px', fontSize: '11px', color: '#6B21A8', background: '#FAF5FF', padding: '6px 8px', borderRadius: '6px' }}>
                          <strong>🦠 {currentLang === 'hi' ? 'रोग व ओस चेतावनी:' : 'Dew & Disease:'} </strong>
                          <span>{thermalWarning}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 7. Regional Crop Suitability Section */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '24px',
        marginBottom: '20px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sprout size={22} style={{ color: '#059669' }} />
              <span>{t.cropSuitabilityTitle}</span>
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748B' }}>
              📍 {getLocText(activeLocation.name, currentLang)} ({getLocText(activeLocation.state, currentLang)}): {t.cropSuitabilityDesc}
            </p>
          </div>
          <span style={{
            background: '#ECFDF5',
            color: '#065F46',
            border: '1px solid #A7F3D0',
            borderRadius: '999px',
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: '700'
          }}>
            🌱 {activeZone}
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px'
        }}>
          {activeCrops.map((crop: any, idx: number) => {
            const isHigh = crop.suitabilityStatus === 'highly-recommended';
            const cropTitle = getLocText(crop.cropName, currentLang);
            const cropReason = getLocText(crop.reason, currentLang);
            const cropSeason = getLocText(crop.season, currentLang);

            return (
              <div
                key={idx}
                style={{
                  background: isHigh ? '#F0FDF4' : '#F8FAFC',
                  border: isHigh ? '1.5px solid #86EFAC' : '1px solid #E2E8F0',
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '20px' }}>🌿</span>
                      <strong style={{ fontSize: '15px', color: '#0F172A' }}>{cropTitle}</strong>
                    </div>
                    <span style={{
                      background: isHigh ? '#DCFCE7' : '#E2E8F0',
                      color: isHigh ? '#166534' : '#334155',
                      fontSize: '11px',
                      fontWeight: '800',
                      padding: '3px 8px',
                      borderRadius: '999px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <CheckCircle2 size={12} />
                      <span>{crop.suitabilityScore ? `${crop.suitabilityScore}% ` : ''}{isHigh ? (currentLang === 'hi' ? 'अत्यधिक उपयुक्त' : 'Highly Suitable') : (currentLang === 'hi' ? 'अनुकूल' : 'Favorable')}</span>
                    </span>
                  </div>

                  <p style={{ margin: '8px 0', fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
                    {cropReason}
                  </p>
                </div>

                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(0,0,0,0.06)', fontSize: '12px' }}>
                  <span style={{ color: '#64748B' }}>{currentLang === 'hi' ? 'उत्तम बुवाई काल: ' : 'Sowing Window: '}</span>
                  <strong style={{ color: '#0F172A' }}>{cropSeason}</strong>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 8. 3-Month Long-Range Seasonal Climate Outlook */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '24px',
        marginBottom: '20px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Calendar size={22} style={{ color: '#059669' }} />
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
              {currentLang === 'hi' ? `त्रैमासिक मौसमीय जलवायु आउटलुक (3-Month Seasonal Outlook) - ${getLocText(activeLocation.name, currentLang)}` : `3-Month Seasonal Climate Outlook - ${getLocText(activeLocation.name, currentLang)}`}
            </h3>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              {currentLang === 'hi' ? 'रबी व खरीफ फसल चक्र योजना हेतु दीर्घावधि वर्षा व तापमान रुझान' : 'Long-range rainfall and temperature trends for crop rotation planning'}
            </span>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '16px'
        }}>
          {activeSeasonal.map((item: any, idx: number) => {
            const monthTitle = getLocText(item.month, currentLang);
            const rainDesc = getLocText(item.expectedRainfall || item.rainExpectation, currentLang);
            const impactDesc = getLocText(item.description || item.farmingImpact, currentLang);

            return (
              <div
                key={idx}
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '14px',
                  padding: '16px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>{monthTitle}</span>
                  <span style={{ background: '#DCFCE7', color: '#166534', fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '999px' }}>
                    ✓ {currentLang === 'hi' ? 'कृषि अनुकूल' : 'Favorable'}
                  </span>
                </div>

                <div style={{ marginBottom: '8px', fontSize: '12px' }}>
                  <span style={{ color: '#64748B' }}>{currentLang === 'hi' ? 'वर्षा की संभावना: ' : 'Rainfall Outlook: '}</span>
                  <strong style={{ color: '#0284C7' }}>{rainDesc}</strong>
                </div>

                <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.5', background: '#FFFFFF', padding: '10px', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                  <span style={{ fontWeight: '700', color: '#0F172A', display: 'block', marginBottom: '2px' }}>
                    {currentLang === 'hi' ? 'खेती पर प्रभाव:' : 'Field Impact:'}
                  </span>
                  <span>{impactDesc}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 9. Hyper-Local 1km Radar Unlock for Farmers */}
      {!isLoggedIn && (
        <div style={{
          background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
          color: '#FFFFFF',
          borderRadius: '16px',
          padding: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px', borderRadius: '12px' }}>
              <Lock size={24} style={{ color: '#FCD34D' }} />
            </div>
            <div>
              <strong style={{ fontSize: '16px', display: 'block', marginBottom: '4px' }}>
                {currentLang === 'hi' ? 'अपने विशिष्ट गांव का 1 किमी उपग्रह मौसम रडार अनलॉक करें' : 'Unlock 1km Micro-Radar for Your Specific Farm & Village'}
              </strong>
              <span style={{ fontSize: '13px', color: '#94A3B8' }}>
                {currentLang === 'hi'
                  ? 'निःशुल्क किसान लॉगिन करें एवं व्हाट्सएप पर सुबह 6:00 बजे मौसम व स्प्रे अलर्ट प्राप्त करें।'
                  : 'Free farmer sign-in gives daily WhatsApp 6 AM spray advisories and real-time cloud Doppler radar.'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenLogin('Village Climate Radar')}
            style={{
              background: '#059669',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '10px',
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(5, 150, 105, 0.4)'
            }}
          >
            {t.loginBtn}
          </button>
        </div>
      )}
    </div>
  );
};
