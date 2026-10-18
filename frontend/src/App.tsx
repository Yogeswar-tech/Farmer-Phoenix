import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView
} from 'react-native';
import type { Language, MandiItem, NavigationTab, LocationOption } from './types';
import {
  MANDI_DATABASE,
  AGRICULTURAL_LOCATIONS,
  getLocationAdaptedMandi,
  getNearestLocationFromCoords,
  getLanguageForLocation
} from './data/mockData';
import { translations } from './data/i18n';
import { KisanSethuApi } from './services/api';
import { Header } from './components/Header';
import { DesktopSidebar } from './components/DesktopSidebar';
import { MandiHeroCard } from './components/MandiHeroCard';
import { FarmerHomeDashboard } from './components/FarmerHomeDashboard';
import { MandiLogisticsView } from './components/MandiLogisticsView';
import { ClimatePredictionView } from './components/ClimatePredictionView';
import { CropPesticideDoctorView } from './components/CropPesticideDoctorView';
import { SoilDoctorView } from './components/SoilDoctorView';
import { SchemesSection } from './components/SchemesSection';
import { ColdStorageMapView } from './components/ColdStorageMapView';
import { AiVoiceAssistantModal } from './components/AiVoiceAssistantModal';
import { PriceAlertModal } from './components/PriceAlertModal';
import { LoginModal, type FarmerProfile } from './components/LoginModal';
import { LocationModal } from './components/LocationModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { TrendingUp } from 'lucide-react';

const TAB_TO_PATH: Record<NavigationTab, string> = {
  home: '/',
  rates: '/prices',
  climate: '/weather',
  advisory: '/doctor',
  soildoctor: '/soil',
  schemes: '/schemes',
  storage: '/storage',
  logistics: '/transport'
};

const PATH_TO_TAB: Record<string, NavigationTab> = {
  '/': 'home',
  '/home': 'home',
  '/prices': 'rates',
  '/weather': 'climate',
  '/doctor': 'advisory',
  '/soil': 'soildoctor',
  '/schemes': 'schemes',
  '/storage': 'storage',
  '/transport': 'logistics'
};

export function App() {
  // User Profile from DB (strictly isolated per Gmail account)
  const [currentUserProfile, setCurrentUserProfile] = useState<FarmerProfile | null>(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('ks_auth_profile');
      if (savedUser) {
        try {
          return JSON.parse(savedUser);
        } catch {
          return null;
        }
      }
    }
    return null;
  });

  // Authentication State
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return Boolean(localStorage.getItem('ks_auth_profile'));
    }
    return false;
  });

  const [userName, setUserName] = useState<string | undefined>(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('ks_auth_profile');
      if (savedUser) {
        try {
          const u = JSON.parse(savedUser);
          return u.farmer_name || u.email?.split('@')[0];
        } catch {}
      }
    }
    return undefined;
  });

  // Responsive Layout: Track mobile web vs desktop screen size
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 768;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize Location: Prioritize DB profile of logged-in user, otherwise localStorage, otherwise default
  const [currentLocation, setCurrentLocation] = useState<LocationOption>(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('ks_auth_profile');
      if (savedUser) {
        try {
          const u = JSON.parse(savedUser);
          if (u.location_id) {
            const matched = AGRICULTURAL_LOCATIONS.find((loc) => loc.id.toLowerCase() === u.location_id.toLowerCase());
            if (matched) return matched;
          }
          if (u.district && u.state) {
            const matched = AGRICULTURAL_LOCATIONS.find((loc) => loc.district.en.toLowerCase() === u.district.toLowerCase());
            if (matched) return matched;
            return {
              id: u.location_id || `user-${u.district.toLowerCase()}`,
              name: { en: u.location_name || u.district, hi: u.location_name || u.district, te: u.location_name || u.district },
              state: { en: u.state, hi: u.state, te: u.state },
              district: { en: u.district, hi: u.district, te: u.district },
              mandiName: {
                en: `${u.location_name || u.district} APMC Market`,
                hi: `${u.location_name || u.district} कृषि मंडी`,
                te: `${u.location_name || u.district} మార్కెట్ యార్డ్`
              },
              pincode: u.pincode || '',
              lat: u.latitude ? Number(u.latitude) : 16.3067,
              lng: u.longitude ? Number(u.longitude) : 80.4365
            };
          }
        } catch {}
      }

      const savedLocId = localStorage.getItem('ks_user_location_id');
      if (savedLocId) {
        const found = AGRICULTURAL_LOCATIONS.find((loc) => loc.id === savedLocId);
        if (found) return found;
      }
    }
    return AGRICULTURAL_LOCATIONS[0];
  });

  // Initialize Language: Check DB profile, then localStorage, otherwise match regional language of location
  const [currentLang, setCurrentLang] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('ks_auth_profile');
      if (savedUser) {
        try {
          const u = JSON.parse(savedUser);
          if (u.preferred_lang === 'hi' || u.preferred_lang === 'te' || u.preferred_lang === 'en') {
            return u.preferred_lang;
          }
        } catch {}
      }
      const savedLang = localStorage.getItem('ks_user_lang') as Language | null;
      if (savedLang === 'hi' || savedLang === 'te' || savedLang === 'en') {
        return savedLang;
      }
      const savedLocId = localStorage.getItem('ks_user_location_id');
      if (savedLocId) {
        const found = AGRICULTURAL_LOCATIONS.find((loc) => loc.id === savedLocId);
        if (found) return getLanguageForLocation(found);
      }
    }
    return 'te';
  });

  // Initialize Selected Crop: Prioritize DB profile of logged-in user
  const [selectedCropKey, setSelectedCropKey] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('ks_auth_profile');
      if (savedUser) {
        try {
          const u = JSON.parse(savedUser);
          if (u.primary_crop) return u.primary_crop;
        } catch {}
      }
    }
    return 'chilli';
  });

  // Automatically detect user's Geo location if no user profile and no manual location set
  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;
    if (localStorage.getItem('ks_auth_profile') || localStorage.getItem('ks_loc_manual') === 'true') return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const nearest = getNearestLocationFromCoords(latitude, longitude);
        const geoLang = getLanguageForLocation(nearest);

        const hasManualLoc = localStorage.getItem('ks_loc_manual') === 'true';
        if (!hasManualLoc) {
          setCurrentLocation(nearest);
          localStorage.setItem('ks_user_location_id', nearest.id);
        }

        const hasManualLang = localStorage.getItem('ks_lang_manual') === 'true';
        if (!hasManualLang) {
          setCurrentLang(geoLang);
          localStorage.setItem('ks_user_lang', geoLang);
        }
      },
      (err) => {
        console.log('Browser geolocation notice:', err.message);
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 }
    );
  }, []);

  const handleLanguageChange = (lang: Language) => {
    setCurrentLang(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ks_user_lang', lang);
      localStorage.setItem('ks_lang_manual', 'true');
    }
  };

  const navigate = useNavigate();
  const location = useLocation();

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isLocationPostLogin, setIsLocationPostLogin] = useState(false);

  // If a logged-in user returns with an unconfigured "Local Farm" location, prompt Auto GPS
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedUser = localStorage.getItem('ks_auth_profile');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        if (!u.district || u.district.toLowerCase() === 'local farm' || u.location_name?.toLowerCase() === 'local farm') {
          setIsLocationPostLogin(true);
          setIsLocationModalOpen(true);
        }
      } catch (e) {}
    }
  }, []);

  const activeTab: NavigationTab = useMemo(() => {
    return PATH_TO_TAB[location.pathname] || 'home';
  }, [location.pathname]);

  const handleSelectTab = useCallback((tab: NavigationTab) => {
    const targetPath = TAB_TO_PATH[tab] || '/';
    if (location.pathname !== targetPath) {
      navigate(targetPath);
    }
  }, [location.pathname, navigate]);

  // Update document.documentElement.lang whenever the language changes
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = currentLang;
    }
  }, [currentLang]);
  const [searchQuery, setSearchQuery] = useState('');

  // AI Voice Assistant State
  const [isAiModeEnabled, setIsAiModeEnabled] = useState(true);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [lockedFeatureName, setLockedFeatureName] = useState<string | undefined>(undefined);

  // Price Alert Modal State
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);

  // Live data states
  const [liveMandiRecord, setLiveMandiRecord] = useState<any | null>(null);
  const [isMandiLoading, setIsMandiLoading] = useState<boolean>(true);
  const [isMandiError, setIsMandiError] = useState<boolean>(false);
  const [isMandiSample, setIsMandiSample] = useState<boolean>(false);

  const [liveWeatherRecord, setLiveWeatherRecord] = useState<any | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState<boolean>(true);
  const [isWeatherError, setIsWeatherError] = useState<boolean>(false);
  const [isWeatherSample, setIsWeatherSample] = useState<boolean>(false);

  // Nearest markets state from backend using real distances
  const [nearestMarkets, setNearestMarkets] = useState<any[]>([]);
  const [isNearestLoading, setIsNearestLoading] = useState<boolean>(true);
  const [isNearestError, setIsNearestError] = useState<boolean>(false);
  const [isNearestSample, setIsNearestSample] = useState<boolean>(false);
  const [nearestAsOf, setNearestAsOf] = useState<string>('Today Live');
  const [nearestSource, setNearestSource] = useState<string>('Agmarknet Geospatial Network');

  const [_isLiveFromBackend, setIsLiveFromBackend] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  useEffect(() => {
    const handleOpenAiModal = () => setIsAiModalOpen(true);
    window.addEventListener('open-ai-voice-bot', handleOpenAiModal);
    return () => window.removeEventListener('open-ai-voice-bot', handleOpenAiModal);
  }, []);

  const t = translations[currentLang];

  // Fetch live Mandi rates from Backend whenever selected crop or location changes
  useEffect(() => {
    let isMounted = true;

    const fetchLiveMandi = async () => {
      setIsMandiLoading(true);
      setIsMandiError(false);
      try {
        const res = await KisanSethuApi.getMandiRates(selectedCropKey, currentLocation.state.en);
        const rates = res?.data || [];
        const isSample = Boolean(res?.isSample);
        setIsMandiSample(isSample);

        if (isMounted && rates && rates.length > 0 && !isSample) {
          const keyLower = selectedCropKey.toLowerCase().replace(/_/g, ' ');
          const matched = rates.find((r: any) => {
            const comm = (r.commodity || '').toLowerCase();
            const aliases = (r.payload?.aliases || '').toLowerCase();
            return comm.includes(keyLower) || keyLower.includes(comm) || aliases.includes(keyLower);
          }) || rates[0];
          setLiveMandiRecord(matched);
          setIsLiveFromBackend(true);
          setIsMandiError(false);
        } else {
          // Direct fallback to live-today crop search
          const searchRes = await KisanSethuApi.searchCropTodayPrice(selectedCropKey, `${currentLocation.name.en} APMC Yard`, currentLocation.state.en);
          if (isMounted && searchRes && searchRes.status === 'success') {
            setLiveMandiRecord(searchRes);
            setIsLiveFromBackend(true);
            setIsMandiError(false);
            setIsMandiSample(false);
          } else {
            if (isMounted) {
              setLiveMandiRecord(null);
              setIsLiveFromBackend(false);
              setIsMandiError(true);
              setIsMandiSample(true);
            }
          }
        }
      } catch {
        if (isMounted) {
          setLiveMandiRecord(null);
          setIsLiveFromBackend(false);
          setIsMandiError(true);
          setIsMandiSample(true);
        }
      } finally {
        if (isMounted) setIsMandiLoading(false);
      }
    };
    fetchLiveMandi();
    return () => { isMounted = false; };
  }, [selectedCropKey, currentLocation.id, currentLocation.name.en, currentLocation.state.en, refreshTrigger]);

  // Fetch live operational weather from Backend
  useEffect(() => {
    let isMounted = true;

    const fetchLiveWeather = async () => {
      setIsWeatherLoading(true);
      setIsWeatherError(false);
      try {
        const res = await KisanSethuApi.getWeatherAdvisories(currentLocation.id);
        const weatherList = res?.data || [];
        const isSample = Boolean(res?.isSample);
        setIsWeatherSample(isSample);

        if (isMounted && weatherList && weatherList.length > 0 && !isSample) {
          setLiveWeatherRecord(weatherList[0]);
          setIsWeatherError(false);
        } else {
          if (isMounted) {
            setLiveWeatherRecord(null);
            setIsWeatherError(true);
            setIsWeatherSample(true);
          }
        }
      } catch {
        if (isMounted) {
          setLiveWeatherRecord(null);
          setIsWeatherError(true);
          setIsWeatherSample(true);
        }
      } finally {
        if (isMounted) setIsWeatherLoading(false);
      }
    };
    fetchLiveWeather();
    return () => { isMounted = false; };
  }, [currentLocation.id, refreshTrigger]);

  // Fetch nearest APMC markets from backend using real distances from selected district
  useEffect(() => {
    let isMounted = true;

    const fetchNearest = async () => {
      setIsNearestLoading(true);
      setIsNearestError(false);
      try {
        const districtName = currentLocation.district?.en || currentLocation.name.en;
        const res = await KisanSethuApi.getNearestMarkets(
          districtName,
          currentLocation.state?.en,
          selectedCropKey
        );
        if (isMounted) {
          if (res && res.data && res.data.length > 0) {
            setNearestMarkets(res.data);
            setIsNearestSample(Boolean(res.isSample));
            setNearestAsOf(res.asOf || 'Today Live');
            setNearestSource(res.source || 'Agmarknet Geospatial Network');
            setIsNearestError(false);
          } else {
            setNearestMarkets([]);
            setIsNearestSample(true);
            setIsNearestError(true);
          }
        }
      } catch {
        if (isMounted) {
          setNearestMarkets([]);
          setIsNearestSample(true);
          setIsNearestError(true);
        }
      } finally {
        if (isMounted) setIsNearestLoading(false);
      }
    };

    fetchNearest();
    return () => { isMounted = false; };
  }, [currentLocation.id, currentLocation.district?.en, currentLocation.name.en, currentLocation.state?.en, selectedCropKey, refreshTrigger]);

  // Active Mandi item based on selected crop or search query, dynamically adapted to user's selected location
  const baseMandi: MandiItem = useMemo(() => {
    const key = selectedCropKey.toLowerCase();
    let found = MANDI_DATABASE.find(
      (m) =>
        m.cropKey.toLowerCase() === key ||
        m.cropKey.toLowerCase().replace(/_/g, '') === key.replace(/_/g, '') ||
        m.cropName.en.toLowerCase().includes(key) ||
        key.includes(m.cropName.en.toLowerCase())
    );
    if (found) return found;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      found = MANDI_DATABASE.find(
        (m) =>
          m.cropName[currentLang]?.toLowerCase().includes(q) ||
          m.cropName.en.toLowerCase().includes(q) ||
          m.cropKey.toLowerCase().includes(q)
      );
      if (found) return found;
    }

    // Dynamic Mandi Item for any crop on Earth (avoids hardcoded fallback freeze!)
    const cropNameClean = selectedCropKey
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    return {
      id: `dynamic-${key}`,
      cropKey: key,
      cropName: { hi: cropNameClean, te: cropNameClean, en: cropNameClean },
      variety: 'Commercial APMC Standard',
      mandiName: {
        hi: `${currentLocation.district[currentLang] || currentLocation.district.en} मुख्य यार्ड`,
        te: `${currentLocation.district[currentLang] || currentLocation.district.en} మార్కెట్`,
        en: `${currentLocation.district.en} Main APMC Yard`
      },
      state: currentLocation.state,
      distanceKm: 8,
      lastUpdated: '10:45 AM',
      isLive: true,
      marketStatus: 'open',
      operatingHours: '08:00 AM - 02:00 PM',
      priceTrend: { diffLastWeek: 180, percentage: 3.8, highest14Days: true },
      whySellReasons: {
        trendReason: {
          hi: `${cropNameClean} भाव में आज सुधार दर्ज हुआ है।`,
          te: `${cropNameClean} ధరలో ఈరోజు పెరుగుదల నమోదైంది.`,
          en: `Steady demand for ${cropNameClean} at apex yard (+₹180/qtl).`
        },
        weatherReason: {
          hi: 'मौसम साफ रहने की संभावना है। सुरक्षित परिवहन।',
          te: 'వాతావరణం అనుకూలంగా ఉంది. సురక్షిత రవాణా.',
          en: 'Clear weather conditions. Safe for open trolley transit.'
        },
        inflowReason: {
          hi: 'मंडी में उत्तम लॉट की आवक संतुलित है।',
          te: 'మార్కెట్‌కు నాణ్యమైన సరుకు రాక స్థిరంగా ఉంది.',
          en: 'Commission buyers actively competing for fresh arrivals.'
        }
      },
      grades: [
        {
          name: { hi: 'उत्तम गुणवत्ता (ग्रेड A)', te: 'ఉత్తమ నాణ్యత (గ్రేడ్ A)', en: 'Grade A (Super Quality)' },
          gradeCode: 'A',
          priceRange: '₹3,400 – ₹3,850',
          minPrice: 3400,
          maxPrice: 3850,
          modalPrice: 3650,
          qualityCriteria: { hi: 'साफ, दागरहित, मानक नमी', te: 'శుభ్రమైనది, మంచి రంగు', en: 'Blemish-free, optimal moisture' },
          badgeColor: '#15803d'
        },
        {
          name: { hi: 'मध्यम मुख्य भाव', te: 'సాధారణ మోడల్ ధర', en: 'Modal Average Rate' },
          gradeCode: 'MODAL',
          priceRange: '₹3,100 – ₹3,400',
          minPrice: 3100,
          maxPrice: 3400,
          modalPrice: 3250,
          qualityCriteria: { hi: 'मानक मंडी लॉट', te: 'ప్రామాణిక లాట్', en: 'Standard yard lot' },
          badgeColor: '#0284c7'
        },
        {
          name: { hi: 'सामान्य ग्रेड C', te: 'గ్రేడ్ C', en: 'Grade C (Fair Average)' },
          gradeCode: 'C',
          priceRange: '₹2,100 – ₹2,600',
          minPrice: 2100,
          maxPrice: 2600,
          modalPrice: 2350,
          qualityCriteria: { hi: 'हल्की नमी, मिश्रित आकार', te: 'స్వల్ప తేమ', en: 'Fair quality, slight moisture' },
          badgeColor: '#dc2626'
        }
      ],
      unsoldYardStockBags: 14200,
      eNamLotVerified: true,
      otherNearbyMandis: [
        {
          name: { hi: 'क्षेत्रीय मंडी', te: 'ప్రాంతీయ మార్కెట్', en: 'Regional APMC Yard' },
          distance: 28,
          modalPrice: 3320
        }
      ]
    };
  }, [selectedCropKey, searchQuery, currentLang, currentLocation]);

  const activeMandi: MandiItem = useMemo(() => {
    const base = getLocationAdaptedMandi(baseMandi, currentLocation);
    if (liveMandiRecord && liveMandiRecord.modal_price_qtl) {
      const liveModalQtl = Number(liveMandiRecord.modal_price_qtl);
      const liveMinQtl = Number(liveMandiRecord.min_price_qtl || liveModalQtl * 0.9);
      const liveMaxQtl = Number(liveMandiRecord.max_price_qtl || liveModalQtl * 1.1);
      const liveMarket = liveMandiRecord.market || base.mandiName.en;
      const liveDate = liveMandiRecord.arrival_date || base.lastUpdated;

      return {
        ...base,
        mandiName: {
          en: liveMarket,
          hi: liveMarket,
          te: liveMarket
        },
        variety: liveMandiRecord.variety || base.variety,
        lastUpdated: `${liveDate} (Agmarknet Live)`,
        isLive: true,
        grades: base.grades.map(g => {
          if (g.gradeCode === 'MODAL') {
            return {
              ...g,
              modalPrice: liveModalQtl,
              minPrice: liveMinQtl,
              maxPrice: liveMaxQtl,
              priceRange: `₹${liveMinQtl.toLocaleString()} - ₹${liveMaxQtl.toLocaleString()}`
            };
          }
          if (g.gradeCode === 'A') {
            return {
              ...g,
              modalPrice: Math.round(liveModalQtl * 1.08),
              minPrice: Math.round(liveMinQtl * 1.05),
              maxPrice: Math.round(liveMaxQtl * 1.12),
              priceRange: `₹${Math.round(liveMinQtl * 1.05).toLocaleString()} - ₹${Math.round(liveMaxQtl * 1.12).toLocaleString()}`
            };
          }
          return g;
        })
      };
    }
    return base;
  }, [baseMandi, currentLocation, liveMandiRecord]);

  const handleOpenLogin = (feature?: string) => {
    setLockedFeatureName(feature);
    setIsLoginModalOpen(true);
  };

  const handleLocationChange = async (loc: LocationOption, _isAutoGps: boolean = false) => {
    setCurrentLocation(loc);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ks_user_location_id', loc.id);
      localStorage.setItem('ks_loc_manual', 'true');
      const hasManualLang = localStorage.getItem('ks_lang_manual') === 'true';
      if (!hasManualLang) {
        const geoLang = getLanguageForLocation(loc);
        setCurrentLang(geoLang);
        localStorage.setItem('ks_user_lang', geoLang);
      }
    }

    // Persist new location directly to DB profile if logged in!
    if (currentUserProfile && currentUserProfile.email) {
      try {
        const res = await KisanSethuApi.updateFarmerLocation({
          email: currentUserProfile.email,
          locationId: loc.id,
          locationName: loc.name.en,
          district: loc.district.en,
          state: loc.state.en,
          latitude: loc.lat,
          longitude: loc.lng,
          pincode: loc.pincode
        });
        if (res && res.profile) {
          setCurrentUserProfile(res.profile);
          localStorage.setItem('ks_auth_profile', JSON.stringify(res.profile));
        }
      } catch (e) {
        console.warn('Could not sync location to DB profile:', e);
      }
    }

    setRefreshTrigger((prev) => prev + 1);
  };

  const handleGmailLoginSuccess = (profile: FarmerProfile) => {
    setCurrentUserProfile(profile);
    setIsLoggedIn(true);
    const displayName = profile.farmer_name || (profile.email ? profile.email.split('@')[0] : (profile.phone_number ? `+91 ${profile.phone_number}` : 'రైతు మిత్ర'));
    setUserName(displayName);

    if (typeof window !== 'undefined') {
      localStorage.setItem('ks_auth_profile', JSON.stringify(profile));
      if (profile.email) {
        localStorage.setItem('ks_active_email', profile.email);
      }
    }

    // 1. Resolve and cascade user's location strictly from their DB profile!
    let matchedLoc: LocationOption | undefined;
    if (profile.location_id) {
      matchedLoc = AGRICULTURAL_LOCATIONS.find((l) => l.id.toLowerCase() === profile.location_id?.toLowerCase());
    }
    if (!matchedLoc && profile.district) {
      matchedLoc = AGRICULTURAL_LOCATIONS.find((l) => l.district.en.toLowerCase() === profile.district?.toLowerCase());
    }

    if (matchedLoc) {
      setCurrentLocation(matchedLoc);
      localStorage.setItem('ks_user_location_id', matchedLoc.id);
    } else if (profile.district && profile.state) {
      const dynamicLoc: LocationOption = {
        id: profile.location_id || `user-loc-${profile.district.toLowerCase()}`,
        name: {
          en: profile.location_name || profile.district,
          hi: profile.location_name || profile.district,
          te: profile.location_name || profile.district
        },
        state: { en: profile.state, hi: profile.state, te: profile.state },
        district: { en: profile.district, hi: profile.district, te: profile.district },
        mandiName: {
          en: `${profile.location_name || profile.district} APMC Yard`,
          hi: `${profile.location_name || profile.district} कृषि मंडी`,
          te: `${profile.location_name || profile.district} మార్కెట్ యార్డ్`
        },
        pincode: profile.pincode || '',
        lat: profile.latitude ? Number(profile.latitude) : 16.3067,
        lng: profile.longitude ? Number(profile.longitude) : 80.4365
      };
      setCurrentLocation(dynamicLoc);
      localStorage.setItem('ks_user_location_id', dynamicLoc.id);
    }

    // 2. Cascade user's primary crop strictly from their DB profile!
    if (profile.primary_crop) {
      setSelectedCropKey(profile.primary_crop);
    }

    // 3. Cascade user's preferred language strictly from their DB profile!
    if (
      profile.preferred_lang &&
      (profile.preferred_lang === 'hi' || profile.preferred_lang === 'te' || profile.preferred_lang === 'en')
    ) {
      setCurrentLang(profile.preferred_lang);
      localStorage.setItem('ks_user_lang', profile.preferred_lang);
    }

    setRefreshTrigger((prev) => prev + 1);

    // Auto GPS Location Pop-Up once users login
    setIsLocationPostLogin(true);
    setIsLocationModalOpen(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserName(undefined);
    setCurrentUserProfile(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ks_auth_profile');
      localStorage.removeItem('ks_active_email');
    }
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleSelectCrop = (cropKey: string) => {
    setSelectedCropKey(cropKey);
    if (currentUserProfile && currentUserProfile.email) {
      KisanSethuApi.updateFarmerCrop(currentUserProfile.email, cropKey).catch(() => {});
    }
  };

  const handleShareWhatsApp = () => {
    const modalPrice = activeMandi.grades.find((g) => g.gradeCode === 'MODAL')?.modalPrice || 14200;
    let text = '';
    if (currentLang === 'hi') {
      text = `🌾 *किसान सेतु (Kisan Setu) आज का मंडी भाव*\n📍 ${activeMandi.mandiName.hi} - ${activeMandi.cropName.hi} (${activeMandi.variety})\n💰 मुख्य भाव: ₹${modalPrice.toLocaleString()}/क्विंटल (▲ +₹${activeMandi.priceTrend.diffLastWeek} पिछले सप्ताह से अधिक)\n✅ सलाह: बेचने का उत्तम समय\n⚠️ मौसम चेतावनी: गुरुवार को भारी बारिश की संभावना (छिड़काव न करें)\n🔗 ताजा भाव व रसीद देखें: https://kisansetu.in`;
    } else if (currentLang === 'te') {
      text = `🌾 *కిసాన్ సేతు (Kisan Setu) నేటి మార్కెట్ ధరలు*\n📍 ${activeMandi.mandiName.te} - ${activeMandi.cropName.te} (${activeMandi.variety})\n💰 ప్రధాన ధర: ₹${modalPrice.toLocaleString()}/క్వింటా (▲ +₹${activeMandi.priceTrend.diffLastWeek} పెరుగుదల)\n✅ సలహా: అమ్మడానికి మంచి సమయం\n⚠️ వాతావరణం: గురువారం భారీ వర్షం సూచన (పిచికారీ వాయిదా వేయండి)\n🔗 పూర్తి వివరాలు: https://kisansetu.in`;
    } else {
      text = `🌾 *Kisan Setu Live Mandi Prices*\n📍 ${activeMandi.mandiName.en} - ${activeMandi.cropName.en} (${activeMandi.variety})\n💰 Modal Price: ₹${modalPrice.toLocaleString()}/quintal (▲ +₹${activeMandi.priceTrend.diffLastWeek} higher above last week)\n✅ Advisory: Good time to sell\n⚠️ Weather: Heavy rain expected Thursday (delay spraying)\n🔗 View live rates & advisory: https://kisansetu.in`;
    }
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleOpenHelpline = (num: string) => {
    window.location.href = `tel:${num}`;
  };

  return (
    <SafeAreaView style={[styles.safeArea, isMobile && styles.safeAreaMobile]}>
      <View style={[styles.appContainer, isMobile && styles.appContainerMobile]}>
        {/* Top Header */}
        <Header
          currentLang={currentLang}
          onLanguageChange={handleLanguageChange}
          onOpenLogin={() => handleOpenLogin()}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelectCrop={(key) => setSelectedCropKey(key)}
          isLoggedIn={isLoggedIn}
          userName={userName}
          currentLocation={currentLocation}
          onOpenLocationModal={() => setIsLocationModalOpen(true)}
          onSelectLocation={handleLocationChange}
        />


        {/* Body Layout: Sidebar + Main Content */}
        <View
          style={[styles.bodyLayout, isMobile && styles.bodyLayoutMobile]}
        >
          {/* Desktop Left Sidebar (Rendered ONLY on desktop > 768px) */}
          {!isMobile && (
            <div className="desktop-sidebar-wrapper">
              <DesktopSidebar
                currentLang={currentLang}
                activeTab={activeTab}
                onSelectTab={handleSelectTab}
                onOpenHelpline={handleOpenHelpline}
              />
            </div>
          )}

          {/* Main Scrollable Content */}
          <ScrollView
            style={[styles.mainScrollView, isMobile && styles.mainScrollViewMobile]}
            contentContainerStyle={[styles.scrollContent, isMobile && styles.scrollContentMobile]}
          >
            {/* TAB 1: Home Dashboard - Clean Modern Farmer-First Interface */}
            {activeTab === 'home' && (
              <FarmerHomeDashboard
                currentLang={currentLang}
                userName={userName}
                currentLocation={currentLocation}
                activeMandi={activeMandi}
                liveMandiRecord={liveMandiRecord}
                isMandiLoading={isMandiLoading}
                isMandiError={isMandiError}
                isMandiSample={isMandiSample}
                liveWeatherRecord={liveWeatherRecord}
                isWeatherLoading={isWeatherLoading}
                isWeatherError={isWeatherError}
                isWeatherSample={isWeatherSample}
                nearestMarkets={nearestMarkets}
                isNearestMarketsLoading={isNearestLoading}
                isNearestMarketsError={isNearestError}
                isNearestMarketsSample={isNearestSample}
                nearestMarketsAsOf={nearestAsOf}
                nearestMarketsSource={nearestSource}
                onNavigateTab={handleSelectTab}
                onOpenVoiceAssistant={() => setIsAiModalOpen(true)}
                onOpenCropDoctorUpload={() => handleSelectTab('advisory')}
                onOpenLogin={handleOpenLogin}
                onOpenHelpline={handleOpenHelpline}
              />
            )}

            {/* TAB 2: Mandi Logistics */}
            {activeTab === 'logistics' && (
              <MandiLogisticsView
                currentLang={currentLang}
                mandi={activeMandi}
                currentLocation={currentLocation}
              />
            )}

            {/* TAB 4: Today's Price */}
            {activeTab === 'rates' && (
              <View style={styles.ratesView}>
                <View style={styles.viewHeaderStrip}>
                  <TrendingUp size={20} color="#2D5A27" />
                  <Text style={styles.viewHeaderTitle}>
                    {t.tabRates} - {activeMandi.cropName[currentLang]}
                  </Text>
                </View>
                <MandiHeroCard
                  currentLang={currentLang}
                  mandi={activeMandi}
                  isSummaryOnly={false}
                  onOpenAlertModal={() => setIsAlertModalOpen(true)}
                  onShareWhatsApp={handleShareWhatsApp}
                  onOpenHelpline={handleOpenHelpline}
                  onSelectCrop={handleSelectCrop}
                  currentLocation={currentLocation}
                />
              </View>
            )}

            {/* TAB 5: Climate Prediction */}
            {activeTab === 'climate' && (
              <ClimatePredictionView
                currentLang={currentLang}
                isLoggedIn={isLoggedIn}
                onOpenLogin={handleOpenLogin}
                currentLocation={currentLocation}
              />
            )}

            {/* TAB 6: Unified Crop Advisory & Safety Doctor */}
            {activeTab === 'advisory' && (
              <CropPesticideDoctorView
                currentLang={currentLang}
                currentLocation={currentLocation}
                initialCropKey={selectedCropKey || 'tomato'}
                onOpenHelpline={handleOpenHelpline}
              />
            )}

            {/* TAB 8: Soil Doctor */}
            {activeTab === 'soildoctor' && (
              <SoilDoctorView
                currentLang={currentLang}
                onOpenBookingGate={handleOpenLogin}
                currentLocation={currentLocation}
              />
            )}

            {/* TAB 9: Government Schemes */}
            {activeTab === 'schemes' && (
              <SchemesSection
                currentLang={currentLang}
                onOpenHelpline={handleOpenHelpline}
                onLockedFeatureClick={(feat) => handleOpenLogin(feat)}
                currentLocation={currentLocation}
              />
            )}

            {/* TAB 10: Cold Storage */}
            {activeTab === 'storage' && (
              <ColdStorageMapView
                currentLang={currentLang}
                onOpenHelpline={handleOpenHelpline}
                onOpenBookingGate={handleOpenLogin}
                currentLocation={currentLocation}
                onSelectLocation={handleLocationChange}
              />
            )}
          </ScrollView>
        </View>

        {/* Sticky Mobile-Only Bottom Navigation (Fixed at bottom on mobile, hidden on desktop) */}
        {isMobile && (
          <div className="mobile-bottom-nav-wrap" data-testid="mobile-bottom-nav">
            <MobileBottomNav
              currentLang={currentLang}
              activeTab={activeTab}
              onSelectTab={handleSelectTab}
            />
          </div>
        )}

        {/* Floating AI Voice Assistant Button (Instant Click Response) */}
        {isAiModeEnabled && (
          <button
            type="button"
            id="floating-ask-ai-btn"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('[KisanSethu] Ask AI Floating Button Clicked!');
              setIsAiModalOpen(true);
            }}
            style={{
              position: 'fixed',
              bottom: '76px',
              right: '20px',
              backgroundColor: '#1E3F1A',
              borderRadius: '999px',
              padding: '10px 18px',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 4px 16px rgba(30, 63, 26, 0.45)',
              border: '2px solid #86EFAC',
              zIndex: 99999,
              cursor: 'pointer',
              outline: 'none',
              pointerEvents: 'auto'
            }}
          >
            <img
              src="/brinjal.png"
              alt="Ask AI"
              style={{ width: '28px', height: '28px', objectFit: 'contain', pointerEvents: 'none' }}
            />
            <span style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: '800', letterSpacing: '0.2px', pointerEvents: 'none' }}>
              Ask AI
            </span>
          </button>
        )}

        {/* Modals */}
        <AiVoiceAssistantModal
          isOpen={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          currentLang={currentLang}
          activeMandi={activeMandi}
          isAiModeEnabled={isAiModeEnabled}
          onToggleAiMode={setIsAiModeEnabled}
        />

        <PriceAlertModal
          currentLang={currentLang}
          isOpen={isAlertModalOpen}
          onClose={() => setIsAlertModalOpen(false)}
          cropName={activeMandi.cropName[currentLang]}
          defaultPrice={activeMandi.grades[1]?.modalPrice || 14200}
        />

        <LoginModal
          currentLang={currentLang}
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onLoginSuccess={handleGmailLoginSuccess}
          onLogout={handleLogout}
          currentUserProfile={currentUserProfile}
          lockedFeatureName={lockedFeatureName}
        />

        <LocationModal
          isOpen={isLocationModalOpen}
          onClose={() => {
            setIsLocationModalOpen(false);
            setIsLocationPostLogin(false);
          }}
          currentLocation={currentLocation}
          onSelectLocation={handleLocationChange}
          currentLang={currentLang}
          isPostLoginPrompt={isLocationPostLogin}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    height: '100vh' as any,
    maxHeight: '100vh' as any,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden' as any,
  },
  safeAreaMobile: {
    height: 'auto' as any,
    minHeight: '100dvh' as any,
    maxHeight: 'none' as any,
    overflow: 'visible' as any,
  },
  appContainer: {
    flex: 1,
    height: '100vh' as any,
    maxHeight: '100vh' as any,
    backgroundColor: '#F8FAFC',
    position: 'relative',
    display: 'flex' as any,
    flexDirection: 'column' as any,
    overflow: 'hidden' as any,
  },
  appContainerMobile: {
    height: 'auto' as any,
    minHeight: '100dvh' as any,
    maxHeight: 'none' as any,
    overflow: 'visible' as any,
  },
  bodyLayout: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden' as any,
    minHeight: 0,
  },
  bodyLayoutMobile: {
    flexDirection: 'column',
    overflow: 'visible' as any,
    width: '100%',
  },
  mainScrollView: {
    flex: 1,
    height: '100%' as any,
  },
  mainScrollViewMobile: {
    height: 'auto' as any,
    width: '100%',
    overflow: 'visible' as any,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  scrollContentMobile: {
    paddingBottom: 96,
  },
  homeLayout: {
    padding: 16,
    gap: 16,
  },
  greetingStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  greetingLeft: {
    gap: 2,
  },
  farmerName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1E293B',
  },
  locationTag: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B7746',
  },
  aiBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2D5A27',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    shadowColor: '#2D5A27',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  aiBannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  fourCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  fourCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  weatherCard: {},
  doctorCard: {},
  storageCard: {},
  schemesCard: {},
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTopLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  cardMainBold: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  cardSubHint: {
    fontSize: 11,
    color: '#94A3B8',
  },
  dashedLoginStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#F8FAFC',
  },
  loginStripText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  ratesView: {
    padding: 16,
    gap: 12,
  },
  viewHeaderStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
  },
  floatingFab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    backgroundColor: '#1E3F1A',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#1E3F1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    borderWidth: 2,
    borderColor: '#86EFAC',
    zIndex: 900,
    cursor: 'pointer',
  },
  floatingFabMobile: {
    bottom: 74,
    right: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  fabBrinjalIcon: {
    width: 28,
    height: 28,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});

export default App;
