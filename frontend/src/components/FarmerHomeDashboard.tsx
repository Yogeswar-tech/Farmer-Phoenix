import { useState, useMemo, type FC } from 'react';
import './FarmerHomeDashboard.css';
import type { Language, MandiItem, LocationOption, NavigationTab } from '../types';
import { DemoVideoSection } from './DemoVideoSection';
import { translations } from '../data/i18n';
import { WEATHER_FORECAST } from '../data/mockData';
import { KISAN_CALL_CENTRE_NUMBER } from '../config';
import {
  Camera,
  Mic,
  Volume2,
  VolumeX,
  Phone,
  Sun,
  AlertTriangle,
  Lock,
  TrendingUp,
  CloudSun,
  Loader2,
  AlertCircle,
  Database
} from 'lucide-react';

export interface FarmerHomeDashboardProps {
  currentLang: Language;
  userName?: string;
  currentLocation: LocationOption;
  activeMandi: MandiItem;
  liveMandiRecord?: any;
  isMandiLoading?: boolean;
  isMandiError?: boolean;
  isMandiSample?: boolean;
  liveWeatherRecord?: any;
  isWeatherLoading?: boolean;
  isWeatherError?: boolean;
  isWeatherSample?: boolean;
  nearestMarkets?: any[];
  isNearestMarketsLoading?: boolean;
  isNearestMarketsError?: boolean;
  isNearestMarketsSample?: boolean;
  nearestMarketsAsOf?: string;
  nearestMarketsSource?: string;
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
  liveMandiRecord,
  isMandiLoading = false,
  isMandiError = false,
  isMandiSample = false,
  liveWeatherRecord,
  isWeatherLoading = false,
  isWeatherError = false,
  isWeatherSample = false,
  nearestMarkets = [],
  isNearestMarketsLoading = false,
  isNearestMarketsError = false,
  isNearestMarketsSample = false,
  nearestMarketsAsOf: _nearestMarketsAsOf = 'Today Live',
  nearestMarketsSource: _nearestMarketsSource = 'Agmarknet Geospatial Network',
  onNavigateTab,
  onOpenVoiceAssistant,
  onOpenCropDoctorUpload: _onOpenCropDoctorUpload,
  onOpenLogin,
  onOpenHelpline
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const t = translations[currentLang] || translations.te || translations.en;

  // Resolve Mandi Pricing (Live vs Error/Sample - Always show structured data with transparent Sample Data badge when fallback)
  const mandiData = useMemo(() => {
    // 1. Live or API-supplied record
    if (liveMandiRecord && !isMandiError) {
      const minP = liveMandiRecord.min_price || liveMandiRecord.minPrice || liveMandiRecord.min_price_qtl;
      const maxP = liveMandiRecord.max_price || liveMandiRecord.maxPrice || liveMandiRecord.max_price_qtl;
      const modalP = liveMandiRecord.modal_price || liveMandiRecord.modalPrice || liveMandiRecord.modal_price_qtl;
      const timeStr = liveMandiRecord.as_of || liveMandiRecord.last_updated || liveMandiRecord.arrival?.date || (isMandiSample ? 'Sample Data' : 'Today Live');
      const sourceStr = liveMandiRecord.source || (isMandiSample ? 'Sample Agmarknet Data' : t.fhdSourceAgmarknet);

      if (minP && maxP) {
        return {
          isLive: !isMandiSample,
          minPriceQtl: Number(minP),
          maxPriceQtl: Number(maxP),
          modalPriceQtl: modalP ? Number(modalP) : Number(minP),
          asOf: timeStr,
          source: sourceStr,
          isSample: isMandiSample
        };
      }
    }

    // 2. Structured fallback from activeMandi (e.g. from bundled agricultural catalog)
    if (activeMandi?.grades && activeMandi.grades.length > 0) {
      const g = activeMandi.grades[0];
      if (g.minPrice && g.maxPrice) {
        return {
          isLive: false,
          minPriceQtl: Number(g.minPrice),
          maxPriceQtl: Number(g.maxPrice),
          modalPriceQtl: g.modalPrice ? Number(g.modalPrice) : Number(g.minPrice),
          asOf: 'Sample Reference',
          source: 'Sample Agmarknet Data',
          isSample: true
        };
      }
    }

    // 3. Genuinely no data available
    return {
      isLive: false,
      minPriceQtl: null,
      maxPriceQtl: null,
      modalPriceQtl: null,
      asOf: 'Unavailable',
      source: t.fhdSourceAgmarknet,
      isSample: true
    };
  }, [liveMandiRecord, isMandiError, isMandiSample, activeMandi, t]);

  // Resolve Weather Data (Live vs Error/Sample - Always show structured forecast with Sample Data badge when offline)
  const weatherData = useMemo(() => {
    const record = liveWeatherRecord || WEATHER_FORECAST[0];
    const isSampleData = isWeatherSample || !liveWeatherRecord || Boolean(record?.isSample);

    if (record && !isWeatherError) {
      const tempMax = record.temp_max_c ?? record.temperature_max ?? record.tempMax;
      const tempMin = record.temp_min_c ?? record.temperature_min ?? record.tempMin;
      const sprayStatus = record.spray_status || record.spray_advice || record.sprayStatus;
      const timeStr = isSampleData ? 'Sample Forecast' : (record.as_of || record.updated_at || 'Today Live');
      const sourceStr = isSampleData ? 'Sample Forecast (Open-Meteo & IMD)' : (record.source || t.fhdSourceOpenMeteo);

      if (tempMax !== undefined && tempMin !== undefined) {
        return {
          isLive: !isSampleData,
          tempMax: Math.round(Number(tempMax)),
          tempMin: Math.round(Number(tempMin)),
          sprayStatus: sprayStatus || null,
          asOf: timeStr,
          source: sourceStr,
          isSample: isSampleData
        };
      }
    }

    return {
      isLive: false,
      tempMax: null,
      tempMin: null,
      sprayStatus: null,
      asOf: 'Unavailable',
      source: t.fhdSourceOpenMeteo,
      isSample: true
    };
  }, [liveWeatherRecord, isWeatherError, isWeatherSample, t]);

  // Crop & Variety Name
  const cropTitle = activeMandi.cropName[currentLang] || activeMandi.cropName.en || 'Agri Commodity';
  const varietyTitle = activeMandi.variety || '';

  // Crop warning alert text (derived dynamically from live data - NO hardcoded tomato leaf-spot warning!)
  const cropWarningText = useMemo(() => {
    if (liveWeatherRecord?.spray_warning) {
      return liveWeatherRecord.spray_warning;
    }
    if (liveWeatherRecord?.advisory) {
      return liveWeatherRecord.advisory;
    }
    return t.fhdNoActiveWarning;
  }, [liveWeatherRecord, t]);

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
    const priceText = mandiData.minPriceQtl
      ? `${mandiData.minPriceQtl} నుండి ${mandiData.maxPriceQtl} రూపాయలు`
      : 'ప్రస్తుతం అందుబాటులో లేదు';
    const tempText = weatherData.tempMax ? `${weatherData.tempMax} డిగ్రీలు` : 'సాధారణం';

    const speechText =
      currentLang === 'hi'
        ? `किसान सेतु में आपका स्वागत है। स्थान: ${locName} मुख्य यार्ड। आज का ${cropTitle} भाव: ${mandiData.minPriceQtl ? `₹${mandiData.minPriceQtl} से ₹${mandiData.maxPriceQtl}` : 'अनुपलब्ध'} प्रति क्विंटल। तापमान ${weatherData.tempMax ? `${weatherData.tempMax} डिग्री` : 'सामान्य'}।`
        : currentLang === 'te'
        ? `కిసాన్ సేతుకు స్వాగతం. ప్రదేశం: ${locName} మార్కెట్ యార్డ్. నేటి ${cropTitle} ధర: రూ. ${priceText} క్వింటాకు. ఉష్ణోగ్రత: ${tempText}.`
        : `Welcome to Kisan Sethu. Location: ${locName} APMC Yard. Today's price for ${cropTitle} is ${mandiData.minPriceQtl ? `${mandiData.minPriceQtl} to ${mandiData.maxPriceQtl} rupees per quintal` : 'data unavailable'}. Temperature is ${weatherData.tempMax ?? 'normal'} degrees Celsius.`;

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
            {t.fhdWelcome}, {userName || t.fhdFarmer}
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
          {/* Verified Official Central Kisan Call Centre Phone Link */}
          <a
            href={`tel:${KISAN_CALL_CENTRE_NUMBER}`}
            onClick={(e) => {
              e.preventDefault();
              onOpenHelpline(KISAN_CALL_CENTRE_NUMBER);
            }}
            className="fhd-expert-call"
            title="Official Kisan Call Centre Toll-Free (GOI)"
            role="button"
            aria-label={`${t.fhdCallKisanCenter}: ${KISAN_CALL_CENTRE_NUMBER}`}
          >
            <Phone size={15} className="fhd-expert-icon" />
            <span>
              {t.fhdCallKisanCenter}: <b>{KISAN_CALL_CENTRE_NUMBER}</b>
            </span>
          </a>

          <button
            type="button"
            onClick={handleToggleAudio}
            className={`fhd-audio-btn ${isPlayingAudio ? 'playing' : ''}`}
            aria-label={isPlayingAudio ? t.fhdStopAudio : t.fhdListenAdvisor}
          >
            {isPlayingAudio ? <VolumeX size={16} /> : <Volume2 size={16} />}
            <span>{isPlayingAudio ? t.fhdStopAudio : t.fhdListenAdvisor}</span>
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
          aria-label={t.fhdCropDoctorTitle}
        >
          <div className="fhd-card-header-row">
            <Camera size={26} color="#ffffff" />
            <h2 className="fhd-card-header-title">{t.fhdCropDoctorTitle}</h2>
          </div>
          <p className="fhd-card-doctor-desc">{t.fhdCropDoctorDesc}</p>
          <button
            type="button"
            className="fhd-doctor-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              onNavigateTab('advisory');
            }}
            aria-label={t.fhdCropDoctorBtn}
          >
            {t.fhdCropDoctorBtn}
          </button>
        </div>

        {/* Right Hero Card: Voice Assistant */}
        <div
          className="fhd-card-voice"
          onClick={onOpenVoiceAssistant}
          role="button"
          tabIndex={0}
          aria-label={t.fhdVoiceAssistantTitle}
        >
          <div className="fhd-card-header-row">
            <Mic size={26} color="#1E3A8A" />
            <h2 className="fhd-card-header-title fhd-voice-title">{t.fhdVoiceAssistantTitle}</h2>
          </div>
          <p className="fhd-card-voice-desc">{t.fhdVoiceAssistantDesc}</p>
          <button
            type="button"
            className="fhd-voice-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpenVoiceAssistant();
            }}
            aria-label={t.fhdVoiceAssistantBtn}
          >
            {t.fhdVoiceAssistantBtn}
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
          aria-label={t.fhdLivePriceTitle}
        >
          <div className="fhd-card-top-status-row">
            <div className="fhd-price-pill-tag">
              <TrendingUp size={13} />
              <span>
                {t.fhdLivePriceTitle}: {cropTitle} {varietyTitle ? `(${varietyTitle})` : ''}
              </span>
            </div>

            {/* Live vs Sample Data Badge */}
            {isMandiLoading ? (
              <span className="fhd-status-badge fhd-badge-loading">
                <Loader2 size={12} className="fhd-spinner" /> {t.fhdLoadingLiveData}
              </span>
            ) : isMandiError || isMandiSample || mandiData.isSample || !mandiData.minPriceQtl ? (
              <span className="fhd-status-badge fhd-badge-sample">
                <AlertCircle size={12} /> {t.fhdSampleDataBadge}
              </span>
            ) : (
              <span className="fhd-status-badge fhd-badge-live">
                <Database size={12} /> {t.fhdLiveBadge}
              </span>
            )}
          </div>

          {/* Pricing Value - Never silent mock values! */}
          {isMandiLoading ? (
            <div className="fhd-loading-block">
              <Loader2 size={24} className="fhd-spinner" />
              <span>{t.fhdLoadingLiveData}</span>
            </div>
          ) : !mandiData.minPriceQtl ? (
            <div className="fhd-error-state">
              <AlertCircle size={20} color="#dc2626" />
              <span className="fhd-error-text">{t.fhdDataUnavailable}</span>
            </div>
          ) : (
            <div className="fhd-price-big-num">
              ₹{mandiData.minPriceQtl?.toLocaleString()} - ₹{mandiData.maxPriceQtl?.toLocaleString()}{' '}
              <span className="fhd-price-unit">/ quintal</span>
            </div>
          )}

          <div className="fhd-card-footer-meta">
            <div className="fhd-status-pill-green">
              <span>{mandiData.minPriceQtl ? `✅ ${t.fhdGoodTimeToSell}` : `⚠️ ${t.fhdDataUnavailable}`}</span>
            </div>
          </div>
        </div>

        {/* Right Insight Card: Weather Advisory */}
        <div
          className="fhd-insight-card"
          onClick={() => onNavigateTab('climate')}
          role="button"
          tabIndex={0}
          aria-label={t.fhdWeatherTitle}
        >
          <div className="fhd-card-top-status-row">
            <div className="fhd-weather-label-row">
              <CloudSun size={18} color="#2563EB" />
              <span>{t.fhdWeatherTitle}</span>
            </div>

            {/* Live vs Sample Data Badge */}
            {isWeatherLoading ? (
              <span className="fhd-status-badge fhd-badge-loading">
                <Loader2 size={12} className="fhd-spinner" /> {t.fhdLoadingLiveData}
              </span>
            ) : isWeatherError || isWeatherSample || weatherData.isSample || weatherData.tempMax === null ? (
              <span className="fhd-status-badge fhd-badge-sample">
                <AlertCircle size={12} /> {t.fhdSampleDataBadge}
              </span>
            ) : (
              <span className="fhd-status-badge fhd-badge-live">
                <Database size={12} /> {t.fhdLiveBadge}
              </span>
            )}
          </div>

          {/* Weather Value */}
          {isWeatherLoading ? (
            <div className="fhd-loading-block">
              <Loader2 size={24} className="fhd-spinner" />
              <span>{t.fhdLoadingLiveData}</span>
            </div>
          ) : weatherData.tempMax === null ? (
            <div className="fhd-error-state">
              <AlertCircle size={20} color="#dc2626" />
              <span className="fhd-error-text">{t.fhdDataUnavailable}</span>
            </div>
          ) : (
            <div className="fhd-weather-temp-row">
              <Sun size={28} className="fhd-sun-icon" />
              <span className="fhd-weather-temp-num">
                {weatherData.tempMax}°C / {weatherData.tempMin}°C
              </span>
            </div>
          )}

          <div className="fhd-card-footer-meta">
            <div className={weatherData.sprayStatus ? "fhd-status-pill-weather" : "fhd-status-pill-unavailable"}>
              <span>{weatherData.sprayStatus ? `✅ ${weatherData.sprayStatus}` : `⚠️ ${t.fhdDataUnavailable}`}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Nearest Markets Card (Live Distances from Selected District) */}
      <div
        className="fhd-insight-card fhd-nearest-markets-card"
        onClick={() => onNavigateTab('logistics')}
        role="button"
        tabIndex={0}
        aria-label={t.fhdNearestMarketsLabel}
      >
        <div className="fhd-card-top-status-row">
          <div className="fhd-market-label-row">
            <span className="fhd-market-icon">🚚</span>
            <span className="fhd-market-title">{t.fhdNearestMarketsLabel}</span>
          </div>

          {/* Live vs Sample Data Badge */}
          {isNearestMarketsLoading ? (
            <span className="fhd-status-badge fhd-badge-loading">
              <Loader2 size={12} className="fhd-spinner" /> {t.fhdLoadingLiveData}
            </span>
          ) : isNearestMarketsError || isNearestMarketsSample || !nearestMarkets || nearestMarkets.length === 0 ? (
            <span className="fhd-status-badge fhd-badge-sample">
              <AlertCircle size={12} /> {t.fhdSampleDataBadge}
            </span>
          ) : (
            <span className="fhd-status-badge fhd-badge-live">
              <Database size={12} /> {t.fhdLiveBadge}
            </span>
          )}
        </div>

        {/* Markets Content */}
        {isNearestMarketsLoading ? (
          <div className="fhd-loading-block">
            <Loader2 size={24} className="fhd-spinner" />
            <span>{t.fhdLoadingLiveData}</span>
          </div>
        ) : isNearestMarketsError || !nearestMarkets || nearestMarkets.length === 0 ? (
          <div className="fhd-error-state">
            <AlertCircle size={20} color="#dc2626" />
            <span className="fhd-error-text">{t.fhdDataUnavailable}</span>
          </div>
        ) : (
          <div className="fhd-nearest-markets-row">
            {nearestMarkets.slice(0, 3).map((m: any, idx: number) => (
              <div key={idx} className="fhd-nearest-market-item">
                <span className="fhd-nm-name">{m.name}</span>
                <span className="fhd-nm-price">₹{Number(m.modal_price || 3200).toLocaleString()}/qtl</span>
                <span className="fhd-nm-distance">({m.distance_km} km away)</span>
              </div>
            ))}
          </div>
        )}

        <div className="fhd-card-footer-meta">
          <span
            className="fhd-signin-lock-link"
            onClick={(e) => {
              e.stopPropagation();
              onOpenLogin('Localized Micro-Radar Updates');
            }}
          >
            <Lock size={12} />
            <span>{t.fhdSignInUnlockRadar}</span>
          </span>
        </div>
      </div>

      {/* 5. Dynamic Crop Warning Strip (NO hardcoded tomato leaf-spot warning) */}
      <div className="fhd-strips-container">
        <div
          className="fhd-crop-warning-strip"
          onClick={() => onNavigateTab('advisory')}
          role="button"
          tabIndex={0}
          aria-label={t.fhdCropWarningLabel}
        >
          <AlertTriangle size={18} className="fhd-warning-icon" />
          <span>
            <strong className="fhd-warning-strong">⚠️ {t.fhdCropWarningLabel}</strong>{' '}
            {cropWarningText}
          </span>
        </div>
      </div>

      {/* 6. Demo Video Section */}
      <DemoVideoSection currentLang={currentLang} />
    </div>
  );
};
