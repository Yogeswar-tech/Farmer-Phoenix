import { useState, useEffect, useMemo, type FC, type FormEvent } from 'react';
import type { Language, MandiItem, LocationOption } from '../types';
import { translations } from '../data/i18n';
import { KisanSethuApi } from '../services/api';
import {
  Volume2,
  Share2,
  Search,
  X,
  PhoneCall,
  Truck,
  Sparkles,
  Loader2
} from 'lucide-react';

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

// Visual Crop SVGs & Icons for realistic 3-grade presentation
const CROP_ICONS: Record<string, string> = {
  chilli: '🌶️',
  red_chilli: '🌶️',
  tomato: '🍅',
  potato: '🥔',
  onion: '🧅',
  brinjal: '🍆',
  okra: '🌿',
  cauliflower: '🥦',
  cabbage: '🥬',
  carrot: '🥕',
  ginger: '🫚',
  garlic: '🧄',
  cucumber: '🥒',
  bottle_gourd: '🥒',
  bitter_gourd: '🥒',
  green_peas: '🫛',
  capsicum: '🫑',
  drumstick: '🥢',
  radish: '🌱',
  beetroot: '🫐',
  cherry: '🍒',
  mango: '🥭',
  banana: '🍌',
  apple: '🍎',
  pomegranate: '🍎',
  watermelon: '🍉',
  paddy: '🌾',
  wheat: '🌾',
  maize: '🌽',
  chana: '🧆',
  toor_dal: '🥣',
  cotton: '🌱',
  turmeric: '🟡',
  soybean: '🫘',
  groundnut: '🥜',
  black_pepper: '🧂',
  saffron: '🌸'
};

// Initial Fallback Queued Search Buttons (chips)
const DEFAULT_QUEUED_CROPS = [
  { key: 'red_chilli', name: 'Red Chilli', icon: '🌶️' },
  { key: 'tomato', name: 'Tomato', icon: '🍅' },
  { key: 'potato', name: 'Potato', icon: '🥔' },
  { key: 'onion', name: 'Onion', icon: '🧅' },
  { key: 'brinjal', name: 'Brinjal', icon: '🍆' },
  { key: 'okra', name: 'Okra (Bhindi)', icon: '🌿' },
  { key: 'cauliflower', name: 'Cauliflower', icon: '🥦' },
  { key: 'cabbage', name: 'Cabbage', icon: '🥬' },
  { key: 'carrot', name: 'Carrot', icon: '🥕' },
  { key: 'ginger', name: 'Ginger', icon: '🫚' },
  { key: 'garlic', name: 'Garlic', icon: '🧄' },
  { key: 'cherry', name: 'Cherry', icon: '🍒' },
  { key: 'cotton', name: 'Cotton', icon: '🌱' },
  { key: 'turmeric', name: 'Turmeric', icon: '🟡' },
  { key: 'paddy', name: 'Paddy', icon: '🌾' },
  { key: 'wheat', name: 'Wheat', icon: '🌾' },
  { key: 'maize', name: 'Maize (Corn)', icon: '🌽' },
  { key: 'mango', name: 'Mango', icon: '🥭' },
  { key: 'banana', name: 'Banana', icon: '🍌' },
  { key: 'apple', name: 'Apple', icon: '🍎' },
  { key: 'cucumber', name: 'Cucumber', icon: '🥒' },
  { key: 'green_peas', name: 'Green Peas', icon: '🫛' },
  { key: 'capsicum', name: 'Capsicum', icon: '🫑' },
  { key: 'drumstick', name: 'Drumstick', icon: '🥢' },
  { key: 'pomegranate', name: 'Pomegranate', icon: '🍎' },
  { key: 'watermelon', name: 'Watermelon', icon: '🍉' },
  { key: 'groundnut', name: 'Groundnut', icon: '🥜' },
  { key: 'soybean', name: 'Soybean', icon: '🫘' },
  { key: 'black_pepper', name: 'Black Pepper', icon: '🧂' },
  { key: 'saffron', name: 'Saffron', icon: '🌸' }
];

export const MandiHeroCard: FC<MandiHeroCardProps> = ({
  currentLang,
  mandi,
  currentLocation,
  onShareWhatsApp,
  onOpenHelpline,
  onSelectCrop
}) => {
  const t = translations[currentLang];
  const [productSearch, setProductSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [queuedCrops, setQueuedCrops] = useState<any[]>(DEFAULT_QUEUED_CROPS);

  // Active crop live dataset from backend
  const [activeCropData, setActiveCropData] = useState<any>({
    commodity: mandi.cropName.en,
    ribbon_title: `TODAY'S LIVE PRICE: ${mandi.cropName.en.toUpperCase()}`,
    market: currentLocation?.name.en ? `${currentLocation.name.en} APMC Yard` : 'Guntur APMC Yard',
    state: currentLocation?.state.en || 'Andhra Pradesh',
    variety: mandi.variety || 'Deluxe Grade',
    grade_a: {
      name: 'BEST QUALITY (Grade A)',
      min_qtl: 14910,
      max_qtl: 18816,
      min_kg: 149.1,
      max_kg: 188.16
    },
    grade_b: {
      name: 'MEDIUM QUALITY (Grade B)',
      min_qtl: 12400,
      max_qtl: 13200,
      min_kg: 124.0,
      max_kg: 132.0
    },
    grade_c: {
      name: 'LOW QUALITY (Grade C)',
      min_qtl: 7500,
      max_qtl: 9200,
      min_kg: 75.0,
      max_kg: 92.0
    },
    selling_advice: 'GOOD TIME TO SELL (+₹300 / Quintal Today)',
    weather_alert: 'Heavy rain forecast for Thursday. Protect open harvest.',
    nearest_markets: [
      { market: 'Warangal Mandi', price_qtl: 14100, distance: '2.5 hrs away' },
      { market: 'Kurnool Mandi', price_qtl: 13800, distance: '4.0 hrs away' }
    ],
    helpdesk: '1800-123-1234'
  });

  // 1. Fetch all queued search buttons (crops) on mount
  useEffect(() => {
    let isMounted = true;
    KisanSethuApi.getAllQueuedCrops()
      .then((crops) => {
        if (isMounted && crops && crops.length > 0) {
          const formatted = crops.map((c) => ({
            key: c.key,
            name: c.commodity,
            icon: c.icon || CROP_ICONS[c.key] || '🌱'
          }));
          setQueuedCrops(formatted);
        }
      })
      .catch(() => {
        // Fallback to DEFAULT_QUEUED_CROPS
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch live today crop data whenever mandi or crop changes
  useEffect(() => {
    let isMounted = true;
    const cropQuery = mandi.cropName.en || mandi.cropKey || 'Red Chilli';
    const mkt = currentLocation?.name.en ? `${currentLocation.name.en} APMC Yard` : undefined;
    const st = currentLocation?.state.en;

    KisanSethuApi.searchCropTodayPrice(cropQuery, mkt, st)
      .then((res) => {
        if (isMounted && res && res.status === 'success') {
          setActiveCropData(res);
        }
      })
      .catch(() => {
        // Keep resilient current data
      });

    return () => {
      isMounted = false;
    };
  }, [mandi.cropKey, mandi.cropName.en, currentLocation?.name.en]);

  // Handle Search Submission (Universal: searches ANY crop on Earth)
  const handleSearchSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const query = productSearch.trim();
    if (!query) return;

    setIsSearching(true);
    try {
      const mkt = currentLocation?.name.en ? `${currentLocation.name.en} APMC Yard` : undefined;
      const st = currentLocation?.state.en;
      const res = await KisanSethuApi.searchCropTodayPrice(query, mkt, st);

      if (res && res.status === 'success') {
        setActiveCropData(res);
        if (onSelectCrop) {
          const matchKey = res.commodity.toLowerCase().replace(/\s+/g, '_');
          onSelectCrop(matchKey);
        }
      }
    } catch (err) {
      console.warn('Search failed:', err);
    } finally {
      setIsSearching(false);
      setProductSearch('');
    }
  };

  // 1-Tap Queue Crop Selection
  const handleQueueChipTap = async (chip: { key: string; name: string }) => {
    if (onSelectCrop) onSelectCrop(chip.key);
    setIsSearching(true);
    try {
      const mkt = currentLocation?.name.en ? `${currentLocation.name.en} APMC Yard` : undefined;
      const st = currentLocation?.state.en;
      const res = await KisanSethuApi.searchCropTodayPrice(chip.name, mkt, st);
      if (res && res.status === 'success') {
        setActiveCropData(res);
      }
    } catch (err) {
      console.warn('Chip fetch failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Audio Read Aloud
  const handleReadAloud = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const cropName = activeCropData.commodity;
      const gradeA = activeCropData.grade_a;
      const gradeB = activeCropData.grade_b;
      const gradeC = activeCropData.grade_c;
      const advice = activeCropData.selling_advice;

      const readText =
        currentLang === 'hi'
          ? `आज का लाइव भाव: ${cropName}। उत्तम गुणवत्ता ग्रेड ए: ₹${Math.round(gradeA.min_qtl)} से ₹${Math.round(gradeA.max_qtl)} प्रति क्विंटल। मध्यम ग्रेड बी: ₹${Math.round(gradeB.min_qtl)} से ₹${Math.round(gradeB.max_qtl)}। सामान्य ग्रेड सी: ₹${Math.round(gradeC.min_qtl)} से ₹${Math.round(gradeC.max_qtl)}। सलाह: ${advice}`
          : currentLang === 'te'
          ? `ఈరోజు ప్రత్యక్ష ధర: ${cropName}। ఉత్తమ నాణ్యత గ్రేడ్ ఏ: ₹${Math.round(gradeA.min_qtl)} నుండి ₹${Math.round(gradeA.max_qtl)} క్వింటాకు। మధ్యస్థ గ్రేడ్ బి: ₹${Math.round(gradeB.min_qtl)} నుండి ₹${Math.round(gradeB.max_qtl)}। సాధారణ గ్రేడ్ సి: ₹${Math.round(gradeC.min_qtl)} నుండి ₹${Math.round(gradeC.max_qtl)}। సలహా: ${advice}`
          : `Today's Live Price for ${cropName}. Best Quality Grade A is ₹${Math.round(gradeA.min_qtl)} to ₹${Math.round(gradeA.max_qtl)} per quintal. Medium Quality Grade B is ₹${Math.round(gradeB.min_qtl)} to ₹${Math.round(gradeB.max_qtl)}. Low Quality Grade C is ₹${Math.round(gradeC.min_qtl)} to ₹${Math.round(gradeC.max_qtl)}. Selling Advice: ${advice}`;

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

  // WhatsApp Sharing
  const handleShareWhatsAppAction = () => {
    const cropName = activeCropData.commodity;
    const gradeA = activeCropData.grade_a;
    const gradeB = activeCropData.grade_b;
    const gradeC = activeCropData.grade_c;
    const advice = activeCropData.selling_advice;
    const market = activeCropData.market;

    const message = `🌾 *KISAN-SETHU: MANDI LIVE RATES ADVISOR* 🌾\n📍 *Market:* ${market}\n🔴 *TODAY'S LIVE PRICE: ${cropName.toUpperCase()}*\n\n⭐ *BEST QUALITY (Grade A):* ₹${Math.round(gradeA.min_qtl).toLocaleString()} - ₹${Math.round(gradeA.max_qtl).toLocaleString()} / qtl\n👍 *MEDIUM QUALITY (Grade B):* ₹${Math.round(gradeB.min_qtl).toLocaleString()} - ₹${Math.round(gradeB.max_qtl).toLocaleString()} / qtl\n⚠️ *LOW QUALITY (Grade C):* ₹${Math.round(gradeC.min_qtl).toLocaleString()} - ₹${Math.round(gradeC.max_qtl).toLocaleString()} / qtl\n\n✅ *SELLING ADVICE:* ${advice}\n\n👉 *Direct Live Check:* ${window.location.origin}`;

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const cropKey = (activeCropData.commodity || 'crop').toLowerCase().replace(/\s+/g, '_');
  const cropEmoji = CROP_ICONS[cropKey] || '🌶️';

  const gradeA = activeCropData.grade_a || { min_qtl: 14910, max_qtl: 18816, min_kg: 149, max_kg: 188 };
  const gradeB = activeCropData.grade_b || { min_qtl: 12400, max_qtl: 13200, min_kg: 124, max_kg: 132 };
  const gradeC = activeCropData.grade_c || { min_qtl: 7500, max_qtl: 9200, min_kg: 75, max_kg: 92 };

  const marketSubtitle = useMemo(() => {
    const locName = currentLocation?.name[currentLang] || activeCropData.market || 'Guntur APMC Yard';
    const stateName = currentLocation?.state[currentLang] || activeCropData.state || 'Andhra Pradesh';
    return `${locName}, ${stateName} (GPS Locked)`;
  }, [currentLocation, activeCropData, currentLang]);

  return (
    <div className="mandi-advisor-wrapper">
      {/* 1. TOP HEADER BANNER: Deep Forest Green (#0B3B17) */}
      <div className="advisor-header-strip">
        <div className="header-left-col">
          <h1 className="advisor-main-title">Mandi Live Rates Advisor</h1>
          <div className="advisor-gps-row">
            <span className="gps-location-text">📍 {marketSubtitle}</span>
            <span className="gps-icon-pill">
              <span className="gps-live-dot" />
              GPS 📶
            </span>
          </div>
        </div>

        <div className="header-actions-col">
          <button
            type="button"
            onClick={handleReadAloud}
            className={`btn-listen-action ${isPlayingAudio ? 'playing' : ''}`}
            title="Listen to today's rates & action"
          >
            <Volume2 size={16} />
            <span>{isPlayingAudio ? 'Speaking...' : 'Listen Price & Action'}</span>
          </button>

          <button
            type="button"
            onClick={handleShareWhatsAppAction}
            className="btn-share-whatsapp"
            title="Share Today's Rates on WhatsApp"
          >
            <Share2 size={16} />
            <span>Share Rates</span>
          </button>
        </div>
      </div>

      {/* 2. UNIVERSAL SEARCH BAR */}
      <div className="advisor-search-container">
        <form onSubmit={handleSearchSubmit} className="advisor-search-bar">
          <Search size={20} className="search-lead-icon" />
          <input
            type="text"
            className="advisor-search-input"
            placeholder="Search ANY Crop, Variety, or Mandi (e.g., Red Chilli, Tomato)..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
          />
          {productSearch.length > 0 && (
            <button
              type="button"
              onClick={() => setProductSearch('')}
              className="search-clear-btn"
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
          <button type="submit" className="search-submit-btn" disabled={isSearching}>
            {isSearching ? <Loader2 size={16} className="spin-icon" /> : <Search size={16} />}
            <span>Search</span>
          </button>
        </form>

        {/* 3. QUEUED SEARCH BUTTONS (Horizontally Scrollable Chips) */}
        <div className="queued-search-buttons-scroll">
          <div className="queue-label">
            <Sparkles size={14} color="#16A34A" />
            <span>Fast Select:</span>
          </div>
          {queuedCrops.map((chip) => {
            const isSelected =
              activeCropData.commodity.toLowerCase().includes(chip.name.toLowerCase()) ||
              chip.name.toLowerCase().includes(activeCropData.commodity.toLowerCase());

            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => handleQueueChipTap(chip)}
                className={`queued-crop-chip ${isSelected ? 'active' : ''}`}
                title={`Instant Rates for ${chip.name}`}
              >
                <span className="chip-icon">{chip.icon}</span>
                <span className="chip-label">{chip.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. THE RED RIBBON BANNER */}
      <div className="ceremonial-ribbon-outer">
        <div className="ribbon-tail ribbon-tail-left" />
        <div className="ceremonial-ribbon-body">
          {/* Left Rosette Medal Badge */}
          <div className="rosette-medal-icon" title="Certified Live Rate">
            <div className="rosette-circle">
              <span className="rosette-emoji">🎀</span>
            </div>
            <div className="rosette-ribbon-tails">
              <span className="tail-left" />
              <span className="tail-right" />
            </div>
          </div>

          {/* Ribbon Title */}
          <h2 className="ceremonial-ribbon-title">
            TODAY'S LIVE PRICE: {activeCropData.commodity.toUpperCase()}
          </h2>
        </div>
        <div className="ribbon-tail ribbon-tail-right" />
      </div>

      {/* 5. QUALITY & PRICE GUIDE SUBTITLE */}
      <div className="guide-subtitle-row">
        <h3 className="guide-main-heading">
          Quality & Price Guide ({currentLocation?.district.en || 'Guntur'} Local)
        </h3>
      </div>

      {/* 6. 3-TIER QUALITY & PRICE GUIDE CARDS */}
      <div className="quality-cards-grid">
        {/* CARD 1: BEST QUALITY (Grade A) */}
        <div className="quality-card grade-a-card">
          <div className="card-top-badge best-badge">
            <span className="badge-star">⭐</span>
            <span className="badge-title">BEST QUALITY (Grade A)</span>
          </div>

          <div className="card-price-container">
            <div className="card-dual-graphic-row">
              <span className="crop-illustration left">{cropEmoji}</span>
              <div className="card-price-col">
                <span className="card-price-numbers">
                  ₹{Math.round(gradeA.min_qtl).toLocaleString()} - ₹{Math.round(gradeA.max_qtl).toLocaleString()}
                </span>
                <span className="card-price-unit">/ quintal</span>
                <span className="card-kg-subtext">
                  (₹{Math.round(gradeA.min_qtl / 100)} - ₹{Math.round(gradeA.max_qtl / 100)} / kg)
                </span>
              </div>
              <span className="crop-illustration right">{cropEmoji}</span>
            </div>
          </div>
        </div>

        {/* CARD 2: MEDIUM QUALITY (Grade B) */}
        <div className="quality-card grade-b-card">
          <div className="card-top-badge medium-badge">
            <span className="badge-thumb">👍</span>
            <span className="badge-title">MEDIUM QUALITY (Grade B)</span>
          </div>

          <div className="card-price-container">
            <div className="card-dual-graphic-row">
              <span className="crop-illustration left dimmed">{cropEmoji}</span>
              <div className="card-price-col">
                <span className="card-price-numbers">
                  ₹{Math.round(gradeB.min_qtl).toLocaleString()} - ₹{Math.round(gradeB.max_qtl).toLocaleString()}
                </span>
                <span className="card-price-unit">/ quintal</span>
                <span className="card-kg-subtext">
                  (₹{Math.round(gradeB.min_qtl / 100)} - ₹{Math.round(gradeB.max_qtl / 100)} / kg)
                </span>
              </div>
              <span className="crop-illustration right dimmed">{cropEmoji}</span>
            </div>
          </div>
        </div>

        {/* CARD 3: LOW QUALITY (Grade C) */}
        <div className="quality-card grade-c-card">
          <div className="card-top-badge low-badge">
            <span className="badge-warn">⚠️</span>
            <span className="badge-title">LOW QUALITY (Grade C)</span>
          </div>

          <div className="card-price-container">
            <div className="card-dual-graphic-row">
              <span className="crop-illustration left pale">{cropEmoji}</span>
              <div className="card-price-col">
                <span className="card-price-numbers">
                  ₹{Math.round(gradeC.min_qtl).toLocaleString()} - ₹{Math.round(gradeC.max_qtl).toLocaleString()}
                </span>
                <span className="card-price-unit">/ quintal</span>
                <span className="card-kg-subtext">
                  (₹{Math.round(gradeC.min_qtl / 100)} - ₹{Math.round(gradeC.max_qtl / 100)} / kg)
                </span>
              </div>
              <span className="crop-illustration right pale">{cropEmoji}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 7. SELLING ADVICE BANNER (Green) */}
      <div className="selling-advice-pill-banner">
        <span className="advice-check-icon">✅</span>
        <span className="advice-text">
          <b>SELLING ADVICE:</b> {activeCropData.selling_advice}
        </span>
      </div>

      {/* 8. WEATHER ALERT BANNER (Amber) */}
      <div className="weather-alert-pill-banner">
        <span className="alert-warn-icon">⚠️</span>
        <span className="alert-text">
          <b>WEATHER ALERT:</b> {activeCropData.weather_alert}
        </span>
      </div>

      {/* 9. NEAREST MARKETS & HELPDESK FOOTER STRIP */}
      <div className="advisor-footer-ticker">
        <div className="ticker-left-markets">
          <Truck size={16} className="truck-icon" />
          <span className="ticker-prefix">NEAREST MARKETS:</span>
          {activeCropData.nearest_markets && activeCropData.nearest_markets.length > 0 ? (
            activeCropData.nearest_markets.map((m: any, idx: number) => (
              <span key={idx} className="nearest-mkt-segment">
                {m.market}: <b>₹{Number(m.price_qtl).toLocaleString()}/qnt</b> ({m.distance})
                {idx < activeCropData.nearest_markets.length - 1 && <span className="mkt-divider"> | </span>}
              </span>
            ))
          ) : (
            <span className="nearest-mkt-segment">
              Warangal Mandi: <b>₹14,100/qnt</b> (2.5 hrs away) | Kurnool Mandi: <b>₹13,800/qnt</b> (4.0 hrs away)
            </span>
          )}
        </div>

        <div className="ticker-right-helpdesk">
          <button
            type="button"
            onClick={() => onOpenHelpline(activeCropData.helpdesk || '1800-123-1234')}
            className="helpdesk-link-btn"
            title="Call APMC Helpdesk"
          >
            <PhoneCall size={14} />
            <span>
              {currentLocation?.name.en || 'Guntur'} APMC Helpdesk: <b>{activeCropData.helpdesk || '1800-123-1234'}</b>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
