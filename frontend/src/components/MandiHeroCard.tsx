import { useState, type FC, type FormEvent } from 'react';
import type { Language, MandiItem, LocationOption } from '../types';
import { translations } from '../data/i18n';
import { CROP_CHIPS, CHILLI_7DAY_TREND } from '../data/mockData';
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  Share2,
  Bell,
  CheckCircle2,
  PhoneCall,
  Info,
  Calendar,
  Package,
  ArrowRight,
  Search,
  X,
  Volume2,
  BarChart3,
  MapPin
} from 'lucide-react';

const CROP_BADGE_STYLES: Record<string, { bg: string; border: string; glow: string }> = {
  chilli: { bg: '#FEE2E2', border: '#FCA5A5', glow: '#EF4444' },
  tomato: { bg: '#FFE4E6', border: '#FDA4AF', glow: '#F43F5E' },
  onion: { bg: '#F3E8FF', border: '#D8B4FE', glow: '#A855F7' },
  groundnut: { bg: '#FEF3C7', border: '#FDE68A', glow: '#D97706' },
  cotton: { bg: '#F0F9FF', border: '#BAE6FD', glow: '#0EA5E9' },
  turmeric: { bg: '#FEF9C3', border: '#FDE047', glow: '#EAB308' },
  banana: { bg: '#FEF08A', border: '#FACC15', glow: '#CA8A04' },
  paddy: { bg: '#ECFDF5', border: '#A7F3D0', glow: '#10B981' }
};

interface MandiHeroCardProps {
  currentLang: Language;
  mandi: MandiItem;
  currentLocation?: LocationOption;
  isSummaryOnly?: boolean;
  onViewAllGrades?: () => void;
  onOpenAlertModal: () => void;
  onShareWhatsApp: () => void;
  onOpenHelpline: (number: string) => void;
  onSelectCrop?: (cropKey: string) => void;
}

export const MandiHeroCard: FC<MandiHeroCardProps> = ({
  currentLang,
  mandi,
  currentLocation,
  isSummaryOnly = false,
  onViewAllGrades,
  onOpenAlertModal,
  onShareWhatsApp,
  onOpenHelpline,
  onSelectCrop
}) => {
  const t = translations[currentLang];
  const [productSearch, setProductSearch] = useState('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const matchedCrop = CROP_CHIPS.find((c) => c.key === mandi.cropKey);
  const cropIcon = matchedCrop?.icon || '🌾';
  const modalGrade = mandi.grades.find((g) => g.gradeCode === 'MODAL') || mandi.grades[0];

  const handleProductSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!productSearch.trim() || !onSelectCrop) return;
    const term = productSearch.toLowerCase().trim();
    const found = CROP_CHIPS.find(
      (c) =>
        c.name[currentLang].toLowerCase().includes(term) ||
        c.name.en.toLowerCase().includes(term) ||
        c.name.hi.toLowerCase().includes(term) ||
        c.name.te.toLowerCase().includes(term) ||
        c.key.toLowerCase().includes(term)
    );
    if (found) {
      onSelectCrop(found.key);
      setProductSearch('');
    }
  };

  const handleReadAloud = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const readText =
        currentLang === 'hi'
          ? `${mandi.cropName.hi}, ${mandi.mandiName.hi} में मुख्य भाव ₹${modalGrade.modalPrice} प्रति क्विंटल है। पिछले सप्ताह से ₹${mandi.priceTrend.diffLastWeek} की तेजी है। बेचने का उत्तम समय है।`
          : currentLang === 'te'
          ? `${mandi.cropName.te}, ${mandi.mandiName.te}లో ప్రధాన ధర ₹${modalGrade.modalPrice} క్వింటాకు. గత వారం కంటే ₹${mandi.priceTrend.diffLastWeek} పెరిగింది. అమ్మడానికి మంచి సమయం.`
          : `${mandi.cropName.en} at ${mandi.mandiName.en}. Today modal price is ₹${modalGrade.modalPrice} per quintal, up ₹${mandi.priceTrend.diffLastWeek} above last week. Good time to sell.`;

      const utterance = new SpeechSynthesisUtterance(readText);
      utterance.lang = currentLang === 'te' ? 'te-IN' : currentLang === 'hi' ? 'hi-IN' : 'en-IN';
      utterance.onstart = () => setIsPlayingAudio(true);
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Speech audio is not supported in this browser.');
    }
  };

  if (isSummaryOnly) {
    return (
      <div className="home-mockup-hero-card" onClick={onViewAllGrades} role="button" tabIndex={0}>
        <div className="hero-top-info">
          <span className="hero-subtext">
            {mandi.mandiName[currentLang]} · {mandi.cropName[currentLang]} · Agmarknet 9:00 AM
          </span>
        </div>
        <div className="hero-main-row">
          <div className="hero-price-group">
            <span className="hero-price-amount">₹{modalGrade.modalPrice.toLocaleString()}</span>
            <span className="hero-price-trend">
              ↑ ₹{mandi.priceTrend.diffLastWeek}
            </span>
          </div>
          <div className="hero-sell-badge">
            <span>{t.goodTimeToSell}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mandi-hero-card">
      {/* Product Search & Vegetable Selector Panel (Today's Price tab) */}
      {onSelectCrop && (
        <div className="rates-product-search-panel">
          <form onSubmit={handleProductSearchSubmit} className="rates-search-bar">
            <Search size={22} className="rates-search-icon" />
            <input
              type="text"
              placeholder={
                currentLang === 'hi'
                  ? 'सब्जी या फसल खोजें (उदा: मिर्च, टमाटर, प्याज, मूंगफली, कपास)...'
                  : currentLang === 'te'
                  ? 'కూరగాయ లేదా పంట వెతకండి (మిర్చి, టమోటా, ఉల్లిపాయ, వేరుశనగ, పత్తి)...'
                  : 'Search vegetable or crop (e.g. Chilli, Tomato, Onion, Groundnut, Cotton)...'
              }
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="rates-search-input"
            />
            {productSearch.length > 0 && (
              <button
                type="button"
                onClick={() => setProductSearch('')}
                className="rates-search-clear-btn"
                title="Clear input"
              >
                <X size={16} />
              </button>
            )}
            <button type="submit" className="rates-search-btn">
              <Search size={16} />
              <span>{t.searchBtn}</span>
            </button>
          </form>

          {/* Quick Vegetable & Crop Selector Chips with clear icons */}
          <div className="rates-crop-pills-header">
            <span className="rates-crop-pills-title">
              🌾 {currentLang === 'hi' ? 'सब्जियां व फसलें (त्वरित चयन):' : currentLang === 'te' ? 'కూరగాయలు & పంటలు (త్వరిత ఎంపిక):' : 'Vegetables & Crops (Quick Select):'}
            </span>
            <span className="rates-active-crop-name">
              {currentLang === 'hi' ? 'सक्रिय भाव:' : currentLang === 'te' ? 'ప్రస్తుత పంట:' : 'Active Rate:'}{' '}
              <strong className="rates-selected-badge">{mandi.cropName[currentLang]}</strong>
            </span>
          </div>

          <div className="rates-crop-pills-row">
            {CROP_CHIPS.map((c) => {
              const isSelected = c.key === mandi.cropKey;
              const badgeStyle = CROP_BADGE_STYLES[c.key] || { bg: '#F1F5F9', border: '#CBD5E1', glow: '#16A34A' };
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => onSelectCrop(c.key)}
                  className={`rates-crop-pill ${isSelected ? 'active' : ''}`}
                  aria-pressed={isSelected}
                  title={`${c.name[currentLang]} (${c.count})`}
                >
                  <span
                    className="pill-icon-wrap"
                    style={{
                      backgroundColor: badgeStyle.bg,
                      borderColor: badgeStyle.border
                    }}
                  >
                    {c.icon}
                  </span>
                  <div className="pill-text-col">
                    <span className="pill-name">{c.name[currentLang]}</span>
                    <span className="pill-mandis-tag">{c.count}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Hero Card Header */}
      <div className="mandi-card-header">
        <div className="selected-crop-visual-banner">
          <div className="crop-avatar-wrap">
            <span className="crop-avatar-icon">{cropIcon}</span>
          </div>
          <div className="mandi-title-wrap">
            <div className="mandi-badge-row">
              <span className="live-pill">
                <span className="live-dot" />
                {t.liveAuction}
              </span>
              <span className="timestamp-pill">
                <Clock size={13} />
                {mandi.lastUpdated} (Agmarknet e-NAM)
              </span>
            </div>
            <h2 className="mandi-main-title">
              {mandi.cropName[currentLang]} ({mandi.variety})
            </h2>
            <p className="mandi-location">
              📍 {mandi.mandiName[currentLang]}, {mandi.state[currentLang]}
            </p>
          </div>
        </div>

        {/* Action Buttons: WhatsApp Share & Price Alert */}
        <div className="mandi-header-actions">
          <button
            type="button"
            onClick={handleReadAloud}
            className={`audio-read-btn ${isPlayingAudio ? 'playing' : ''}`}
            title={t.readAloudBtn}
          >
            <Volume2 size={16} />
            <span>{isPlayingAudio ? '...' : t.readAloudBtn}</span>
          </button>
          <button
            type="button"
            onClick={onShareWhatsApp}
            className="whatsapp-share-btn"
            title={t.shareWhatsapp}
          >
            <Share2 size={16} />
            <span>{t.shareWhatsapp}</span>
          </button>
          <button
            type="button"
            onClick={onOpenAlertModal}
            className="price-alert-btn"
            title={t.setPriceAlertBtn}
          >
            <Bell size={16} />
            <span>{t.setPriceAlertBtn}</span>
          </button>
        </div>
      </div>

      {/* Selling Advisory Banner with "Why?" Logic */}
      <div className="selling-advisory-box">
        <div className="advisory-headline-row">
          <div className="advisory-badge">
            <CheckCircle2 size={20} className="check-icon" />
            <span>{t.goodTimeToSell}</span>
          </div>
          <div className="trend-highlight">
            <TrendingUp size={18} />
            <span>+₹{mandi.priceTrend.diffLastWeek} {t.quintalUnit} (▲ {mandi.priceTrend.percentage}%)</span>
          </div>
        </div>

        {/* ❓ The Farmer's Question: "Why this advice?" */}
        <div className="why-explainer-section">
          <h3 className="why-title">
            <Info size={16} />
            <span>{t.whyQuestion}</span>
          </h3>
          <ul className="why-reasons-list">
            <li className="reason-item trend">
              <span className="reason-bullet">📈</span>
              <div className="reason-text">
                <strong>{mandi.whySellReasons.trendReason[currentLang]}</strong>
              </div>
            </li>
            <li className="reason-item weather">
              <span className="reason-bullet">🌧️</span>
              <div className="reason-text">
                <strong>{mandi.whySellReasons.weatherReason[currentLang]}</strong>
              </div>
            </li>
            <li className="reason-item inflow">
              <span className="reason-bullet">📦</span>
              <div className="reason-text">
                <strong>{mandi.whySellReasons.inflowReason[currentLang]}</strong>
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* Summary View vs Full Grade Details */}
      {isSummaryOnly ? (
        <div className="home-summary-grade-strip">
          <div className="summary-rate-display">
            <span className="summary-rate-label">{t.commonModalBadge}:</span>
            <div className="summary-rate-val">
              <span className="rate-num">₹{modalGrade.modalPrice.toLocaleString()}</span>
              <span className="rate-unit">{t.quintalUnit}</span>
            </div>
            <p className="summary-rate-hint">
              {modalGrade.qualityCriteria[currentLang]}
            </p>
          </div>

          {onViewAllGrades && (
            <button
              type="button"
              onClick={onViewAllGrades}
              className="view-all-grades-cta"
            >
              <span>{t.viewAllGradesBtn}</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Multi-Grade & Variety Price Bands */}
          <div className="grades-section">
            <h3 className="section-subtitle">
              <span>{t.varietyGradeTitle}</span>
            </h3>
            <div className="grades-grid">
              {mandi.grades.map((grade) => (
                <div key={grade.gradeCode} className={`grade-card ${grade.gradeCode.toLowerCase()}`}>
                  <div className="grade-header">
                    <span className="grade-badge" style={{ backgroundColor: grade.badgeColor || '#2D5A27' }}>
                      {grade.gradeCode === 'MODAL' ? t.commonModalBadge : `Grade ${grade.gradeCode}`}
                    </span>
                    <span className="grade-name">{grade.name[currentLang]}</span>
                  </div>
                  <div className="grade-price-row">
                    <span className="grade-price">{grade.priceRange}</span>
                    <span className="grade-unit">{t.quintalUnit}</span>
                  </div>
                  <p className="grade-criteria">
                    <span className="criteria-label">{t.qualityCriteriaLabel}</span> {grade.qualityCriteria[currentLang]}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 7-Day Price Trend Bar Chart */}
          <div className="price-trend-chart-card">
            <div className="chart-header">
              <div className="chart-title-wrap">
                <BarChart3 size={18} className="chart-icon" />
                <h4 className="chart-title">
                  {mandi.cropName[currentLang]} - {mandi.mandiName[currentLang]} ({t.sevenDayPriceTrend})
                </h4>
              </div>
              <span className="trend-badge-pill">▲ ₹{mandi.priceTrend.diffLastWeek} / qt</span>
            </div>

            <div className="bar-chart-visual">
              {CHILLI_7DAY_TREND.map((item, idx) => {
                // Compute height percentage between 13500 and 14500
                const minChart = 13500;
                const maxChart = 14500;
                const pct = Math.max(25, Math.min(100, Math.round(((item.price - minChart) / (maxChart - minChart)) * 100)));
                const isHighest = idx === 4;

                return (
                  <div key={item.day} className="chart-col">
                    <span className="col-price-val">₹{item.price.toLocaleString()}</span>
                    <div className="col-bar-track">
                      <div
                        className={`col-bar-fill ${isHighest ? 'highest' : ''}`}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                    <span className="col-day-lbl">{item.day}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Where to Sell: Regional Mandis Comparison */}
          <div className="where-to-sell-card">
            <div className="wts-header">
              <MapPin size={18} className="wts-icon" />
              <h4 className="wts-title">
                {t.whereToSellTitle} {currentLocation ? `(${currentLocation.name[currentLang]})` : ''}
              </h4>
            </div>
            <div className="wts-mandis-grid">
              <div className="wts-mandi-item current">
                <div className="wts-item-top">
                  <span className="wts-mandi-tag current">
                    📍 {mandi.mandiName[currentLang]} ({currentLang === 'hi' ? 'स्थानीय यार्ड · 0 किमी' : currentLang === 'te' ? 'స్థానిక మార్కెట్ · 0 కి.మీ' : 'Local Yard · 0 km'})
                  </span>
                  <strong className="wts-price">₹{modalGrade.modalPrice.toLocaleString()}{t.quintalUnit}</strong>
                </div>
                <span className="wts-status-note">
                  {currentLang === 'hi'
                    ? `स्थानीय यार्ड · शून्य अतिरिक्त भाड़ा`
                    : currentLang === 'te'
                    ? `స్థానిక మార్కెట్ · అదనపు రవాణా ఖర్చు లేదు`
                    : `Local Yard · Zero Extra Freight`}
                </span>
              </div>

              {mandi.otherNearbyMandis.map((near) => {
                const priceDiff = near.modalPrice - modalGrade.modalPrice;
                const isHigher = priceDiff > 0;

                return (
                  <div key={near.name.en} className="wts-mandi-item">
                    <div className="wts-item-top">
                      <span className="wts-mandi-tag">📍 {near.name[currentLang]} ({near.distance} km)</span>
                      <strong className="wts-price">₹{near.modalPrice.toLocaleString()}{t.quintalUnit}</strong>
                    </div>
                    <div className="wts-item-bottom">
                      <span className={`diff-tag ${isHigher ? 'positive' : 'negative'}`}>
                        {isHigher ? `+₹${priceDiff} ${t.quintalUnit} Higher` : `₹${Math.abs(priceDiff)} Lower`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Financial Reality Check: Not a Guarantee */}
      <div className="financial-risk-box">
        <div className="risk-header">
          <AlertTriangle size={20} className="risk-icon" />
          <span className="risk-title">{t.notGuaranteeTitle}</span>
        </div>
        <p className="risk-text">{t.notGuaranteeDesc}</p>
        <div className="stock-stamps-row">
          <div className="stamp-badge">
            <Package size={14} />
            <span>{t.unsoldStockLabel} <strong>{mandi.unsoldYardStockBags.toLocaleString()} {t.bagsUnit}</strong></span>
          </div>
          {mandi.eNamLotVerified && (
            <div className="stamp-badge verified">
              <CheckCircle2 size={14} />
              <span>{t.enamVerified}</span>
            </div>
          )}
        </div>
      </div>

      {/* Mandi Operational Schedule */}
      <div className="mandi-schedule-ribbon">
        <Calendar size={16} />
        <span className="schedule-label">{t.mandiHoursLabel}</span>
        <span className="schedule-hours">{t.mandiHoursVal}</span>
      </div>

      {/* 1-Tap Big Helpline Card */}
      {!isSummaryOnly && (
        <div className="helpline-card single-full">
          <h4 className="footer-card-title">{t.helplineHeader}</h4>
          <div className="helpline-btn-group">
            <button
              type="button"
              onClick={() => onOpenHelpline('1551')}
              className="helpline-call-btn primary"
            >
              <PhoneCall size={18} />
              <div className="btn-call-text">
                <span className="call-name">{t.kisanCallCenter}</span>
                <span className="call-number">1551 ({t.tollFreeTag})</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => onOpenHelpline('1800-180-1551')}
              className="helpline-call-btn secondary"
            >
              <PhoneCall size={18} />
              <div className="btn-call-text">
                <span className="call-name">{t.mandiDesk}</span>
                <span className="call-number">1800-180-1551</span>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
