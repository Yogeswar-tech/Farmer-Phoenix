import { useState, type FC } from 'react';
import './FarmerHomeDashboard.css';
import type { Language, MandiItem, LocationOption, NavigationTab } from '../types';
import {
  Camera,
  Mic,
  Volume2,
  VolumeX,
  Phone,
  Sun,
  AlertTriangle,
  Lock,
  ArrowRight,
  TrendingUp,
  CloudSun
} from 'lucide-react';

export interface FarmerHomeDashboardProps {
  currentLang: Language;
  userName?: string;
  currentLocation: LocationOption;
  activeMandi: MandiItem;
  liveWeatherRecord?: any;
  onNavigateTab: (tab: NavigationTab) => void;
  onOpenVoiceAssistant: () => void;
  onOpenCropDoctorUpload: () => void;
  onOpenLogin: (contextPrompt?: string) => void;
  onOpenHelpline: (phone: string) => void;
}

export const FarmerHomeDashboard: FC<FarmerHomeDashboardProps> = ({
  currentLang,
  userName,
  currentLocation,
  activeMandi,
  liveWeatherRecord,
  onNavigateTab,
  onOpenVoiceAssistant,
  onOpenCropDoctorUpload,
  onOpenLogin,
  onOpenHelpline
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);

  // Dynamic Crop Pricing data
  const cropTitle = activeMandi.cropName[currentLang] || activeMandi.cropName.en || 'Red Chilli';
  const varietyTitle = activeMandi.variety || 'Premium';
  const gradeA = activeMandi.grades?.find((g) => g.gradeCode === 'A') || activeMandi.grades?.[0];
  const modalItem = activeMandi.grades?.find((g) => g.gradeCode === 'MODAL') || gradeA;

  const minPriceQtl = gradeA?.minPrice || modalItem?.minPrice || 14910;
  const maxPriceQtl = gradeA?.maxPrice || modalItem?.maxPrice || 18816;

  // Dynamic Weather Data
  const tempMax = liveWeatherRecord?.temp_max_c ?? 33;
  const tempMin = liveWeatherRecord?.temp_min_c ?? 24;
  const sprayConditionText = liveWeatherRecord?.spray_status
    ? `SAFE TO SPRAY (${liveWeatherRecord.spray_status})`
    : 'SAFE TO SPRAY (Favorable conditions expected until 6:00 PM)';

  // Nearest Mandis String
  const nearbyMandisText = (activeMandi.otherNearbyMandis || [])
    .slice(0, 2)
    .map((om) => `${om.name[currentLang] || om.name.en}: ₹${om.modalPrice?.toLocaleString()}/qnt (${om.distance} km away)`)
    .join(' | ') || 'Warangal Mandi: ₹14,100/qnt (2.5 hrs away) | Kurnool Mandi: ₹13,800/qnt';

  // Audio Read Aloud
  const handleToggleAudio = () => {
    if (!('speechSynthesis' in window)) {
      alert('Text-to-speech not supported in this browser.');
      return;
    }

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    window.speechSynthesis.cancel();
    const locName = currentLocation.name[currentLang] || currentLocation.name.en;
    const speechText =
      currentLang === 'hi'
        ? `किसान सेतु में आपका स्वागत है। स्थान: ${locName} मुख्य यार्ड। आज का ${cropTitle} भाव: ₹${minPriceQtl.toLocaleString()} से ₹${maxPriceQtl.toLocaleString()} प्रति क्विंटल। बेचने का उत्तम समय। आज का तापमान ${tempMax} डिग्री सेल्सियस, शाम 6 बजे तक कीटनाशक छिड़काव के लिए सुरक्षित।`
        : currentLang === 'te'
        ? `కిసాన్ సేతుకు స్వాగతం. ప్రదేశం: ${locName} మార్కెట్ యార్డ్. నేటి ${cropTitle} ధర: రూ. ${minPriceQtl.toLocaleString()} నుండి రూ. ${maxPriceQtl.toLocaleString()} క్వింటాకు. అమ్మడానికి మంచి సమయం. వాతావరణం: ${tempMax} డిగ్రీలు, సాయంత్రం 6 వరకు స్ప్రే చేయడానికి అనుకూలం.`
        : `Welcome back to Kisan Sethu Agri Command Center. Location: ${locName} APMC Yard. Today's live price for ${cropTitle} is ${minPriceQtl.toLocaleString()} to ${maxPriceQtl.toLocaleString()} rupees per quintal. Advisory: Good time to sell. Daytime temperature is ${tempMax} degrees Celsius, conditions are safe to spray until 6:00 PM.`;

    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = currentLang === 'hi' ? 'hi-IN' : currentLang === 'te' ? 'te-IN' : 'en-US';
    utterance.rate = 0.95;

    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    setIsPlayingAudio(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="farmer-home-dashboard">
      {/* 1. Top Header Row */}
      <div className="fhd-top-header">
        <div className="fhd-title-block">
          <h1 className="fhd-greeting-title">
            {userName ? `Welcome, ${userName}` : 'Welcome, Farmer'}
          </h1>
          <div className="fhd-location-line">
            <span className="fhd-location-dot">●</span>
            <span>
              {currentLocation.name[currentLang] || currentLocation.name.en} APMC Yard,{' '}
              {currentLocation.state[currentLang] || currentLocation.state.en}
            </span>
          </div>
        </div>

        <div className="fhd-header-actions">
          <a
            href="tel:1800-123-1234"
            onClick={(e) => {
              e.preventDefault();
              onOpenHelpline('1800-123-1234');
            }}
            className="fhd-expert-call"
          >
            <Phone size={15} className="fhd-expert-icon" />
            <span>Call Mandi Expert: 1800-123-1234</span>
          </a>

          <button
            type="button"
            onClick={handleToggleAudio}
            className={`fhd-audio-btn ${isPlayingAudio ? 'playing' : ''}`}
          >
            {isPlayingAudio ? <VolumeX size={16} /> : <Volume2 size={16} />}
            <span>{isPlayingAudio ? 'Stop Audio' : 'Listen Audio Advisor'}</span>
          </button>
        </div>
      </div>

      {/* 2. Primary 2 Big Hero Action Cards */}
      <div className="fhd-hero-grid">
        {/* Left Hero Card: Crop Doctor */}
        <div
          className="fhd-card-doctor"
          onClick={() => {
            onNavigateTab('advisory');
          }}
          role="button"
          tabIndex={0}
        >
          <div className="fhd-card-header-row">
            <Camera size={26} color="#ffffff" />
            <h2 className="fhd-card-header-title">CROP DOCTOR</h2>
          </div>
          <p className="fhd-card-doctor-desc">
            Identify crop diseases, symptoms, and get verified CIBRC pesticide treatments.
          </p>
          <button
            type="button"
            className="fhd-doctor-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              onNavigateTab('advisory');
            }}
          >
            Open Crop Doctor
          </button>
        </div>

        {/* Right Hero Card: Voice Assistant */}
        <div
          className="fhd-card-voice"
          onClick={onOpenVoiceAssistant}
          role="button"
          tabIndex={0}
        >
          <div className="fhd-card-header-row">
            <Mic size={26} color="#1E3A8A" />
            <h2 className="fhd-card-header-title fhd-voice-title">VOICE ASSISTANT</h2>
          </div>
          <p className="fhd-card-voice-desc">
            Ask any farming or crop disease question via microphone. (Click to start)
          </p>
          <button
            type="button"
            className="fhd-voice-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpenVoiceAssistant();
            }}
          >
            Tap to Speak
          </button>
        </div>
      </div>

      {/* 3. Live Information Cards */}
      <div className="fhd-insights-grid">
        {/* Left Insight Card: Today's Live Price */}
        <div
          className="fhd-insight-card"
          onClick={() => onNavigateTab('rates')}
          role="button"
          tabIndex={0}
        >
          <div className="fhd-price-pill-tag">
            <TrendingUp size={13} />
            <span>Today's Live Price: {cropTitle} ({varietyTitle})</span>
          </div>

          <div className="fhd-price-big-num">
            ₹{minPriceQtl.toLocaleString()} - ₹{maxPriceQtl.toLocaleString()} <span className="fhd-price-unit">/ quintal</span>
          </div>

          <div className="fhd-status-pill-green">
            <span>✅ GOOD TIME TO SELL</span>
          </div>
        </div>

        {/* Right Insight Card: Weather Advisory */}
        <div
          className="fhd-insight-card"
          onClick={() => onNavigateTab('climate')}
          role="button"
          tabIndex={0}
        >
          <div className="fhd-weather-label-row">
            <CloudSun size={18} color="#2563EB" />
            <span>WEATHER ADVISORY</span>
          </div>

          <div className="fhd-weather-temp-row">
            <Sun size={28} className="fhd-sun-icon" />
            <span className="fhd-weather-temp-num">
              {tempMax}°C / {tempMin}°C
            </span>
          </div>

          <div className="fhd-status-pill-weather">
            <span>✅ {sprayConditionText}</span>
          </div>
        </div>
      </div>

      {/* 4. Notification & Summary Strips */}
      <div className="fhd-strips-container">
        {/* Amber Crop Warning Strip */}
        <div
          className="fhd-crop-warning-strip"
          onClick={() => onNavigateTab('advisory')}
          role="button"
          tabIndex={0}
        >
          <AlertTriangle size={18} className="fhd-warning-icon" />
          <span>
            <strong className="fhd-warning-strong">⚠️ Crop Warning:</strong> Tomatoes are at high risk for leaf spot due to rising humidity. (Tap Crop Doctor above for treatment.)
          </span>
        </div>

        {/* Nearest Markets Strip */}
        <div
          className="fhd-nearest-markets-strip"
          onClick={() => onNavigateTab('logistics')}
          role="button"
          tabIndex={0}
        >
          <div className="fhd-nearest-markets-left">
            <span>🚚</span>
            <span className="fhd-nearest-tag">NEAREST MARKETS:</span>
            <span>{nearbyMandisText}</span>
          </div>

          <span
            className="fhd-signin-lock-link"
            onClick={(e) => {
              e.stopPropagation();
              onOpenLogin('Localized Micro-Radar Updates');
            }}
          >
            <Lock size={12} />
            <span>Sign in to unlock localized Micro-Radar updates.</span>
          </span>
        </div>
      </div>
    </div>
  );
};
