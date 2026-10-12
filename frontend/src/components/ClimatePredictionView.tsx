import { useState, type FC, type FormEvent } from 'react';
import type { Language, LocationOption } from '../types';
import { WEATHER_FORECAST, SEASONAL_CLIMATE, AGRICULTURAL_LOCATIONS, CROP_SUITABILITY_MAP } from '../data/mockData';
import { translations } from '../data/i18n';
import { CloudSun, Calendar, AlertTriangle, ShieldCheck, Lock, Sun, Cloud, CloudRain, Search, MapPin, Radio, Sprout, CheckCircle2 } from 'lucide-react';

interface ClimatePredictionViewProps {
  currentLang: Language;
  isLoggedIn: boolean;
  onOpenLogin: (featureName: string) => void;
  currentLocation: LocationOption;
  onSelectLocation?: (loc: LocationOption) => void;
}

export const ClimatePredictionView: FC<ClimatePredictionViewProps> = ({
  currentLang,
  isLoggedIn,
  onOpenLogin,
  currentLocation,
  onSelectLocation
}) => {
  const t = translations[currentLang];
  const [searchInput, setSearchInput] = useState('');
  const [searchedAreaName, setSearchedAreaName] = useState<string | null>(null);

  const activeArea = AGRICULTURAL_LOCATIONS.find(
    (loc) => loc.id === currentLocation.id
  ) || AGRICULTURAL_LOCATIONS[0];

  const handleAreaSearch = (e: FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;

    const matched = AGRICULTURAL_LOCATIONS.find((loc) => {
      const q = searchInput.toLowerCase();
      return (
        loc.name[currentLang].toLowerCase().includes(q) ||
        loc.name.en.toLowerCase().includes(q) ||
        loc.district[currentLang].toLowerCase().includes(q) ||
        loc.district.en.toLowerCase().includes(q) ||
        loc.state[currentLang].toLowerCase().includes(q) ||
        loc.pincode.includes(q)
      );
    });

    if (matched && onSelectLocation) {
      onSelectLocation(matched);
      setSearchedAreaName(matched.name[currentLang]);
    } else {
      // User entered custom village/taluk (e.g. Kadapa alias Krishna Nagar)
      setSearchedAreaName(searchInput.trim());
    }
  };

  const handleQuickLocationClick = (loc: LocationOption) => {
    if (onSelectLocation) {
      onSelectLocation(loc);
    }
    setSearchedAreaName(loc.name[currentLang]);
    setSearchInput(loc.name[currentLang]);
  };

  const displayAreaName = searchedAreaName || activeArea.name[currentLang];
  const displayStateName = activeArea.state[currentLang];
  const displayPincode = activeArea.pincode;

  // Crop suitability data for this specific town/location
  const suitabilityCrops = CROP_SUITABILITY_MAP[activeArea.id] || CROP_SUITABILITY_MAP['default'];

  return (
    <div className="climate-prediction-view-container">
      {/* Header Title */}
      <div className="view-header-strip">
        <div className="title-row">
          <CloudSun size={24} className="view-icon" />
          <h2 className="view-title">{t.climateTitle}</h2>
        </div>
        <p className="view-desc">
          {currentLang === 'hi'
            ? 'आईएमडी एवं उपग्रह मॉडल द्वारा 7-दिवसीय दैनिक मौसम एवं दीर्घकालिक मौसमीय जलवायु आउटलुक'
            : currentLang === 'te'
            ? 'ఐఎండి & ఉపగ్రహ డేటా ఆధారంగా 7 రోజుల వాతావరణం & దీర్ఘకాలిక శీతోష్ణస్థితి అంచనా'
            : 'IMD & Satellite Driven 7-Day Operational Weather and Long-Range Seasonal Climate Outlook'}
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
          <button type="submit" className="climate-search-submit-btn">
            <Search size={14} />
            <span>{t.climateSearchBtn}</span>
          </button>
        </form>

        {/* Farmer Town Shortcuts (Replaced 'Popular Mandis' with local town shortcuts) */}
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
              <span className="area-radar-sync">{t.satelliteRadarSync}</span>
            </div>
          </div>
          <span className="forecast-active-badge">
            {currentLang === 'hi' ? '● लाइव पूर्वानुमान सक्रिय' : currentLang === 'te' ? '● లైవ్ అంచనా సిద్ధం' : '● Live Forecast Active'}
          </span>
        </div>
      </div>

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
            🌱 {displayAreaName} {currentLang === 'hi' ? 'कृषि क्षेत्र' : currentLang === 'te' ? 'వ్యవసాయ జోన్' : 'Agri Climate Zone'}
          </span>
        </div>

        <div className="suitability-cards-grid">
          {suitabilityCrops.map((crop, idx) => {
            const isHigh = crop.suitabilityStatus === 'highly-recommended';
            return (
              <div key={idx} className={`suitability-card ${crop.suitabilityStatus}`}>
                <div className="s-card-top">
                  <div className="s-card-crop">
                    <span className="s-crop-icon">🌿</span>
                    <strong className="s-crop-name">{crop.cropName[currentLang]}</strong>
                  </div>
                  <span className={`s-status-tag ${crop.suitabilityStatus}`}>
                    {isHigh ? (
                      <>
                        <CheckCircle2 size={13} />
                        {currentLang === 'hi' ? 'अत्यधिक उपयुक्त' : currentLang === 'te' ? 'అత్యంత అనుకూలం' : 'Highly Suitable'}
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={13} />
                        {currentLang === 'hi' ? 'अनुकूल' : currentLang === 'te' ? 'అనుకూలం' : 'Favorable'}
                      </>
                    )}
                  </span>
                </div>
                <p className="s-reason-text">{crop.reason[currentLang]}</p>
                <div className="s-season-footer">
                  <span className="s-season-label">
                    {currentLang === 'hi' ? 'उत्तम बुवाई काल:' : currentLang === 'te' ? 'విత్తన కాలం:' : 'Sowing Window:'}
                  </span>
                  <span className="s-season-val">{crop.season[currentLang]}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Thursday Weather Risk Alert */}
      <div className="rain-risk-banner">
        <AlertTriangle size={20} className="banner-alert-icon" />
        <div className="banner-text">
          <strong>{t.thursdayRainAlertTitle}</strong>
          <span> {t.thursdayRainAlertDesc}</span>
        </div>
      </div>

      {/* Section 1: 7-Day Operational Weather */}
      <div className="climate-section">
        <div className="section-header-row">
          <h3 className="section-title">
            <span>{t.weatherForecastTitle} - {displayAreaName}</span>
          </h3>
          <span className="source-tag">📍 {displayAreaName} (IMD Sync)</span>
        </div>

        <div className="weather-cards-grid">
          {WEATHER_FORECAST.map((day) => {
            const isDanger = day.riskLevel === 'danger';
            const isWarning = day.riskLevel === 'warning';

            return (
              <div
                key={day.date}
                className={`weather-day-card ${isDanger ? 'risk-danger' : isWarning ? 'risk-warning' : 'risk-safe'}`}
              >
                <div className="day-header">
                  <span className="day-name">{day.dayName[currentLang]}</span>
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
                  <span>{day.conditionText[currentLang]}</span>
                  <span className="rain-chance">💧 {day.rainChance}% {currentLang === 'hi' ? 'बारिश' : currentLang === 'te' ? 'వర్షం' : 'Rain'}</span>
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
                  <p className="advice-snippet">{day.sprayingAdvice[currentLang]}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Long-Range Seasonal Climate Outlook (Nov, Dec, Jan) */}
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
          {SEASONAL_CLIMATE.map((item, idx) => (
            <div key={idx} className="seasonal-card">
              <div className="seasonal-card-header">
                <span className="month-badge">{item.month[currentLang]}</span>
                <span className="favorable-badge">
                  <ShieldCheck size={12} />
                  {currentLang === 'hi' ? 'कृषि अनुकूल' : currentLang === 'te' ? 'అనుకూలం' : 'Favorable'}
                </span>
              </div>
              <div className="seasonal-metric-row">
                <span className="metric-label">
                  {currentLang === 'hi' ? 'वर्षा की संभावना:' : currentLang === 'te' ? 'వర్షపాతం:' : 'Rainfall Outlook:'}
                </span>
                <strong className="metric-val">{item.rainExpectation[currentLang]}</strong>
              </div>
              <div className="seasonal-metric-row">
                <span className="metric-label">
                  {currentLang === 'hi' ? 'तापमान का रुख:' : currentLang === 'te' ? 'ఉష్ణోగ్రత:' : 'Temp Range:'}
                </span>
                <span className="metric-val">{item.temperatureTrend[currentLang]}</span>
              </div>
              <div className="seasonal-impact-box">
                <span className="impact-lbl">
                  {currentLang === 'hi' ? 'खेती पर प्रभाव:' : currentLang === 'te' ? 'పంటలపై ప్రభావం:' : 'Field Impact:'}
                </span>
                <p className="impact-text">{item.farmingImpact[currentLang]}</p>
              </div>
            </div>
          ))}
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
