import { useState, useEffect, useMemo } from 'react';
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
  getNearestColdStorage,
  getNearestLocationFromCoords,
  getLanguageForLocation
} from './data/mockData';
import { translations } from './data/i18n';
import { KisanSethuApi } from './services/api';
import { Header } from './components/Header';
import { GovtLagNotice } from './components/GovtLagNotice';
import { DesktopSidebar } from './components/DesktopSidebar';
import { MandiHeroCard } from './components/MandiHeroCard';
import { MandiLogisticsView } from './components/MandiLogisticsView';
import { ClimatePredictionView } from './components/ClimatePredictionView';
import { CropPesticideDoctorView } from './components/CropPesticideDoctorView';
import { SoilDoctorView } from './components/SoilDoctorView';
import { SchemesSection } from './components/SchemesSection';
import { ColdStorageMapView } from './components/ColdStorageMapView';
import { EducationalChartsView } from './components/EducationalChartsView';
import { AiVoiceAssistantModal } from './components/AiVoiceAssistantModal';
import { PriceAlertModal } from './components/PriceAlertModal';
import { LoginModal, type FarmerProfile } from './components/LoginModal';
import { LocationModal } from './components/LocationModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import {
  Stethoscope,
  Landmark,
  TrendingUp,
  CloudRain,
  Warehouse,
  Lock,
  BarChart3,
  Sparkles,
  Mic
} from 'lucide-react';

export function App() {
  // User Profile from DB (strictly isolated per Gmail account)
  const [currentUserProfile, setCurrentUserProfile] = useState<FarmerProfile | null>(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('ks_auth_profile');
      if (savedUser) {
        try {
          return JSON.parse(savedUser);
        } catch (e) {
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
        } catch (e) {}
      }
    }
    return undefined;
  });

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
        } catch (e) {}
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
        } catch (e) {}
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
    return getLanguageForLocation(AGRICULTURAL_LOCATIONS[0]);
  });

  // Initialize Selected Crop: Prioritize DB profile of logged-in user
  const [selectedCropKey, setSelectedCropKey] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('ks_auth_profile');
      if (savedUser) {
        try {
          const u = JSON.parse(savedUser);
          if (u.primary_crop) return u.primary_crop;
        } catch (e) {}
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

  const [activeTab, setActiveTab] = useState<NavigationTab>('home');
  const [searchQuery, setSearchQuery] = useState('');

  // AI Voice Assistant State
  const [isAiModeEnabled, setIsAiModeEnabled] = useState(true);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [lockedFeatureName, setLockedFeatureName] = useState<string | undefined>(undefined);

  // Price Alert Modal State
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [liveMandiRecord, setLiveMandiRecord] = useState<any | null>(null);
  const [liveWeatherRecord, setLiveWeatherRecord] = useState<any | null>(null);
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
      try {
        const rates = await KisanSethuApi.getMandiRates(selectedCropKey, currentLocation.state.en);
        if (isMounted && rates && rates.length > 0) {
          const matched = rates.find((r: any) => 
            r.commodity?.toLowerCase() === selectedCropKey.toLowerCase()
          ) || rates[0];
          setLiveMandiRecord(matched);
          setIsLiveFromBackend(true);
        }
      } catch (e) {
        if (isMounted) setIsLiveFromBackend(false);
      }
    };
    fetchLiveMandi();
    return () => { isMounted = false; };
  }, [selectedCropKey, currentLocation.id, refreshTrigger]);

  // Fetch live operational weather from Backend
  useEffect(() => {
    let isMounted = true;
    const fetchLiveWeather = async () => {
      try {
        const weatherList = await KisanSethuApi.getWeatherAdvisories(currentLocation.id);
        if (isMounted && weatherList && weatherList.length > 0) {
          setLiveWeatherRecord(weatherList[0]);
        }
      } catch (e) {
        // Fallback
      }
    };
    fetchLiveWeather();
    return () => { isMounted = false; };
  }, [currentLocation.id, refreshTrigger]);

  // Active Mandi item based on selected crop or search query, dynamically adapted to user's selected location
  const baseMandi: MandiItem =
    MANDI_DATABASE.find(
      (m) =>
        m.cropKey === selectedCropKey ||
        m.cropName[currentLang].toLowerCase().includes(searchQuery.toLowerCase())
    ) || MANDI_DATABASE[0];

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

  // Dynamically calculate nearest cold storage facility based on user's selected location
  const nearestStorage = getNearestColdStorage(currentLocation);

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
    const displayName = profile.farmer_name || profile.email.split('@')[0];
    setUserName(displayName);

    if (typeof window !== 'undefined') {
      localStorage.setItem('ks_auth_profile', JSON.stringify(profile));
      localStorage.setItem('ks_active_email', profile.email);
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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.appContainer}>
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
        <View style={styles.bodyLayout}>
          {/* Desktop Left Sidebar */}
          <DesktopSidebar
            currentLang={currentLang}
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            onOpenHelpline={handleOpenHelpline}
          />

          {/* Main Scrollable Content */}
          <ScrollView style={styles.mainScrollView} contentContainerStyle={styles.scrollContent}>
            {/* TAB 1: Home Dashboard */}
            {activeTab === 'home' && (
              <View style={styles.homeLayout}>
                {/* Greeting Strip */}
                <View style={styles.greetingStrip}>
                  <View style={styles.greetingLeft}>
                    <Text style={styles.farmerName}>
                      {userName ||
                        (currentLang === 'hi'
                          ? 'नमस्ते, किसान भाई'
                          : currentLang === 'te'
                            ? 'నమస్తే, రైతు సోదరా'
                            : 'Namaste, Respected Farmer')}
                    </Text>
                    <Text style={styles.locationTag}>
                      📍 {currentLocation.name[currentLang] || currentLocation.name.en} ({currentLocation.district[currentLang] || currentLocation.district.en})
                    </Text>
                  </View>

                  {/* AI Quick Button */}
                  {isAiModeEnabled && (
                    <TouchableOpacity
                      onPress={() => setIsAiModalOpen(true)}
                      style={styles.aiBannerBtn}
                      activeOpacity={0.8}
                    >
                      <Sparkles size={16} color="#FFE600" />
                      <Text style={styles.aiBannerText}>{t.aiAssistantActive}</Text>
                      <Mic size={15} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Mandi Hero Card */}
                <MandiHeroCard
                  currentLang={currentLang}
                  mandi={activeMandi}
                  isSummaryOnly={true}
                  onViewAllGrades={() => setActiveTab('rates')}
                  onOpenAlertModal={() => setIsAlertModalOpen(true)}
                  onShareWhatsApp={handleShareWhatsApp}
                  onOpenHelpline={handleOpenHelpline}
                  onSelectCrop={(key) => setSelectedCropKey(key)}
                  currentLocation={currentLocation}
                />

                {/* Educational Charts Banner Strip */}
                <TouchableOpacity
                  onPress={() => setActiveTab('charts')}
                  style={styles.eduBannerStrip}
                  activeOpacity={0.8}
                >
                  <View style={styles.eduBannerLeft}>
                    <View style={styles.eduIconWrap}>
                      <BarChart3 size={24} color="#FFFFFF" />
                    </View>
                    <View style={styles.eduTextCol}>
                      <Text style={styles.eduBannerTitle}>
                        {currentLang === 'hi'
                          ? 'व्यापार शैक्षणिक तुलना चार्ट (Education Guide)'
                          : currentLang === 'te'
                            ? 'మార్కెట్ విద్యా & గ్రేడింగ్ చార్ట్‌లు (Education Guide)'
                            : 'Market Education & Quality Grading Charts'}
                      </Text>
                      <Text style={styles.eduBannerDesc}>
                        {currentLang === 'hi'
                          ? 'ग्रेड-ए एक्सपोर्ट बनाम ग्रेड-सी कटौती, नमी मानक व 5 मंडियों का नकद लाभ विश्लेषण देखें ➔'
                          : currentLang === 'te'
                            ? 'గ్రేడ్-ఎ ఎగుమతి vs తాల కోతలు, తేమ శాతం మరియు 5 మార్కెట్ల నికర లాభాల విశ్లేషణ చూడండి ➔'
                            : 'Compare Grade A export vs Grade C deductions, safe moisture limits & net mandi profit ➔'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.eduArrowTag}>
                    <Text style={styles.eduArrowText}>
                      {currentLang === 'hi' ? 'चार्ट खोलें' : currentLang === 'te' ? 'చూడండి' : 'Open Charts'} ➔
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* 4 Action Cards Grid */}
                <View style={styles.fourCardsGrid}>
                  {/* Weather */}
                  <TouchableOpacity
                    onPress={() => setActiveTab('climate')}
                    style={[styles.fourCard, styles.weatherCard]}
                    activeOpacity={0.8}
                  >
                    <View style={styles.cardTopRow}>
                      <Text style={styles.cardTopLabel}>
                        {currentLang === 'hi' ? '7-दिवसीय मौसम' : currentLang === 'te' ? '7 రోజుల వాతావరణం' : '7-day weather'}
                      </Text>
                      <CloudRain size={20} color="#2563EB" />
                    </View>
                    <Text style={styles.cardMainBold}>
                      {liveWeatherRecord
                        ? `${liveWeatherRecord.temp_max_c}°C • ${liveWeatherRecord.condition_text}`
                        : 'Rain Thu 31°C'}
                    </Text>
                    <Text style={styles.cardSubHint}>
                      📍 {currentLocation.name[currentLang]} ({liveWeatherRecord?.spray_status ? `Spray: ${liveWeatherRecord.spray_status}` : 'Delay spraying'})
                    </Text>
                  </TouchableOpacity>

                  {/* Doctor */}
                  <TouchableOpacity
                    onPress={() => setActiveTab('advisory')}
                    style={[styles.fourCard, styles.doctorCard]}
                    activeOpacity={0.8}
                  >
                    <View style={styles.cardTopRow}>
                      <Text style={styles.cardTopLabel}>
                        {currentLang === 'hi' ? 'क्रॉप डॉक्टर' : currentLang === 'te' ? 'క్రాప్ డాక్టర్' : 'Crop Doctor'}
                      </Text>
                      <Stethoscope size={20} color="#16A34A" />
                    </View>
                    <Text style={styles.cardMainBold}>{activeMandi.cropName[currentLang]}</Text>
                    <Text style={styles.cardSubHint}>{currentLocation.district[currentLang]} KVK</Text>
                  </TouchableOpacity>

                  {/* Storage */}
                  <TouchableOpacity
                    onPress={() => setActiveTab('storage')}
                    style={[styles.fourCard, styles.storageCard]}
                    activeOpacity={0.8}
                  >
                    <View style={styles.cardTopRow}>
                      <Text style={styles.cardTopLabel}>{t.nearestColdStorageCard}</Text>
                      <Warehouse size={20} color="#9333EA" />
                    </View>
                    <Text style={styles.cardMainBold}>{nearestStorage.distanceKm} km</Text>
                    <Text style={styles.cardSubHint}>
                      {nearestStorage.facility.name[currentLang]} ({t.spaceFree})
                    </Text>
                  </TouchableOpacity>

                  {/* Schemes */}
                  <TouchableOpacity
                    onPress={() => setActiveTab('schemes')}
                    style={[styles.fourCard, styles.schemesCard]}
                    activeOpacity={0.8}
                  >
                    <View style={styles.cardTopRow}>
                      <Text style={styles.cardTopLabel}>{t.govSchemesCard}</Text>
                      <Landmark size={20} color="#D97706" />
                    </View>
                    <Text style={styles.cardMainBold}>{currentLocation.state[currentLang]}</Text>
                    <Text style={styles.cardSubHint}>Helpline 1800-180-1551</Text>
                  </TouchableOpacity>
                </View>

                {/* Login Strip (only shown when not logged in) */}
                {!isLoggedIn && (
                  <TouchableOpacity
                    onPress={() => handleOpenLogin('180-Day Forecast & Doctor Booking')}
                    style={styles.dashedLoginStrip}
                    activeOpacity={0.8}
                  >
                    <Lock size={15} color="#475569" />
                    <Text style={styles.loginStripText}>{t.loginForecastStrip}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* TAB 2: Educational Charts */}
            {activeTab === 'charts' && (
              <EducationalChartsView
                currentLang={currentLang}
                onOpenHelpline={handleOpenHelpline}
                currentLocation={currentLocation}
              />
            )}

            {/* TAB 3: Mandi Logistics */}
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
                  onSelectCrop={(key) => setSelectedCropKey(key)}
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
              />
            )}
          </ScrollView>
        </View>

        {/* Sticky Mobile-Only Bottom Navigation (Hidden on Web/Desktop to keep clean single sidebar) */}
        <div className="mobile-bottom-nav-wrap" data-testid="mobile-bottom-nav">
          <MobileBottomNav
            currentLang={currentLang}
            activeTab={activeTab}
            onSelectTab={setActiveTab}
          />
        </div>

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
  bodyLayout: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden' as any,
    minHeight: 0,
  },
  mainScrollView: {
    flex: 1,
    height: '100%' as any,
  },
  scrollContent: {
    paddingBottom: 88,
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
  eduBannerStrip: {
    backgroundColor: '#EBF5EA',
    borderWidth: 1.5,
    borderColor: '#C2E4BF',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  eduBannerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eduIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#2D5A27',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eduTextCol: {
    flex: 1,
    gap: 2,
  },
  eduBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E3F1A',
  },
  eduBannerDesc: {
    fontSize: 12,
    color: '#3B6836',
    lineHeight: 16,
  },
  eduArrowTag: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  eduArrowText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2D5A27',
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
    bottom: 74,
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
