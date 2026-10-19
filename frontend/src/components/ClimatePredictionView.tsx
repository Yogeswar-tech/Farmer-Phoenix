import { useState, useEffect, useRef, useCallback, type FC, type FormEvent } from 'react';
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
  Tractor,
  Sparkles,
  Thermometer
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
const getLocText = (val: any, lang: Language): string => {
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

export const calculateSunriseSunset = (lat: number = 16.3, lon: number = 80.4, date: Date = new Date()) => {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const diff = (date.getTime() - startOfYear.getTime()) + ((startOfYear.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000);
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

  const dec = 23.45 * Math.sin((Math.PI / 180) * ((360 / 365) * (284 + dayOfYear)));
  const latR = (Math.PI / 180) * (lat || 16.3);
  const decR = (Math.PI / 180) * dec;
  let cosW = -Math.tan(latR) * Math.tan(decR);
  cosW = Math.max(-1.0, Math.min(1.0, cosW));
  const w = (180 / Math.PI) * Math.acos(cosW);

  const B = (Math.PI / 180) * ((360 / 365) * (dayOfYear - 81));
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  const lonCorr = 4 * (82.5 - (lon || 80.4));
  const solarNoon = 12.0 - (eot - lonCorr) / 60.0;
  const sunriseH = (solarNoon - (w / 15.0) + 24) % 24;
  const sunsetH = (solarNoon + (w / 15.0) + 24) % 24;

  const formatH = (h: number) => {
    let hr = Math.floor(h);
    let mn = Math.round((h - hr) * 60);
    if (mn === 60) { hr = (hr + 1) % 24; mn = 0; }
    const period = hr < 12 ? 'AM' : 'PM';
    const hr12 = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
    return `${String(hr12).padStart(2, '0')}:${String(mn).padStart(2, '0')} ${period}`;
  };

  return {
    sunrise: formatH(sunriseH),
    sunset: formatH(sunsetH)
  };
};

export interface WeatherLlmAdvisory {
  summary: string;
  action_badge: 'spray_recommended' | 'spray_not_recommended' | 'irrigate_recommended' | 'irrigate_not_recommended' | 'harvest_recommended' | 'wait' | 'none';
  reason: string;
  alert: string | null;
}

const getActionBadgeStyle = (badge: string): React.CSSProperties => {
  switch (badge) {
    case 'spray_recommended':
      return { background: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '800' };
    case 'spray_not_recommended':
      return { background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '800' };
    case 'irrigate_recommended':
      return { background: '#E0F2FE', color: '#0369A1', border: '1px solid #7DD3FC', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '800' };
    case 'irrigate_not_recommended':
      return { background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '800' };
    case 'harvest_recommended':
      return { background: '#FEF9C3', color: '#854D0E', border: '1px solid #FDE047', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '800' };
    default:
      return { background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '800' };
  }
};

const getActionBadgeLabel = (badge: string, lang: string): string => {
  const map: Record<string, { en: string; hi: string; te: string }> = {
    spray_recommended: { en: '✓ Spray Recommended', hi: '✓ छिड़काव अनुशंसित', te: '✓ పిచికారీ చేయవచ్చు' },
    spray_not_recommended: { en: '✕ Spray Paused', hi: '✕ छिड़काव रोकें', te: '✕ పిచికారీ నిలిపివేయండి' },
    irrigate_recommended: { en: '💧 Irrigate Today', hi: '💧 सिंचाई करें', te: '💧 తడి పెట్టండి' },
    irrigate_not_recommended: { en: '✋ Hold Irrigation', hi: '✋ सिंचाई टालें', te: '✋ తడి పెట్టవద్దు' },
    harvest_recommended: { en: '🌾 Harvest Favorable', hi: '🌾 फसल कटाई अनुकूल', te: '🌾 కోతకు అనుకూలం' },
    wait: { en: '⏳ Wait & Observe', hi: '⏳ प्रतीक्षा करें', te: '⏳ వేచి చూడండి' },
    none: { en: 'General Outlook', hi: 'सामान्य मौसम', te: 'సాధారణ సూచన' }
  };
  const item = map[badge] || map['none'];
  return lang === 'hi' ? item.hi : lang === 'te' ? item.te : item.en;
};

const INITIAL_TODAY_STR = new Date().toISOString().split('T')[0];

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
  const todayStr = INITIAL_TODAY_STR;
  const [selectedDatePreset, setSelectedDatePreset] = useState<'today' | 'tomorrow' | '3days' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState<string>(todayStr);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  // Decoupled LLM Weather Advisory State
  const [llmAdvisory, setLlmAdvisory] = useState<WeatherLlmAdvisory | null>(null);
  const [isAdvisoryLoading, setIsAdvisoryLoading] = useState<boolean>(false);

  // Unified Agro-Weather Scope State (Today's Weather vs Date Range)
  const [selectedScopeMode, setSelectedScopeMode] = useState<'today' | 'range'>('today');
  const [scopeRangeStart, setScopeRangeStart] = useState<string>(todayStr);
  const [scopeRangeEnd, setScopeRangeEnd] = useState<string>(todayStr);

  // Pictorial Agricultural Map Wizard State
  const [showMapWizard, setShowMapWizard] = useState<boolean>(false);
  const [mapWizardLayer, setMapWizardLayer] = useState<'radar' | 'soil_moisture' | 'temperature' | 'agro_scenario'>('radar');

  // Audio Voice Salla (TTS)
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const lastFetchedKeyRef = useRef<string>('');

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
  const [prevLocKey, setPrevLocKey] = useState(`${currentLocation.id}-${currentLang}`);
  const currentLocKey = `${currentLocation.id}-${currentLang}`;
  if (currentLocKey !== prevLocKey) {
    setPrevLocKey(currentLocKey);
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
  }

  // Main Unified Climate Fetch (Open-Meteo Satellite + IMD + Farm Decisions)
  const fetchUnifiedClimate = useCallback(async (loc: any, daysCount: number = horizonDays) => {
    await Promise.resolve();
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
          setActiveLocation((prev: any) => {
            const newName = getLocText(res.location.name, currentLang) || prev.name;
            const newDistrict = getLocText(res.location.district, currentLang) || prev.district;
            const newState = getLocText(res.location.state, currentLang) || prev.state;
            const newPin = res.location.pincode || prev.pincode;
            const newZone = getLocText(res.location.agroClimaticZone || prev.zone, currentLang);
            const newLat = res.location.latitude ?? prev.lat;
            const newLon = res.location.longitude ?? prev.lon;
            const newId = res.location.id || prev.id;

            if (
              prev.id === newId &&
              prev.name === newName &&
              prev.district === newDistrict &&
              prev.state === newState &&
              prev.pincode === newPin &&
              prev.zone === newZone &&
              prev.lat === newLat &&
              prev.lon === newLon
            ) {
              return prev;
            }

            return {
              ...prev,
              id: newId,
              name: newName,
              district: newDistrict,
              state: newState,
              pincode: newPin,
              zone: newZone,
              lat: newLat,
              lon: newLon
            };
          });
        }

        setIsLiveSynced(true);
        setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

        // Decoupled LLM Weather Advisory (silent fallback, strictly non-blocking)
        const resolvedName = getLocText(res.location?.name, currentLang) || getLocText(loc.name, currentLang) || 'Local Farm';
        fetchLlmAdvisory(res, resolvedName, currentLang);
      }
    } catch (err) {
      console.warn('[Climate View] Backend fetch error:', err);
      setIsLiveSynced(false);
    } finally {
      setIsLoading(false);
    }
  }, [currentLang, horizonDays]);

  // Decoupled LLM Weather Advisory Fetcher (Strict Schema, Silent Fail)
  const fetchLlmAdvisory = async (weatherData: any, locName: string, lang: Language) => {
    setIsAdvisoryLoading(true);
    try {
      const rawWeatherPayload = {
        current_conditions: weatherData.current_conditions || {},
        forecast_days: (weatherData.forecast_days || weatherData.forecast_7days || []).slice(0, 5),
        has_severe_alert: Boolean(weatherData.alert_risk?.hasAlert || weatherData.has_alert || false),
        severe_alert_description: weatherData.alert_risk?.riskTitle || null
      };

      const advisory = await KisanSethuApi.getWeatherLlmAdvisory({
        weatherPayload: rawWeatherPayload,
        locationName: typeof locName === 'string' && locName ? locName : 'Local Farm',
        lang,
        crop: null,
        growthStage: null
      });

      if (advisory && advisory.summary && advisory.action_badge) {
        setLlmAdvisory(advisory);
      } else {
        setLlmAdvisory(null);
      }
    } catch (err) {
      console.warn('[Climate View] LLM Advisory silent failure:', err);
      setLlmAdvisory(null);
    } finally {
      setIsAdvisoryLoading(false);
    }
  };

  useEffect(() => {
    const fetchKey = `${activeLocation.id || ''}_${activeLocation.lat || ''}_${activeLocation.lon || ''}_${horizonDays}_${currentLang}`;
    if (lastFetchedKeyRef.current === fetchKey) {
      return;
    }
    lastFetchedKeyRef.current = fetchKey;
    fetchUnifiedClimate(activeLocation, horizonDays);
  }, [activeLocation.id, activeLocation.lat, activeLocation.lon, horizonDays, currentLang, fetchUnifiedClimate]);

  // All-India Dynamic Location Autocomplete
  useEffect(() => {
    if (!searchInput.trim() || searchInput.trim().length < 2) {
      const timer = setTimeout(() => {
        setSearchResults([]);
        setShowSuggestions(false);
      }, 0);
      return () => clearTimeout(timer);
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
      lastFetchedKeyRef.current = '';
      setActiveLocation(customLoc);
    }
  };

  // Select a suggestion from All-India search
  const selectLocationResult = (loc: any) => {
    lastFetchedKeyRef.current = '';
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
            lastFetchedKeyRef.current = '';
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
            lastFetchedKeyRef.current = '';
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

  // Universal Date Utilities for Scope Filtering
  const getDayIsoDate = (d: any, index: number): string => {
    if (d?.date && /^\d{4}-\d{2}-\d{2}$/.test(d.date)) {
      return d.date;
    }
    const dObj = new Date();
    dObj.setDate(dObj.getDate() + index);
    return dObj.toISOString().split('T')[0];
  };

  const getIsoDatePlus = (offsetDays: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  };

  const minScopeDate = todayStr;
  const maxScopeDate = forecastDays && forecastDays.length > 0
    ? getDayIsoDate(forecastDays[forecastDays.length - 1], forecastDays.length - 1)
    : getIsoDatePlus(15);

  const formatShortDate = (isoStr: string): string => {
    if (!isoStr) return '';
    try {
      const parts = isoStr.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString(currentLang === 'hi' ? 'hi-IN' : currentLang === 'te' ? 'te-IN' : 'en-US', { day: 'numeric', month: 'short' });
      }
      return isoStr;
    } catch {
      return isoStr;
    }
  };

  // Extract selected days based on user-picked scope mode (Today's Weather vs Date Range)
  const isRangeMode = selectedScopeMode === 'range';
  const effectiveScopeDays = isRangeMode
    ? forecastDays.filter((d, idx) => {
        const iso = getDayIsoDate(d, idx);
        return iso >= scopeRangeStart && iso <= scopeRangeEnd;
      })
    : [forecastDays[0] || {}];

  const activeScopeDays = effectiveScopeDays.length > 0 ? effectiveScopeDays : [forecastDays[0] || {}];
  const day0Forecast = forecastDays && forecastDays.length > 0 ? forecastDays[0] : null;

  // 1. Temperature Calculation
  const currentTemp = currentConditions?.temperatureC ?? (day0Forecast?.tempMax ?? 31);
  const minTempScope = Math.round(Math.min(...activeScopeDays.map((d: any) => d.tempMin ?? (currentTemp - 6))));
  const maxTempScope = Math.round(Math.max(...activeScopeDays.map((d: any) => d.tempMax ?? (currentTemp + 2))));
  const avgTempScope = Math.round(
    activeScopeDays.reduce((acc: number, d: any) => acc + (((d.tempMax ?? 32) + (d.tempMin ?? 22)) / 2), 0) / activeScopeDays.length
  );

  // 2. Rain — The Big One Calculation
  const rainChanceScope = isRangeMode
    ? Math.max(...activeScopeDays.map((d: any) => d.rainChance ?? d.rainProbability ?? 0))
    : (day0Forecast?.rainChance ?? day0Forecast?.rainProbability ?? (currentConditions?.precipitationMm ? 85 : 10));
  const precipMmScope = isRangeMode
    ? Number(activeScopeDays.reduce((acc: number, d: any) => acc + (d.precipMm || 0), 0).toFixed(1))
    : (currentConditions?.precipitationMm ?? day0Forecast?.precipMm ?? 0);

  // 3. Wind Speed Calculation
  const windSpeedScope = isRangeMode
    ? Number((activeScopeDays.reduce((acc: number, d: any) => acc + (d.windSpeedKmh || 8.6), 0) / activeScopeDays.length).toFixed(1))
    : (currentConditions?.windSpeedKmh ?? day0Forecast?.windSpeedKmh ?? 8.6);
  const maxWindSpeedScope = isRangeMode
    ? Number(Math.max(...activeScopeDays.map((d: any) => d.windSpeedKmh || 8.6)).toFixed(1))
    : windSpeedScope;

  // 4. Humidity Calculation
  const humidityScope = isRangeMode
    ? Math.round(activeScopeDays.reduce((acc: number, d: any) => acc + (d.humidityPct ?? 78), 0) / activeScopeDays.length)
    : (currentConditions?.humidityPct ?? 80);

  // 5. Sunrise / Sunset Calculation
  const midDateForSolar = isRangeMode && scopeRangeStart ? new Date(scopeRangeStart) : new Date();
  const calculatedSunTimes = calculateSunriseSunset(
    activeLocation?.lat || 16.3,
    activeLocation?.lon || 80.4,
    midDateForSolar
  );
  const sunriseScope = (!isRangeMode && currentConditions?.sunrise) || calculatedSunTimes.sunrise;
  const sunsetScope = (!isRangeMode && currentConditions?.sunset) || calculatedSunTimes.sunset;

  // Dynamic Actionable Advisory for Selected Scope
  const rangeDateLabel = `${formatShortDate(scopeRangeStart)} – ${formatShortDate(scopeRangeEnd)}`;
  const rangeActionBadge = rainChanceScope >= 50
    ? 'spray_not_recommended'
    : (rainChanceScope < 30 && maxWindSpeedScope < 15 ? 'spray_recommended' : 'wait');

  const rangeSummary = isRangeMode
    ? (rainChanceScope >= 50
        ? (currentLang === 'hi' ? `${rangeDateLabel} के दौरान छिड़काव रोकें — बारिश का खतरा` : currentLang === 'te' ? `${rangeDateLabel} వ్యవధిలో స్ప్రే వద్దు — వర్ష సూచన` : `Pause foliar spraying across ${rangeDateLabel} — rain expected`)
        : (rainChanceScope < 30 && maxWindSpeedScope < 15
            ? (currentLang === 'hi' ? `${activeScopeDays.length}-दिवसीय अनुकूल खिड़की: छिड़काव एवं सुखाई हेतु उत्तम` : currentLang === 'te' ? `${activeScopeDays.length} రోజుల అనుకూల సమయం: పిచికారీ మరియు ఎండబెట్టడానికి మంచిది` : `Favorable ${activeScopeDays.length}-day operational window for spraying and crop drying`)
            : (currentLang === 'hi' ? `${activeScopeDays.length} दिनों में मिश्रित मौसम — केवल सुबह कार्य करें` : currentLang === 'te' ? `${activeScopeDays.length} రోజులలో మిశ్రమ వాతావరణం — ఉదయం వేళల్లో స్ప్రే చేయండి` : `Mixed operational conditions across ${activeScopeDays.length} days — plan morning spraying`)))
    : (llmAdvisory?.summary || (rainChanceScope >= 50
        ? (currentLang === 'hi' ? 'आज कीटनाशक छिड़काव रोकें — बारिश की संभावना है' : currentLang === 'te' ? 'నేడు పురుగుमందుల పిచికారీ నిలిపివేయండి — వర్ష సూచన ఉంది' : 'Pause foliar spraying today — rain expected')
        : (currentLang === 'hi' ? 'खेती के कार्यों एवं छिड़काव के लिए आज अनुकूल मौसम' : currentLang === 'te' ? 'నేడు వ్యవసాయ పనులకు మరియు పిచికారీకి అనుకూలమైన వాతావరణం' : 'Favorable weather window for field operations and spraying')));

  const rangeReason = isRangeMode
    ? (rainChanceScope >= 50
        ? (currentLang === 'hi' ? `इस अवधि में अधिकतम वर्षा संभावना ${rainChanceScope}% (${precipMmScope} मिमी कुल) है। दवा बहने से बचाने के लिए छिड़काव टालें।` : currentLang === 'te' ? `ఈ కాలంలో గరిష్ట వర్ష సూచన ${rainChanceScope}% (మొత్తం ${precipMmScope} మిమీ). స్ప్రే వాయిదా వేయండి.` : `Precipitation probability peaks at ${rainChanceScope}% (${precipMmScope} mm total). Delay spraying to avoid chemical wash-off and runoff.`)
        : (rainChanceScope < 30 && maxWindSpeedScope < 15
            ? (currentLang === 'hi' ? `मौसम शुष्क (<${rainChanceScope}% वर्षा) और हवा शांत (<${maxWindSpeedScope} किमी/घंटा) बनी रहेगी। सभी कृषि कार्य सुरक्षित हैं।` : currentLang === 'te' ? `పొడి వాతావరణం (<${rainChanceScope}%) మరియు శాంతమైన గాలి (<${maxWindSpeedScope} కి.మీ). వ్యవసాయ పనులు సురక్షితం.` : `Sustained dry conditions (rain <${rainChanceScope}%) and gentle breeze (<${maxWindSpeedScope} km/h). Safe for foliar treatment.`)
            : (currentLang === 'hi' ? `बारिश की संभावना ${rainChanceScope}% और हवा ${maxWindSpeedScope} किमी/घंटा है। हवा तेज होने से पहले सुबह जल्दी छिड़काव करें।` : currentLang === 'te' ? `వర్ష సూచన ${rainChanceScope}%, గాలి ${maxWindSpeedScope} కి.మీ. ఉదయాన్నే స్ప్రే పూర్తి చేయండి.` : `Rain probability peaks at ${rainChanceScope}% with gusts up to ${maxWindSpeedScope} km/h. Complete spraying in early morning.`)))
    : (llmAdvisory?.reason || (rainChanceScope >= 50
        ? (currentLang === 'hi' ? `आज ${rainChanceScope}% बारिश की संभावना है। दवा बहने से बचाने के लिए छिड़काव टालें।` : currentLang === 'te' ? `నేడు ${rainChanceScope}% వర్ష సూచన ఉంది. పిచికారీ ఆపండి.` : `Precipitation probability is ${rainChanceScope}% today. Delay spraying to prevent chemical wash-off and runoff.`)
        : (currentLang === 'hi' ? `मौसम साफ है और हवा ${windSpeedScope} किमी/घंटा शांत है। सुबह के समय छिड़काव सुरक्षित रहेगा।` : currentLang === 'te' ? `వాతావరణం నిర్మలంగా ఉంది, గాలి వేగం ${windSpeedScope} కి.మీ. ఉదయం వేళల్లో స్ప్రే చేయడం సురక్షితం.` : `Clear conditions with gentle wind (${windSpeedScope} km/h). Optimal morning window for foliar treatment.`)));

  const activeBadgeCode = isRangeMode ? rangeActionBadge : (llmAdvisory?.action_badge || (rainChanceScope >= 50 ? 'spray_not_recommended' : 'spray_recommended'));

  return (
    <div className="climate-prediction-view-container" style={{ maxWidth: '1280px', margin: '0 auto', padding: '16px' }}>
      {/* Sample Data Warning Banner — shown when backend is unreachable */}
      {!isLiveSynced && !isLoading && (
        <div style={{
          background: '#FEF3C7',
          border: '1.5px solid #F59E0B',
          borderLeft: '5px solid #D97706',
          borderRadius: '10px',
          padding: '10px 16px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          fontWeight: '600',
          color: '#92400E'
        }}>
          <AlertTriangle size={15} style={{ flexShrink: 0 }} />
          <span>
            {currentLang === 'te'
              ? '⚠ నమూనా వాతావరణ డేటా చూపబడుతోంది — లైవ్ డేటా అందుబాటులో లేదు'
              : currentLang === 'hi'
                ? '⚠ नमूना मौसम डेटा दिखाया जा रहा है — लाइव डेटा उपलब्ध नहीं'
                : '⚠ Sample Data — live weather data unavailable'}
          </span>
        </div>
      )}
      {/* Universal Search Bar & Farm Selector */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '20px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        marginBottom: '20px'
      }}>


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
              <button
                type="button"
                onClick={handleDetectFarmGps}
                disabled={isLocatingGps}
                title={currentLang === 'hi' ? 'जीपीएस द्वारा स्थान खोजें' : currentLang === 'te' ? 'జీపీఎస్ ద్వారా స్థానం గుర్తించండి' : 'Detect Farm GPS'}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isLocatingGps ? '#059669' : '#64748B',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '40px',
                  minHeight: '40px'
                }}
              >
                {isLocatingGps ? <Loader2 size={18} className="spin-icon" /> : <Navigation size={18} />}
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                background: '#059669',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '12px',
                padding: '0 20px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
                minWidth: '136px',
                height: '42px',
                boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)',
                transition: 'all 0.2s ease',
                opacity: isLoading ? 0.85 : 1
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="spin-icon" />
                  <span>{currentLang === 'hi' ? 'खोज रहे हैं...' : currentLang === 'te' ? 'శోధిస్తోంది...' : 'Searching...'}</span>
                </>
              ) : (
                <>
                  <Search size={16} />
                  <span>{currentLang === 'hi' ? 'मौसम देखें' : currentLang === 'te' ? 'వాతావరణం చూడండి' : 'View Weather'}</span>
                </>
              )}
            </button>

            {activeLocation.id !== currentLocation.id && (
              <button
                type="button"
                onClick={() => {
                  lastFetchedKeyRef.current = '';
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
                  borderRadius: '12px',
                  padding: '0 16px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                {t.returnToLockedFarm || '🔙 Return to My Farm'}
              </button>
            )}
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
                  {(!activeLocation.lat || activeLocation.lat === 16.3067) && (!activeLocation.lon || activeLocation.lon === 80.4365) && (
                    <span style={{ marginLeft: '8px', color: '#D97706', fontWeight: '700', fontSize: '11px' }}>
                      {currentLang === 'te' ? '(డిఫాల్ట్ స్థానం: గుంటూరు)' : currentLang === 'hi' ? '(डिफ़ॉल्ट स्थान: गुंटूर)' : '(Using default location: Guntur)'}
                    </span>
                  )}
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

      {/* Decoupled LLM Weather Alert Banner (Only if severe alert detected) */}
      {llmAdvisory?.alert && (
        <div style={{
          background: 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)',
          border: '2px solid #EF4444',
          borderLeft: '6px solid #DC2626',
          borderRadius: '14px',
          padding: '16px 20px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: '0 4px 12px rgba(220, 38, 38, 0.12)'
        }}>
          <div style={{
            background: '#DC2626',
            color: '#FFFFFF',
            padding: '8px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <AlertTriangle size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ⚠️ {currentLang === 'hi' ? 'उच्च प्राथमिकता मौसम चेतावनी' : currentLang === 'te' ? 'అత్యవసర వాతావరణ హెచ్చరిక' : 'High Priority Weather Alert'}
            </div>
            <div style={{ fontSize: '15px', fontWeight: '800', color: '#7F1D1D', marginTop: '2px' }}>
              {llmAdvisory.alert}
            </div>
          </div>
        </div>
      )}

      {/* Controls Displayed Beside Each Other: Today's Weather & Date Range */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '14px',
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '12px 18px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
      }}>
        {/* Left Field: Today's Weather Button (Vibrant Green Pill matching screenshot) */}
        <button
          type="button"
          onClick={() => {
            setSelectedScopeMode('today');
            setScopeRangeStart(todayStr);
            setScopeRangeEnd(todayStr);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: selectedScopeMode === 'today' ? '#00875A' : '#F8FAFC',
            color: selectedScopeMode === 'today' ? '#FFFFFF' : '#334155',
            border: selectedScopeMode === 'today' ? 'none' : '1px solid #CBD5E1',
            borderRadius: '24px',
            padding: '10px 22px',
            fontSize: '14px',
            fontWeight: '800',
            cursor: 'pointer',
            boxShadow: selectedScopeMode === 'today' ? '0 4px 14px rgba(0, 135, 90, 0.3)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <span style={{ fontSize: '16px' }}>⚡</span>
          <span>
            {currentLang === 'hi'
              ? "Today's Weather (आज का मौसम)"
              : currentLang === 'te'
                ? "Today's Weather (నేటి వాతావరణం)"
                : "Today's Weather"}
          </span>
        </button>

        {/* Right Field: Date Range Selector (Beside Today's Weather) */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '10px',
          background: selectedScopeMode === 'range' ? '#ECFDF5' : '#F8FAFC',
          border: `1.5px solid ${selectedScopeMode === 'range' ? '#059669' : '#CBD5E1'}`,
          borderRadius: '24px',
          padding: '6px 14px',
          boxShadow: selectedScopeMode === 'range' ? '0 2px 10px rgba(5, 150, 105, 0.12)' : 'none',
          transition: 'all 0.15s ease',
          flexWrap: 'wrap'
        }}>
          <button
            type="button"
            onClick={() => setSelectedScopeMode('range')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: '13px',
              fontWeight: '800',
              color: selectedScopeMode === 'range' ? '#065F46' : '#475569',
              cursor: 'pointer'
            }}
          >
            <Calendar size={16} style={{ color: selectedScopeMode === 'range' ? '#059669' : '#64748B' }} />
            <span>
              {currentLang === 'hi' ? 'दिनांक सीमा (Date Range):' : currentLang === 'te' ? 'తేదీ పరిధి (Date Range):' : 'Date Range:'}
            </span>
          </button>

          {/* Start Date */}
          <input
            type="date"
            value={scopeRangeStart}
            min={minScopeDate}
            max={maxScopeDate}
            onChange={(e) => {
              const val = e.target.value;
              setScopeRangeStart(val);
              if (val > scopeRangeEnd) {
                setScopeRangeEnd(val);
              }
              setSelectedScopeMode('range');
            }}
            style={{
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '4px 8px',
              fontSize: '12.5px',
              fontWeight: '700',
              color: '#0F172A',
              background: '#FFFFFF',
              cursor: 'pointer'
            }}
          />

          <span style={{ color: '#94A3B8', fontWeight: '800', fontSize: '13px' }}>➔</span>

          {/* End Date */}
          <input
            type="date"
            value={scopeRangeEnd}
            min={scopeRangeStart || minScopeDate}
            max={maxScopeDate}
            onChange={(e) => {
              const val = e.target.value;
              setScopeRangeEnd(val);
              setSelectedScopeMode('range');
            }}
            style={{
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '4px 8px',
              fontSize: '12.5px',
              fontWeight: '700',
              color: '#0F172A',
              background: '#FFFFFF',
              cursor: 'pointer'
            }}
          />

          {/* Quick preset buttons */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              onClick={() => {
                setSelectedScopeMode('range');
                setScopeRangeStart(todayStr);
                setScopeRangeEnd(getIsoDatePlus(2));
              }}
              style={{
                background: selectedScopeMode === 'range' && scopeRangeEnd === getIsoDatePlus(2) ? '#059669' : '#E2E8F0',
                color: selectedScopeMode === 'range' && scopeRangeEnd === getIsoDatePlus(2) ? '#FFFFFF' : '#334155',
                border: 'none',
                borderRadius: '12px',
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
              title="Next 3 Days"
            >
              +3D
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedScopeMode('range');
                setScopeRangeStart(todayStr);
                setScopeRangeEnd(getIsoDatePlus(6));
              }}
              style={{
                background: selectedScopeMode === 'range' && scopeRangeEnd === getIsoDatePlus(6) ? '#059669' : '#E2E8F0',
                color: selectedScopeMode === 'range' && scopeRangeEnd === getIsoDatePlus(6) ? '#FFFFFF' : '#334155',
                border: 'none',
                borderRadius: '12px',
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
              title="Next 7 Days"
            >
              +7D
            </button>
          </div>
        </div>
      </div>

      {/* Unified Agro-Weather Intelligence & Actionable Advisory Results Box (Displayed Below) */}
      <div style={{
        background: '#FFFFFF',
        border: '2px solid #86EFAC',
        borderRadius: '16px',
        padding: '20px 22px',
        marginBottom: '20px',
        boxShadow: '0 4px 18px rgba(16, 185, 129, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        {/* TOP SECTION: Actionable Advisory (The LLM's Real Value-Add) */}
        <div>
          {/* Header Row: Tip Badge + Scope Chip + Action Chip + Read Aloud Voice Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#047857',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: '800',
                padding: '4px 10px',
                borderRadius: '20px',
                letterSpacing: '0.4px',
                textTransform: 'uppercase'
              }}>
                <Sparkles size={12} />
                {currentLang === 'hi' ? 'एआई फसल निर्णय सलाह' : currentLang === 'te' ? 'ఏఐ వ్యవసాయ నిర్ణయ సలహా' : 'AI Farm Advisory Tip'}
              </span>

              {/* Scope Chip Indicator (Today vs Date Range) */}
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: isRangeMode ? '#EFF6FF' : '#F0FDF4',
                color: isRangeMode ? '#1D4ED8' : '#15803D',
                border: `1px solid ${isRangeMode ? '#BFDBFE' : '#BBF7D0'}`,
                fontSize: '11px',
                fontWeight: '800',
                padding: '3px 8px',
                borderRadius: '12px'
              }}>
                {isRangeMode ? `📅 ${rangeDateLabel} (${activeScopeDays.length}D)` : `⚡ ${currentLang === 'hi' ? 'आज' : currentLang === 'te' ? 'నేడు' : 'Today'}`}
              </span>

              {/* Action Badge colored chip */}
              <span style={getActionBadgeStyle(activeBadgeCode)}>
                {getActionBadgeLabel(activeBadgeCode, currentLang)}
              </span>
            </div>

            {/* Read Aloud Voice Button */}
            <button
              type="button"
              onClick={() => {
                const advText = `${rangeSummary}. ${rangeReason}`;
                handlePlayAudioAdvice(advText);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: isSpeaking ? '#DC2626' : '#EFF6FF',
                color: isSpeaking ? '#FFFFFF' : '#1D4ED8',
                border: `1px solid ${isSpeaking ? '#DC2626' : '#BFDBFE'}`,
                borderRadius: '20px',
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title={currentLang === 'hi' ? 'सलाह बोलकर सुनें' : 'Read aloud in farmer language'}
            >
              {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
              <span>
                {isSpeaking
                  ? (currentLang === 'hi' ? 'रोकें' : 'Stop')
                  : (currentLang === 'hi' ? 'बोलकर सुनें' : currentLang === 'te' ? 'వినండి' : 'Read Aloud')}
              </span>
            </button>
          </div>

          {/* Advisory Content */}
          {isAdvisoryLoading && !llmAdvisory && !isRangeMode ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#059669', fontSize: '13.5px', fontWeight: '600', padding: '6px 0' }}>
              <Loader2 size={18} className="spin-icon" />
              <span>
                {currentLang === 'hi'
                  ? 'एआई मौसम निर्णय सलाह लोड हो रही है...'
                  : currentLang === 'te'
                    ? 'ఏఐ వాతావరణ నిర్ణయ సలహా లోడ్ అవుతోంది...'
                    : 'Loading AI agro-weather advisory tip...'}
              </span>
            </div>
          ) : (
            <div>
              {/* Summary (Bold / Larger text) */}
              <div style={{
                fontSize: '17px',
                fontWeight: '800',
                color: '#0F172A',
                lineHeight: '1.4'
              }}>
                {rangeSummary}
              </div>

              {/* Reason (Smaller supporting text) */}
              <div style={{
                fontSize: '13.5px',
                fontWeight: '500',
                color: '#475569',
                marginTop: '4px',
                lineHeight: '1.5'
              }}>
                {rangeReason}
              </div>
            </div>
          )}
        </div>

        {/* SECTION DIVIDER */}
        <div style={{ borderTop: '1px solid #E2E8F0' }} />

        {/* BOTTOM SECTION: 5-Metric Weather Essentials Grid (Including Temperature) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '12px'
        }}>
          {/* 1. Temperature (New Field requested alongside the 4 fields) */}
          <div style={{
            background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)',
            border: '1.5px solid #FDBA74',
            borderRadius: '12px',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 2px 6px rgba(234, 88, 12, 0.08)'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#9A3412', textTransform: 'uppercase' }}>
                  {currentLang === 'hi' ? '🌡️ तापमान' : currentLang === 'te' ? '🌡️ ఉష్ణోగ్రత' : '🌡️ Temperature'}
                </span>
                <Thermometer size={18} style={{ color: '#EA580C' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '24px', fontWeight: '800', color: '#7C2D12' }}>
                  {isRangeMode ? `${minTempScope}° – ${maxTempScope}°C` : `${Math.round(currentTemp)}°C`}
                </span>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#C2410C' }}>
                  {isRangeMode ? `(Avg: ${avgTempScope}°C)` : `(H: ${maxTempScope}° L: ${minTempScope}°)`}
                </span>
              </div>
            </div>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: maxTempScope >= 38 ? '#DC2626' : minTempScope <= 14 ? '#D97706' : '#15803D', marginTop: '6px' }}>
              {maxTempScope >= 38
                ? (currentLang === 'hi' ? '⚠️ उच्च तापमान / गर्मी तनाव' : currentLang === 'te' ? '⚠️ అధిక ఉష్ణోగ్రత / వడగాల్పులు' : '⚠️ High Heat Stress Watch')
                : minTempScope <= 14
                  ? (currentLang === 'hi' ? '⚠️ कम तापमान / ओस चेतावनी' : currentLang === 'te' ? '⚠️ చలి & మంచు ప్రభావం' : '⚠️ Cold Dew Watch')
                  : (currentLang === 'hi' ? '✓ फसल वृद्धि हेतु अनुकूल तापमान' : currentLang === 'te' ? '✓ పంట ఎదుగుదలకు అనుకూల ఉష్ణోగ్రత' : '✓ Optimal Thermal Window')}
            </div>
          </div>

          {/* 2. Rain — The Big One (Prominently Highlighted) */}
          <div style={{
            background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
            border: '2px solid #3B82F6',
            borderRadius: '12px',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.12)'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{
                  fontSize: '10.5px',
                  fontWeight: '800',
                  color: '#1E40AF',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  background: '#BFDBFE',
                  padding: '2px 8px',
                  borderRadius: '10px'
                }}>
                  {currentLang === 'hi' ? '🌧️ बारिश — मुख्य सूचक' : currentLang === 'te' ? '🌧️ వర్షం — ప్రధానం' : '🌧️ Rain — The Big One'}
                </span>
                <CloudRain size={20} style={{ color: '#2563EB' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '26px', fontWeight: '900', color: '#1E3A8A', letterSpacing: '-0.5px' }}>
                  {isRangeMode ? `Max ${rainChanceScope}%` : `${rainChanceScope}%`}
                </span>
                {precipMmScope > 0 && (
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#2563EB' }}>
                    ({precipMmScope} mm{isRangeMode ? ' tot' : ''})
                  </span>
                )}
              </div>
            </div>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: rainChanceScope >= 50 ? '#DC2626' : '#059669', marginTop: '6px' }}>
              {rainChanceScope >= 50
                ? (currentLang === 'hi' ? '⚠️ उच्च वर्षा खतरा — छिड़काव रोकें' : currentLang === 'te' ? '⚠️ భారీ వర్ష సూచన — స్ప్రే వద్దు' : '⚠️ High Rain Risk — Hold Spray')
                : (currentLang === 'hi' ? '✓ शुष्क / छिड़काव व सुखाई अनुकूल' : currentLang === 'te' ? '✓ పొడి వాతావరణం అనుకూలం' : '✓ Dry & Favorable Window')}
            </div>
          </div>

          {/* 3. Wind */}
          <div style={{
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>
                  {currentLang === 'hi' ? '💨 हवा की गति' : currentLang === 'te' ? '💨 గాలి వేగం' : '💨 Wind Speed'}
                </span>
                <Wind size={18} style={{ color: '#0284C7' }} />
              </div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#0F172A' }}>
                {windSpeedScope} <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748B' }}>km/h</span>
                {isRangeMode && (
                  <span style={{ fontSize: '11.5px', fontWeight: '600', color: '#64748B', marginLeft: '4px' }}>
                    (Peak {maxWindSpeedScope})
                  </span>
                )}
              </div>
            </div>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: maxWindSpeedScope < 15 ? '#166534' : '#B45309', marginTop: '6px' }}>
              {maxWindSpeedScope < 15
                ? (currentLang === 'hi' ? '✓ सुरक्षित छिड़काव सीमा (<15 किमी)' : currentLang === 'te' ? '✓ సురక్షిత గాలి వేగం (<15 కి.మీ)' : '✓ Safe spray drift (< 15 km/h)')
                : (currentLang === 'hi' ? '⚠️ तेज बहाव / दवा बहने का जोखिम' : currentLang === 'te' ? '⚠️ తీవ్ర గాలి — స్ప్రే నష్టం' : '⚠️ Gusty / High chemical drift')}
            </div>
          </div>

          {/* 4. Humidity */}
          <div style={{
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>
                  {currentLang === 'hi' ? '💧 नमी / आर्द्रता' : currentLang === 'te' ? '💧 తేమ శాతం' : '💧 Humidity'}
                </span>
                <Droplets size={18} style={{ color: '#059669' }} />
              </div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#0F172A' }}>
                {humidityScope}%
              </div>
            </div>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: humidityScope > 75 ? '#B45309' : '#166534', marginTop: '6px' }}>
              {humidityScope > 75
                ? (currentLang === 'hi' ? 'ओस व फफूंद का ध्यान रखें' : currentLang === 'te' ? 'మంచు మరియు తెగులు ప్రభావం' : 'High dew / fungal watch')
                : (currentLang === 'hi' ? 'सामान्य नमी संतुलन' : currentLang === 'te' ? 'సహజ తేమ స్థిరత' : 'Normal moisture balance')}
            </div>
          </div>

          {/* 5. Sunrise & Sunset */}
          <div style={{
            background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
            border: '1px solid #FCD34D',
            borderRadius: '12px',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#92400E', textTransform: 'uppercase' }}>
                  {currentLang === 'hi' ? '🌅 सूर्योदय / सूर्यास्त' : currentLang === 'te' ? '🌅 సూర్యోదయం / సూర్యాస్తమయం' : '🌅 Sunrise / Sunset'}
                </span>
                <Sun size={18} style={{ color: '#D97706' }} />
              </div>
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#78350F' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🌅 {sunriseScope}</span>
                  <span style={{ color: '#B45309' }}>•</span>
                  <span>🌇 {sunsetScope}</span>
                </div>
              </div>
            </div>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#92400E', marginTop: '6px' }}>
              {isRangeMode
                ? (currentLang === 'hi' ? `${activeScopeDays.length} दिन का परिचालन समय` : currentLang === 'te' ? `${activeScopeDays.length} రోజుల పని సమయం` : `${activeScopeDays.length} Days Operational Horizon`)
                : (currentLang === 'hi' ? 'दिन का प्रकाश कार्य समय' : currentLang === 'te' ? 'పగటి వేళ వ్యవసాయ సమయం' : 'Daylight Field Operations')}
            </div>
          </div>
        </div>
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
