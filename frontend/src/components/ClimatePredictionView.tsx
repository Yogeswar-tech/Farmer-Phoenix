import { useState, useEffect, type FC, type FormEvent } from 'react';
import type { Language, LocationOption } from '../types';
import { WEATHER_FORECAST, SEASONAL_CLIMATE, AGRICULTURAL_LOCATIONS, CROP_SUITABILITY_MAP } from '../data/mockData';
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
  Wind
} from 'lucide-react';

interface ClimatePredictionViewProps {
  currentLang: Language;
  isLoggedIn: boolean;
  onOpenLogin: (featureName: string) => void;
  currentLocation: LocationOption;
}

export const ClimatePredictionView: FC<ClimatePredictionViewProps> = ({
  currentLang,
  isLoggedIn,
  onOpenLogin,
  currentLocation
}) => {
  const t = translations[currentLang];
  const [searchInput, setSearchInput] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<LocationOption>(currentLocation);
  const [customAreaName, setCustomAreaName] = useState<string | null>(null);
  const [weatherData, setWeatherData] = useState<any[]>(WEATHER_FORECAST);
  const [unifiedData, setUnifiedData] = useState<any | null>(null);
  const [isLiveSynced, setIsLiveSynced] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // If user's global location changes, sync default
  useEffect(() => {
    setSelectedLocation(currentLocation);
    setCustomAreaName(null);
    setSearchInput('');
  }, [currentLocation.id]);

  // Single unified call to backend for Weather + Spray Advisories + Alerts + Crop Suitability
  useEffect(() => {
    let isMounted = true;
    const loadUnifiedClimate = async () => {
      setIsLoading(true);
      try {
        const districtName = selectedLocation.district?.en || selectedLocation.name.en;
        const res = await KisanSethuApi.getClimatePrediction(
          selectedLocation.id,
          districtName,
          selectedLocation.lat,
          selectedLocation.lng,
          currentLang
        );

        if (isMounted && res && res.status === 'success') {
          setUnifiedData(res);
          if (res.forecast_7days && res.forecast_7days.length > 0) {
            setWeatherData(res.forecast_7days);
          }
          setIsLiveSynced(true);
        }
      } catch (err) {
        console.warn('Unified climate fetch error:', err);
        if (isMounted) setIsLiveSynced(false);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadUnifiedClimate();
    return () => { isMounted = false; };
  }, [selectedLocation.id, selectedLocation.lat, selectedLocation.lng, currentLang]);

  const isViewingUserLocation = !customAreaName && selectedLocation.id === currentLocation.id;

  const handleAreaSearch = (e: FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;

    const matched = AGRICULTURAL_LOCATIONS.find((loc) => {
      const q = searchInput.toLowerCase().trim();
      return (
        loc.name[currentLang]?.toLowerCase().includes(q) ||
        loc.name.en.toLowerCase().includes(q) ||
        loc.district[currentLang]?.toLowerCase().includes(q) ||
        loc.district.en.toLowerCase().includes(q) ||
        loc.state[currentLang]?.toLowerCase().includes(q) ||
        loc.pincode.includes(q)
      );
    });

    if (matched) {
      setSelectedLocation(matched);
      setCustomAreaName(null);
    } else {
      setCustomAreaName(searchInput.trim());
    }
  };

  const handleQuickLocationClick = (loc: LocationOption) => {
    setSelectedLocation(loc);
    setCustomAreaName(null);
    setSearchInput(loc.name[currentLang]);
  };

  const handleResetToUserLocation = () => {
    setSelectedLocation(currentLocation);
    setCustomAreaName(null);
    setSearchInput('');
  };

  const activeArea = selectedLocation;
  const displayAreaName = customAreaName || activeArea.name[currentLang];
  const displayStateName = activeArea.state[currentLang];
  const displayPincode = activeArea.pincode;

  // Unified Data extraction with seamless fallbacks
  const currentConditions = unifiedData?.current_conditions;
  const activeAlert = unifiedData?.risk_alert;
  const activeCrops = unifiedData?.crop_suitability || CROP_SUITABILITY_MAP[activeArea.id] || CROP_SUITABILITY_MAP['default'];
  const activeSeasonal = unifiedData?.seasonal_outlook || SEASONAL_CLIMATE;
  const activeZone = unifiedData?.location?.agroClimaticZone || `${displayAreaName} Agri Climate Zone`;

  return (
    <div className="climate-prediction-view-container">
      {/* Header Title */}
      <div className="view-header-strip">
        <div className="title-row">
          <CloudSun size={24} className="view-icon" />
          <h2 className="view-title">{t.climateTitle}</h2>
          {isLiveSynced && (
            <span className="unified-engine-pill">
              ⚡ {currentLang === 'hi' ? 'गूगल एवं उपग्रह लाइव सक्रिय' : currentLang === 'te' ? 'గూగుల్ & శాటిలైట్ లైవ్' : 'Google & Satellite Engine Live'}
            </span>
          )}
        </div>
        <p className="view-desc">
          {currentLang === 'hi'
            ? 'गूगल क्लाइमेट एवं उपग्रह मॉडल द्वारा 7-दिवसीय दैनिक मौसम, स्प्रे खिड़की एवं फसल अनुकूलता'
            : currentLang === 'te'
              ? 'గూగుల్ & ఉపగ్రహ డేటా ఆధారంగా 7 రోజుల వాతావరణం, స్ప్రే కిటికీ మరియు పంట అనుకూలత'
              : 'Google Climate & Satellite Unified 7-Day Operational Weather, Spray Decisions, and Crop Suitability'}
        </p>
      </div>

      {/* Area Search Bar */}
      <div className="climate-search-section">
        <form onSubmit={handleAreaSearch} className="climate-search-bar-wrap">
          <MapPin size={18} className="climate-search-icon" />
          <input
            type="text"
            placeholder={t.climateSearchPlaceholder}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="climate-search-input"
          />
          <button type="submit" className="climate-search-submit-btn" disabled={isLoading}>
            <Search size={14} />
            <span>{isLoading ? '...' : t.climateSearchBtn}</span>
          </button>
        </form>

        {/* Farmer Town Shortcuts */}
        <div className="quick-locations-pills">
          <span className="pills-label">
            {currentLang === 'hi' ? 'कस्बा / क्षेत्र चुनें:' : currentLang === 'te' ? 'ప్రాంతం / గ్రామం:' : 'Select Town / Region:'}
          </span>
          {AGRICULTURAL_LOCATIONS.map((loc) => {
            const isCurrent = loc.id === activeArea.id;
            return (
              <button
                key={loc.id}
                type="button"
                onClick={() => handleQuickLocationClick(loc)}
                className={`quick-loc-pill ${isCurrent ? 'active' : ''}`}
              >
                📍 {loc.name[currentLang]}
              </button>
            );
          })}
        </div>

        {/* Active Searched Area Banner */}
        <div className="active-climate-area-banner">
          <div className="active-area-info">
            <span className="active-area-radar-icon">
              <Radio size={16} />
            </span>
            <div>
              <strong className="area-heading">
                📍 {displayAreaName}, {displayStateName} ({displayPincode})
              </strong>
              <div className="area-status-subrow">
                <span className="area-radar-sync">{t.satelliteRadarSync}</span>
                {isViewingUserLocation ? (
                  <span className="user-loc-tag">
                    {currentLang === 'hi' ? '● आपका मुख्य स्थान' : currentLang === 'te' ? '● మీ ప్రస్తుత స్థానం' : '● Your Main Location'}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResetToUserLocation}
                    className="reset-user-loc-btn"
                  >
                    ↩ {currentLang === 'hi' ? 'मेरे स्थान का मौसम देखें' : currentLang === 'te' ? 'నా ప్రాంతం వాతావరణం' : 'View My Location Weather'}
                  </button>
                )}
              </div>
            </div>
          </div>
          <span className="forecast-active-badge">
            {currentLang === 'hi' ? '● लाइव पूर्वानुमान सक्रिय' : currentLang === 'te' ? '● లైవ్ అంచనా సిద్ధం' : '● Live Forecast Active'}
          </span>
        </div>

        {/* Live Microclimate Telemetry Strip */}
        {currentConditions && (
          <div className="microclimate-metrics-strip">
            <div className="m-metric-pill">
              <Sun size={14} className="sun-icon" />
              <span>{currentConditions.temperatureC}°C</span>
            </div>
            <div className="m-metric-pill">
              <Droplets size={14} style={{ color: '#0284C7' }} />
              <span>{currentConditions.humidityPct}% {currentLang === 'hi' ? 'नमी' : currentLang === 'te' ? 'తేమ' : 'Humidity'}</span>
            </div>
            <div className="m-metric-pill">
              <Wind size={14} style={{ color: '#059669' }} />
              <span>{currentConditions.windSpeedKmh} km/h {currentLang === 'hi' ? 'हवा' : currentLang === 'te' ? 'గాలి' : 'Wind'}</span>
            </div>
            <div className={`m-metric-pill ${currentConditions.windSpeedKmh < 15 ? 'spray-safe' : 'spray-caution'}`}>
              <ShieldCheck size={14} />
              <span>{currentConditions.sprayWindowToday}</span>
            </div>
            <div className="m-metric-pill">
              <span>☀️ {currentConditions.dryingWindowToday}</span>
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Rain & Squall Risk Banner */}
      {activeAlert ? (
        <div className={`rain-risk-banner ${activeAlert.hasAlert ? (activeAlert.riskLevel === 'danger' ? 'risk-danger' : 'risk-warning') : 'risk-safe'}`}>
          <AlertTriangle size={20} className="banner-alert-icon" />
          <div className="banner-text">
            <strong>{activeAlert.title[currentLang] || activeAlert.title.en} ({displayAreaName}):</strong>
            <span> {activeAlert.description[currentLang] || activeAlert.description.en}</span>
          </div>
        </div>
      ) : (
        <div className="rain-risk-banner">
          <AlertTriangle size={20} className="banner-alert-icon" />
          <div className="banner-text">
            <strong>{t.thursdayRainAlertTitle} ({displayAreaName}):</strong>
            <span> {t.thursdayRainAlertDesc}</span>
          </div>
        </div>
      )}

      {/* Crop Suitability Advisory: Can We Grow Crops in this Climate? */}
      <div className="crop-suitability-section">
        <div className="suitability-header-row">
          <div className="suitability-title-wrap">
            <Sprout size={20} className="suitability-icon" />
            <div>
              <h3 className="suitability-title">{t.cropSuitabilityTitle}</h3>
              <p className="suitability-sub">
                {displayAreaName}: {t.cropSuitabilityDesc}
              </p>
            </div>
          </div>
          <span className="suitability-badge-zone">
            🌱 {activeZone}
          </span>
        </div>

        <div className="suitability-cards-grid">
          {activeCrops.map((crop: any, idx: number) => {
            const isHigh = crop.suitabilityStatus === 'highly-recommended';
            const cropTitle = crop.cropName[currentLang] || crop.cropName.en;
            const cropReason = crop.reason[currentLang] || crop.reason.en;
            const cropSeason = crop.season[currentLang] || crop.season.en;

            return (
              <div key={idx} className={`suitability-card ${crop.suitabilityStatus}`}>
                <div className="s-card-top">
                  <div className="s-card-crop">
                    <span className="s-crop-icon">🌿</span>
                    <strong className="s-crop-name">{cropTitle}</strong>
                  </div>
                  <span className={`s-status-tag ${crop.suitabilityStatus}`}>
                    {isHigh ? (
                      <>
                        <CheckCircle2 size={13} />
                        {currentLang === 'hi' ? 'अत्यधिक उपयुक्त' : currentLang === 'te' ? 'అత్యంత అనుకూలం' : 'Highly Suitable'}
                        {crop.suitabilityScore ? ` • ${crop.suitabilityScore}%` : ''}
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={13} />
                        {currentLang === 'hi' ? 'अनुकूल' : currentLang === 'te' ? 'అనుకూలం' : 'Favorable'}
                        {crop.suitabilityScore ? ` • ${crop.suitabilityScore}%` : ''}
                      </>
                    )}
                  </span>
                </div>
                <p className="s-reason-text">{cropReason}</p>
                <div className="s-season-footer">
                  <span className="s-season-label">
                    {currentLang === 'hi' ? 'उत्तम बुवाई काल:' : currentLang === 'te' ? 'విత్తన కాలం:' : 'Sowing Window:'}
                  </span>
                  <span className="s-season-val">{cropSeason}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 1: 7-Day Operational Weather */}
      <div className="climate-section">
        <div className="section-header-row">
          <h3 className="section-title">
            <span>{t.weatherForecastTitle} - {displayAreaName}</span>
          </h3>
          <span className="source-tag">
            📍 {displayAreaName} ({isLiveSynced ? '🟢 Live Google & Satellite Synced' : '🟢 Live IMD / Satellite'})
          </span>
        </div>

        <div className="weather-cards-grid">
          {weatherData.map((day: any, idx: number) => {
            const isDanger = day.riskLevel === 'danger';
            const isWarning = day.riskLevel === 'warning';
            const dayName = typeof day.dayName === 'object' ? (day.dayName[currentLang] || day.dayName.en) : day.dayName;
            const conditionText = typeof day.conditionText === 'object' ? (day.conditionText[currentLang] || day.conditionText.en) : day.conditionText;
            const sprayAdvice = typeof day.sprayingAdvice === 'object' ? (day.sprayingAdvice[currentLang] || day.sprayingAdvice.en) : day.sprayingAdvice;
            const dryingWin = typeof day.dryingWindow === 'object' ? (day.dryingWindow[currentLang] || day.dryingWindow.en) : day.dryingWindow;

            return (
              <div
                key={day.date || idx}
                className={`weather-day-card ${isDanger ? 'risk-danger' : isWarning ? 'risk-warning' : 'risk-safe'}`}
              >
                <div className="day-header">
                  <span className="day-name">{dayName}</span>
                  <span className="day-date">{day.date}</span>
                </div>

                <div className="day-icon-row">
                  {day.condition === 'sunny' && <Sun size={30} className="sun-icon" />}
                  {day.condition === 'cloudy' && <Cloud size={30} className="cloud-icon" />}
                  {day.condition === 'rain' && <CloudRain size={30} className="rain-icon" />}
                  <div className="temp-block">
                    <span className="temp-max">{day.tempMax}°C</span>
                    <span className="temp-min">/{day.tempMin}°C</span>
                  </div>
                </div>

                <div className="condition-label">
                  <span>{conditionText}</span>
                  <span className="rain-chance">
                    💧 {day.rainChance}% {currentLang === 'hi' ? 'बारिश' : currentLang === 'te' ? 'వర్షం' : 'Rain'}
                  </span>
                </div>

                <div className="spraying-note">
                  <div className="note-status-row">
                    {isDanger ? (
                      <span className="status-chip danger">⛔ {currentLang === 'hi' ? 'छिड़काव बंद' : currentLang === 'te' ? 'స్ప్రే చేయవద్దు' : 'Spray Paused'}</span>
                    ) : isWarning ? (
                      <span className="status-chip warning">⚠️ {currentLang === 'hi' ? 'सावधानी' : currentLang === 'te' ? 'జాగ్రత్త' : 'Caution'}</span>
                    ) : (
                      <span className="status-chip safe">
                        <ShieldCheck size={12} /> {currentLang === 'hi' ? 'सुरक्षित' : currentLang === 'te' ? 'సురక్షితం' : 'Safe to Spray'}
                      </span>
                    )}
                  </div>
                  <p className="advice-snippet">{sprayAdvice}</p>
                </div>

                {dryingWin && (
                  <div className="drying-snippet">
                    <span>☀️ {dryingWin}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Long-Range Seasonal Climate Outlook */}
      <div className="climate-section">
        <div className="section-header-row">
          <h3 className="section-title">
            <Calendar size={18} />
            <span>
              {currentLang === 'hi'
                ? `मौसमीय जलवायु आउटलुक (Seasonal Climate Outlook) - ${displayAreaName}`
                : currentLang === 'te'
                  ? `శీతోష్ణస్థితి అంచనా (Seasonal Outlook) - ${displayAreaName}`
                  : `Seasonal Climate Outlook - ${displayAreaName}`}
            </span>
          </h3>
        </div>

        <div className="seasonal-grid">
          {activeSeasonal.map((item: any, idx: number) => {
            const monthTitle = typeof item.month === 'object' ? (item.month[currentLang] || item.month.en) : item.month;
            const rainDesc = typeof item.expectedRainfall === 'object'
              ? (item.expectedRainfall[currentLang] || item.expectedRainfall.en)
              : (item.rainExpectation ? item.rainExpectation[currentLang] : item.expectedRainfall);
            const impactDesc = typeof item.description === 'object'
              ? (item.description[currentLang] || item.description.en)
              : (item.farmingImpact ? item.farmingImpact[currentLang] : '');

            return (
              <div key={idx} className="seasonal-card">
                <div className="seasonal-card-header">
                  <span className="month-badge">{monthTitle}</span>
                  <span className="favorable-badge">
                    <ShieldCheck size={12} />
                    {currentLang === 'hi' ? 'कृषि अनुकूल' : currentLang === 'te' ? 'అనుకూలం' : 'Favorable'}
                  </span>
                </div>
                <div className="seasonal-metric-row">
                  <span className="metric-label">
                    {currentLang === 'hi' ? 'वर्षा की संभावना:' : currentLang === 'te' ? 'వర్షపాతం:' : 'Rainfall Outlook:'}
                  </span>
                  <strong className="metric-val">{rainDesc}</strong>
                </div>
                {item.temperatureTrend && (
                  <div className="seasonal-metric-row">
                    <span className="metric-label">
                      {currentLang === 'hi' ? 'तापमान का रुख:' : currentLang === 'te' ? 'ఉష్ణోగ్రత:' : 'Temp Range:'}
                    </span>
                    <span className="metric-val">{item.temperatureTrend[currentLang]}</span>
                  </div>
                )}
                <div className="seasonal-impact-box">
                  <span className="impact-lbl">
                    {currentLang === 'hi' ? 'खेती पर प्रभाव:' : currentLang === 'te' ? 'పంటలపై ప్రభావం:' : 'Field Impact:'}
                  </span>
                  <p className="impact-text">{impactDesc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Village Radar Login Gate */}
      {!isLoggedIn && (
        <div className="climate-lock-banner">
          <div className="lock-text">
            <Lock size={20} />
            <span>
              {currentLang === 'hi'
                ? 'अपने गांव के 1 किमी दायरे का सटीक मौसम रडार एवं उपग्रह मानचित्र अनलॉक करने हेतु लॉगिन करें।'
                : currentLang === 'te'
                  ? 'మీ గ్రామానికి సంబంధించిన 1 కి.మీ ఖచ్చితమైన వాతావరణ రాడార్ కోసం లాగిన్ అవ్వండి.'
                  : 'Log in to unlock hyper-local 1km satellite microclimate radar for your specific village.'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onOpenLogin('Village Climate Radar')}
            className="climate-unlock-btn"
          >
            {t.loginBtn}
          </button>
        </div>
      )}
    </div>
  );
};
