import { useState } from 'react';
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
import { PriceAlertModal } from './components/PriceAlertModal';
import { LoginModal } from './components/LoginModal';
import { LocationModal } from './components/LocationModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { MobileMockupView } from './components/MobileMockupView';
import {
  Stethoscope,
  Landmark,
  TrendingUp,
  CloudRain,
  Warehouse,
  Lock,
  Columns,
  Monitor,
  Smartphone
} from 'lucide-react';

export function App() {
  const [currentLang, setCurrentLang] = useState<Language>('hi');
  const [currentLocation, setCurrentLocation] = useState<LocationOption>(AGRICULTURAL_LOCATIONS[0]);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [selectedCropKey, setSelectedCropKey] = useState<string>('chilli');
  const [activeTab, setActiveTab] = useState<NavigationTab>('home');
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile' | 'dual'>('dual');
  const [searchQuery, setSearchQuery] = useState('');

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

  // Main Web Browser UI content
  const renderWebBrowserContent = () => (
    <div className="web-browser-container-frame">
      <Header
        currentLang={currentLang}
        onLanguageChange={setCurrentLang}
        isMobileSimulator={viewMode === 'mobile'}
        onToggleSimulator={() => setViewMode(viewMode === 'mobile' ? 'desktop' : 'mobile')}
        onOpenLogin={() => handleOpenLogin()}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSelectCrop={(key) => setSelectedCropKey(key)}
        isLoggedIn={isLoggedIn}
        userName={userName}
        currentLocation={currentLocation}
        onOpenLocationModal={() => setIsLocationModalOpen(true)}
      />

      <GovtLagNotice currentLang={currentLang} />

      {/* Main Framework Layout: Desktop Left Sidebar + Dedicated Main Content */}
      <div className="app-body-layout">
        {/* Desktop Left Sidebar */}
        <DesktopSidebar
          currentLang={currentLang}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onOpenHelpline={handleOpenHelpline}
        />

        {/* Dedicated Screen View */}
        <main className="main-content-display">
          {/* Tab 1: Clean Executive Home Dashboard Matching Reference Mockup */}
          {activeTab === 'home' && (
            <div className="home-dashboard-layout">
              {/* Farmer Greeting from Mockup */}
              <div className="home-farmer-greeting-strip">
                <h2 className="home-farmer-name">
                  {userName || (currentLang === 'hi' ? 'नमस्ते, रमेश' : currentLang === 'te' ? 'నమస్తే, రమేష్' : 'Namaste, Ramesh')}
                </h2>
              </div>

              {/* Primary Hero Mandi Summary Card */}
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

              {/* 4 Clean Rounded Cards (2x2 Grid Matching Mockup Image Exactly) */}
              <div className="home-mockup-four-cards-grid">
                {/* Card 1: 7-day weather */}
                <div
                  className="mockup-four-card weather-card"
                  onClick={() => setActiveTab('climate')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="card-top-row">
                    <span className="card-top-label">{currentLang === 'hi' ? '7-दिवसीय मौसम' : currentLang === 'te' ? '7 రోజుల వాతావరణం' : '7-day weather'}</span>
                    <CloudRain size={22} className="card-top-icon rain" />
                  </div>
                  <div className="card-main-text">
                    <strong>Rain Thu 31°C</strong>
                    <span className="card-sub-hint"> (Delay spraying)</span>
                  </div>
                </div>

                {/* Card 2: Crop Doctor */}
                <div
                  className="mockup-four-card doctor-card"
                  onClick={() => setActiveTab('advisory')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="card-top-row">
                    <span className="card-top-label">{currentLang === 'hi' ? 'क्रॉप डॉक्टर' : currentLang === 'te' ? 'క్రాప్ డాక్టర్' : 'Crop Doctor'}</span>
                    <Stethoscope size={22} className="card-top-icon doctor" />
                  </div>
                  <div className="card-main-text">
                    <strong>{activeMandi.cropName[currentLang]}</strong>
                    <span className="card-sub-hint"> leaf curl check</span>
                  </div>
                </div>

                {/* Card 3: Nearest cold storage */}
                <div
                  className="mockup-four-card storage-card"
                  onClick={() => setActiveTab('storage')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="card-top-row">
                    <span className="card-top-label">{t.nearestColdStorageCard}</span>
                    <Warehouse size={22} className="card-top-icon storage" />
                  </div>
                  <div className="card-main-text">
                    <strong>12 km</strong>
                    <span className="card-sub-hint"> ({t.spaceFree})</span>
                  </div>
                </div>

                {/* Card 4: Gov Schemes */}
                <div
                  className="mockup-four-card schemes-card"
                  onClick={() => setActiveTab('schemes')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="card-top-row">
                    <span className="card-top-label">{t.govSchemesCard}</span>
                    <Landmark size={22} className="card-top-icon schemes" />
                  </div>
                  <div className="card-main-text">
                    <strong>{t.schemesQualify}</strong>
                    <span className="card-sub-hint"> (📞 Helpline 1800-180-1551 Call)</span>
                  </div>
                </div>
              </div>

              {/* Dashed Login Strip from Mockup Image */}
              <div
                className="mockup-dashed-login-strip"
                onClick={() => handleOpenLogin('180-Day Forecast & Doctor Booking')}
                role="button"
                tabIndex={0}
              >
                <Lock size={15} className="lock-icon" />
                <span>{t.loginForecastStrip}</span>
              </div>
            </div>
          )}

          {/* Tab 2: Mandi Logistics & ROI Calculator with Product Search */}
          {activeTab === 'logistics' && (
            <MandiLogisticsView
              currentLang={currentLang}
              mandi={activeMandi}
            />
          )}

          {/* Tab 3: Detailed Live Rates with Product Search & All Grades */}
          {activeTab === 'rates' && (
            <div className="detailed-rates-view">
              <div className="view-header-strip">
                <h2 className="view-title">
                  <TrendingUp size={22} />
                  <span>{t.tabRates} - {activeMandi.cropName[currentLang]}</span>
                </h2>
              </div>
              <MandiHeroCard
                currentLang={currentLang}
                mandi={activeMandi}
                isSummaryOnly={false}
                onOpenAlertModal={() => setIsAlertModalOpen(true)}
                onShareWhatsApp={handleShareWhatsApp}
                onOpenHelpline={handleOpenHelpline}
                onSelectCrop={(key) => setSelectedCropKey(key)}
              />
            </div>
          )}

          {/* Tab 4: Climate Prediction (Town Search & Crop Suitability Advisory) */}
          {activeTab === 'climate' && (
            <ClimatePredictionView
              currentLang={currentLang}
              isLoggedIn={isLoggedIn}
              onOpenLogin={handleOpenLogin}
              currentLocation={currentLocation}
              onSelectLocation={setCurrentLocation}
            />
          )}

          {/* Tab 5: AI Farm Advisory & Leaf Camera Diagnostic */}
          {activeTab === 'advisory' && (
            <CropDoctorView
              currentLang={currentLang}
              selectedCropKey={selectedCropKey}
              onOpenHelpline={handleOpenHelpline}
            />
          )}

          {/* Tab 6: Pesticides & Knapsack Pump Dosage Calculator */}
          {activeTab === 'pesticides' && (
            <PesticideDosageView
              currentLang={currentLang}
            />
          )}

          {/* Tab 7: Soil Doctor (Soil Health Card & NPK Analysis) */}
          {activeTab === 'soildoctor' && (
            <SoilDoctorView
              currentLang={currentLang}
              onOpenBookingGate={handleOpenLogin}
            />
          )}

          {/* Tab 8: Government Schemes & Credit */}
          {activeTab === 'schemes' && (
            <SchemesSection
              currentLang={currentLang}
              onOpenHelpline={handleOpenHelpline}
              onLockedFeatureClick={(feat) => handleOpenLogin(feat)}
            />
          )}

          {/* Tab 9: Cold Storage & Godown Finder Map */}
          {activeTab === 'storage' && (
            <ColdStorageMapView
              currentLang={currentLang}
              onOpenHelpline={handleOpenHelpline}
              onOpenBookingGate={handleOpenLogin}
            />
          )}
        </main>
      </div>

      {/* Mobile Sticky Bottom Navigation */}
      <MobileBottomNav
        currentLang={currentLang}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />
    </div>
  );

  return (
    <div className="app-viewport-wrapper">
      {/* Top View Mode Switcher Ribbon */}
      <div className="view-mode-selector-strip">
        <div className="view-mode-tabs">
          <button
            type="button"
            onClick={() => setViewMode('dual')}
            className={`mode-btn ${viewMode === 'dual' ? 'active' : ''}`}
          >
            <Columns size={15} />
            <span>Dual View (Browser + Mobile Mockup)</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('desktop')}
            className={`mode-btn ${viewMode === 'desktop' ? 'active' : ''}`}
          >
            <Monitor size={15} />
            <span>Web Browser View</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('mobile')}
            className={`mode-btn ${viewMode === 'mobile' ? 'active' : ''}`}
          >
            <Smartphone size={15} />
            <span>Mobile App View</span>
          </button>
        </div>
      </div>

      {/* Mode 1: Dual Side-by-Side View Matching media_1791810867282.jpg */}
      {viewMode === 'dual' && (
        <div className="dual-side-by-side-layout">
          <div className="dual-pane-left">
            <div className="pane-title-tag">Web Browser</div>
            {renderWebBrowserContent()}
          </div>
          <div className="dual-pane-right">
            <div className="pane-title-tag">Mobile App</div>
            <div className="simulator-phone-frame mockup-fit">
              <div className="phone-notch" />
              <div className="phone-screen-content">
                <MobileMockupView
                  currentLang={currentLang}
                  activeMandi={activeMandi}
                  selectedCropKey={selectedCropKey}
                  onSelectCrop={(k) => setSelectedCropKey(k)}
                  onViewAllRates={() => setActiveTab('rates')}
                  onShareWhatsApp={handleShareWhatsApp}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mode 2: Full Desktop Web Browser */}
      {viewMode === 'desktop' && renderWebBrowserContent()}

      {/* Mode 3: Standalone Mobile Simulator */}
      {viewMode === 'mobile' && (
        <div className="simulator-active-backdrop">
          <div className="simulator-phone-frame standalone">
            <div className="phone-notch" />
            <div className="phone-screen-content">
              <MobileMockupView
                currentLang={currentLang}
                activeMandi={activeMandi}
                selectedCropKey={selectedCropKey}
                onSelectCrop={(k) => setSelectedCropKey(k)}
                onViewAllRates={() => setActiveTab('rates')}
                onShareWhatsApp={handleShareWhatsApp}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
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
    </div>
  );
}

export default App;
