import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView
} from 'react-native';
import type { Language, MandiItem, NavigationTab, LocationOption } from './types';
import { MANDI_DATABASE, AGRICULTURAL_LOCATIONS } from './data/mockData';
import { translations } from './data/i18n';
import { Header } from './components/Header';
import { GovtLagNotice } from './components/GovtLagNotice';
import { DesktopSidebar } from './components/DesktopSidebar';
import { MandiHeroCard } from './components/MandiHeroCard';
import { MandiLogisticsView } from './components/MandiLogisticsView';
import { ClimatePredictionView } from './components/ClimatePredictionView';
import { CropDoctorView } from './components/CropDoctorView';
import { PesticideDosageView } from './components/PesticideDosageView';
import { SoilDoctorView } from './components/SoilDoctorView';
import { SchemesSection } from './components/SchemesSection';
import { ColdStorageMapView } from './components/ColdStorageMapView';
import { EducationalChartsView } from './components/EducationalChartsView';
import { AiVoiceAssistantModal } from './components/AiVoiceAssistantModal';
import { PriceAlertModal } from './components/PriceAlertModal';
import { LoginModal } from './components/LoginModal';
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
  Mic,
  Bot
} from 'lucide-react';

export function App() {
  const [currentLang, setCurrentLang] = useState<Language>('hi');
  const [currentLocation, setCurrentLocation] = useState<LocationOption>(AGRICULTURAL_LOCATIONS[0]);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [selectedCropKey, setSelectedCropKey] = useState<string>('chilli');
  const [activeTab, setActiveTab] = useState<NavigationTab>('home');
  const [searchQuery, setSearchQuery] = useState('');

  // AI Voice Assistant State
  const [isAiModeEnabled, setIsAiModeEnabled] = useState(true);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Authentication State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState<string | undefined>(undefined);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [lockedFeatureName, setLockedFeatureName] = useState<string | undefined>(undefined);

  // Price Alert Modal State
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);

  const t = translations[currentLang];

  // Active Mandi item based on selected crop or search query
  const activeMandi: MandiItem =
    MANDI_DATABASE.find(
      (m) =>
        m.cropKey === selectedCropKey ||
        m.cropName[currentLang].toLowerCase().includes(searchQuery.toLowerCase())
    ) || MANDI_DATABASE[0];

  const handleOpenLogin = (feature?: string) => {
    setLockedFeatureName(feature);
    setIsLoginModalOpen(true);
  };

  const handleLoginSuccess = (name: string) => {
    setIsLoggedIn(true);
    setUserName(name);
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
          onLanguageChange={setCurrentLang}
          isAiModeEnabled={isAiModeEnabled}
          onToggleAiMode={setIsAiModeEnabled}
          onOpenAiAssistant={() => setIsAiModalOpen(true)}
          onOpenLogin={() => handleOpenLogin()}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelectCrop={(key) => setSelectedCropKey(key)}
          isLoggedIn={isLoggedIn}
          userName={userName}
          currentLocation={currentLocation}
          onOpenLocationModal={() => setIsLocationModalOpen(true)}
        />

        {/* Server Data Sync Notice */}
        <GovtLagNotice currentLang={currentLang} />

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
                      📍 {currentLocation.name[currentLang]} ({currentLocation.district[currentLang]})
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
                    <Text style={styles.cardMainBold}>Rain Thu 31°C</Text>
                    <Text style={styles.cardSubHint}>(Delay spraying)</Text>
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
                    <Text style={styles.cardSubHint}>leaf curl check</Text>
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
                    <Text style={styles.cardMainBold}>12 km</Text>
                    <Text style={styles.cardSubHint}>({t.spaceFree})</Text>
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
                    <Text style={styles.cardMainBold}>{t.schemesQualify}</Text>
                    <Text style={styles.cardSubHint}>Helpline 1800-180-1551</Text>
                  </TouchableOpacity>
                </View>

                {/* Login Strip */}
                <TouchableOpacity
                  onPress={() => handleOpenLogin('180-Day Forecast & Doctor Booking')}
                  style={styles.dashedLoginStrip}
                  activeOpacity={0.8}
                >
                  <Lock size={15} color="#475569" />
                  <Text style={styles.loginStripText}>{t.loginForecastStrip}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* TAB 2: Educational Charts */}
            {activeTab === 'charts' && (
              <EducationalChartsView
                currentLang={currentLang}
                onOpenHelpline={handleOpenHelpline}
              />
            )}

            {/* TAB 3: Mandi Logistics */}
            {activeTab === 'logistics' && (
              <MandiLogisticsView
                currentLang={currentLang}
                mandi={activeMandi}
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
                onSelectLocation={setCurrentLocation}
              />
            )}

            {/* TAB 6: Farm Advisory */}
            {activeTab === 'advisory' && (
              <CropDoctorView
                currentLang={currentLang}
                selectedCropKey={selectedCropKey}
                onOpenHelpline={handleOpenHelpline}
              />
            )}

            {/* TAB 7: Pesticides */}
            {activeTab === 'pesticides' && (
              <PesticideDosageView
                currentLang={currentLang}
              />
            )}

            {/* TAB 8: Soil Doctor */}
            {activeTab === 'soildoctor' && (
              <SoilDoctorView
                currentLang={currentLang}
                onOpenBookingGate={handleOpenLogin}
              />
            )}

            {/* TAB 9: Government Schemes */}
            {activeTab === 'schemes' && (
              <SchemesSection
                currentLang={currentLang}
                onOpenHelpline={handleOpenHelpline}
                onLockedFeatureClick={(feat) => handleOpenLogin(feat)}
              />
            )}

            {/* TAB 10: Cold Storage */}
            {activeTab === 'storage' && (
              <ColdStorageMapView
                currentLang={currentLang}
                onOpenHelpline={handleOpenHelpline}
                onOpenBookingGate={handleOpenLogin}
              />
            )}
          </ScrollView>
        </View>

        {/* Sticky Mobile Bottom Navigation */}
        <MobileBottomNav
          currentLang={currentLang}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
        />

        {/* Floating AI Voice Assistant Button */}
        {isAiModeEnabled && (
          <TouchableOpacity
            onPress={() => setIsAiModalOpen(true)}
            style={styles.floatingFab}
            activeOpacity={0.8}
          >
            <Bot size={24} color="#FFFFFF" />
            <Text style={styles.fabText}>
              {currentLang === 'hi' ? 'बोलकर पूछें' : currentLang === 'te' ? 'మాట్లాడండి' : 'Ask AI'}
            </Text>
          </TouchableOpacity>
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
          onLoginSuccess={handleLoginSuccess}
          lockedFeatureName={lockedFeatureName}
        />

        <LocationModal
          isOpen={isLocationModalOpen}
          onClose={() => setIsLocationModalOpen(false)}
          currentLocation={currentLocation}
          onSelectLocation={setCurrentLocation}
          currentLang={currentLang}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  appContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    position: 'relative',
  },
  bodyLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  mainScrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
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
    backgroundColor: '#2D5A27',
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#2D5A27',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    borderWidth: 2,
    borderColor: '#A2DC9A',
    zIndex: 900,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});

export default App;
