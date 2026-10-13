import { useState, useEffect, type FC, type FormEvent } from 'react';
import type { Language, MandiItem, LocationOption } from '../types';
import { translations } from '../data/i18n';
import { CROP_CHIPS, calculateLocationDistanceKm } from '../data/mockData';
import { Truck, Calculator, CheckCircle2, AlertTriangle, DollarSign, Search, Sparkles, ArrowRight } from 'lucide-react';

interface MandiLogisticsViewProps {
  currentLang: Language;
  mandi: MandiItem;
  currentLocation?: LocationOption;
}

const PRODUCT_DESTINATION_INTELLIGENCE: Record<string, {
  name: Record<Language, string>;
  icon: string;
  destinationLocationId: string;
  localMandi: Record<Language, string>;
  localPrice: number;
  recommendedMandi: Record<Language, string>;
  destinationPrice: number;
  distanceKm: number;
  reason: Record<Language, string>;
}> = {
  chilli: {
    name: { hi: 'मिर्च', te: 'మిర్చి', en: 'Chilli' },
    icon: '🌶️',
    destinationLocationId: 'guntur',
    localMandi: { hi: 'तेनाली स्थानीय यार्ड', te: 'తెనాలి లోకల్ యార్డ్', en: 'Tenali Local Yard' },
    localPrice: 13900,
    recommendedMandi: { hi: 'गुंटूर मिर्ची यार्ड (एशिया प्रसिद्ध)', te: 'గుంటూరు మిర్చి యార్డ్ (ఆసియాలోనే ప్రసిద్ధి)', en: 'Guntur Mirchi Yard' },
    destinationPrice: 14200,
    distanceKm: 48,
    reason: {
      hi: 'अंतरराष्ट्रीय निर्यात मांग; तेजा व सन्नम किस्मों पर ₹300 प्रति क्विंटल का सीधा प्रीमियम।',
      te: 'అంతర్జాతీయ ఎగుమతి డిమాండ్; తేజ రకానికి క్వింటాకు రూ. 300 అదనపు ప్రీమియం.',
      en: 'Global export demand; Teja and Sannam varieties command ₹300/qt premium over local town yards.'
    }
  },
  tomato: {
    name: { hi: 'टमाटर', te: 'టమోటా', en: 'Tomato' },
    icon: '🍅',
    destinationLocationId: 'chittoor',
    localMandi: { hi: 'चित्तूर स्थानीय यार्ड', te: 'చిత్తూరు లోకల్ యార్డ్', en: 'Chittoor Local Yard' },
    localPrice: 2600,
    recommendedMandi: { hi: 'मदनपल्ले एशिया टमाटर मंडी', te: 'మదనపల్లె టమోటా మార్కెట్', en: 'Madanapalle Tomato Yard' },
    destinationPrice: 3250,
    distanceKm: 65,
    reason: {
      hi: 'एशिया की सबसे बड़ी टमाटर मंडी; देश भर के थोक व्यापारी नकद भुगतान व उच्च बोली देते हैं।',
      te: 'ఆసియాలోనే అతిపెద్ద టమోటా మార్కెట్; దేశవ్యాప్త వ్యాపారుల నుంచి అత్యధిక ధర & తక్షణ చెల్లింపు.',
      en: "Asia's largest tomato terminal; nationwide buyers provide highest bidding & instant cash settlement."
    }
  },
  groundnut: {
    name: { hi: 'मूंगफली', te: 'వేరుశనగ', en: 'Groundnut' },
    icon: '🥜',
    destinationLocationId: 'anantapur',
    localMandi: { hi: 'धर्मावरम स्थानीय मंडी', te: 'ధర్మవరం స్థానిక మార్కెట్', en: 'Dharmavaram Local Mandi' },
    localPrice: 7100,
    recommendedMandi: { hi: 'अनंतपुर व कादिरी मूंगफली यार्ड', te: 'అనంతపురం & కదిరి వేరుశనగ యార్డ్', en: 'Anantapur & Kadiri APMC Yard' },
    destinationPrice: 7850,
    distanceKm: 55,
    reason: {
      hi: 'तेल मिलों की सीधी खरीद और इलेक्ट्रॉनिक वजन; कम नमी वाले माल पर सर्वोत्तम भाव।',
      te: 'ఆయిల్ మిల్లుల ప్రత్యక్ష కొనుగోలు, ఎలక్ట్రానిక్ తూకం; నాణ్యమైన కాయలకు ఉత్తమ ధర.',
      en: 'Direct oil mill competitive buying and electronic weighment with highest oil content bonus.'
    }
  },
  cotton: {
    name: { hi: 'कपास', te: 'పత్తి', en: 'Cotton' },
    icon: '⚪',
    destinationLocationId: 'adoni',
    localMandi: { hi: 'नंद्याल स्थानीय यार्ड', te: 'నంద్యాల స్థానిక యార్డ్', en: 'Nandyal Local Yard' },
    localPrice: 7100,
    recommendedMandi: { hi: 'अदोनी कपास व जिनिंग मंडी', te: 'ఆదోని పత్తి మార్కెట్ యార్డ్', en: 'Adoni Cotton & Ginning Yard' },
    destinationPrice: 7650,
    distanceKm: 72,
    reason: {
      hi: 'रायचूर व अदोनी की बड़ी जिनिंग मिलें लंबे रेशे वाले कपास पर भारी प्रीमियम देती हैं।',
      te: 'ఆదోని జిన్నింగ్ మిల్లుల ద్వారా నాణ్యమైన దూదికి రికార్డు ధర.',
      en: 'Hub of large ginning mills providing instant premium for long staple fiber.'
    }
  },
  turmeric: {
    name: { hi: 'हल्दी', te: 'పసుపు', en: 'Turmeric' },
    icon: '🟡',
    destinationLocationId: 'kadapa',
    localMandi: { hi: 'प्रौద్దుటూరు स्थानीय यार्ड', te: 'ప్రొద్దుటూరు స్థానిక యార్డ్', en: 'Proddatur Local Yard' },
    localPrice: 15200,
    recommendedMandi: { hi: 'कडपा (कृष्णा नगर) / निजामाबाद मंडी', te: 'కడప (కృష్ణా నగర్) / నిజామాబాద్ యార్డ్', en: 'Kadapa (Krishna Nagar) APMC Yard' },
    destinationPrice: 16500,
    distanceKm: 42,
    reason: {
      hi: 'उच्च करक्यूमिन वाली फली के लिए संगठित ई-नाम खरीदार सक्रिय हैं।',
      te: 'అధిక కర్క్యుమిన్ కొమ్ములకు ఇ-నామ్ ద్వారా దేశీయ వ్యాపారుల పోటీ.',
      en: 'Curcumin-certified lots sold via e-NAM fetching top industrial price.'
    }
  },
  banana: {
    name: { hi: 'केला', te: 'అరటి', en: 'Banana' },
    icon: '🍌',
    destinationLocationId: 'kadapa',
    localMandi: { hi: 'राजमपेट स्थानीय बाजार', te: 'రాజంపేట స్థానిక మార్కెట్', en: 'Rajampet Local Market' },
    localPrice: 1750,
    recommendedMandi: { hi: 'कडपा व पुलिवेंदुला केला टर्मिनल', te: 'కడప & పులివెందుల అరటి టెర్మినల్', en: 'Kadapa & Pulivendula Export Terminal' },
    destinationPrice: 2150,
    distanceKm: 38,
    reason: {
      hi: 'खाड़ी देशों को जी-9 किस्म के सीधे निर्यात हेतु कोल्ड चेन कंटेनर लोडिंग केंद्र।',
      te: 'గల్ఫ్ దేశాలకు ఎగుమతి చేసే కోల్డ్ చైన్ కేంద్రం ద్వారా భారీ గెలలకు ఎక్కువ ధర.',
      en: 'Direct Gulf-export reefer container loading facility for Grand Naine heavy bunches.'
    }
  },
  onion: {
    name: { hi: 'प्याज', te: 'ఉల్లిపాయ', en: 'Onion' },
    icon: '🧅',
    destinationLocationId: 'kurnool',
    localMandi: { hi: 'धोने स्थानीय यार्ड', te: 'డోన్ స్థానిక యార్డ్', en: 'Dhone Local Yard' },
    localPrice: 1950,
    recommendedMandi: { hi: 'कर्नूल प्याज व कमोडिटी मंडी', te: 'కర్నూలు ఉల్లి మార్కెట్ యార్డ్', en: 'Kurnool Onion Yard' },
    destinationPrice: 2450,
    distanceKm: 45,
    reason: {
      hi: 'दक्षिण भारत का प्रमुख प्याज वितरण केंद्र; तमिलनाडु व केरल के खरीदार सक्रिय।',
      te: 'దక్షిణ భారత ఉల్లి కేంద్రం; తమిళనాడు, కేరళ వ్యాపారుల నిరంతర కొనుగోళ్లు.',
      en: 'Major South India distribution hub with direct traders from Tamil Nadu and Kerala.'
    }
  },
  paddy: {
    name: { hi: 'धान', te: 'వరి', en: 'Paddy' },
    icon: '🌾',
    destinationLocationId: 'vijayawada',
    localMandi: { hi: 'बापटला स्थानीय राइस यार्ड', te: 'బాపట్ల లోకల్ యార్డ్', en: 'Bapatla Local Yard' },
    localPrice: 2183,
    recommendedMandi: { hi: 'मिर्यालगुडा / नेल्लोर राइस टर्मिनल', te: 'మిర్యాలగూడ / నెల్లూరు రైస్ టెర్మినల్', en: 'Miryalaguda / Nellore Rice Terminal' },
    destinationPrice: 2450,
    distanceKm: 52,
    reason: {
      hi: 'आधुनिक राइस मिलों द्वारा बीपीटी (सांभा मसूरी) किस्म पर न्यूनतम समर्थन मूल्य से अधिक भुगतान।',
      te: 'ఆధునిక రైస్ మిల్లుల ద్వారా BPT సోనా మసూరికి మద్దతు ధర కంటే ఎక్కువ చెల్లింపు.',
      en: 'Modern automated parboiled mills offering premium above MSP for BPT fine grain.'
    }
  }
};

export const MandiLogisticsView: FC<MandiLogisticsViewProps> = ({
  currentLang,
  mandi,
  currentLocation
}) => {
  const t = translations[currentLang];
  const [selectedCropKey, setSelectedCropKey] = useState<string>(mandi.cropKey || 'chilli');
  const [productSearchInput, setProductSearchInput] = useState('');

  const currentIntel = PRODUCT_DESTINATION_INTELLIGENCE[selectedCropKey] || PRODUCT_DESTINATION_INTELLIGENCE['chilli'];

  const computeDistance = (cropKey: string) => {
    const intel = PRODUCT_DESTINATION_INTELLIGENCE[cropKey] || currentIntel;
    if (!currentLocation) return intel.distanceKm;
    if (currentLocation.id === intel.destinationLocationId) return 18;
    return calculateLocationDistanceKm(currentLocation.id, intel.destinationLocationId);
  };

  const [distanceKm, setDistanceKm] = useState(() => computeDistance(selectedCropKey));
  const [vehicle, setVehicle] = useState<'tractor' | 'pickup'>('tractor');
  const [loadQuintals, setLoadQuintals] = useState(50);

  useEffect(() => {
    setDistanceKm(computeDistance(selectedCropKey));
  }, [currentLocation?.id, selectedCropKey]);

  const effectiveLocalMandi = currentLocation ? currentLocation.mandiName[currentLang] : currentIntel.localMandi[currentLang];

  const handleProductSelect = (cropKey: string) => {
    setSelectedCropKey(cropKey);
    setDistanceKm(computeDistance(cropKey));
  };

  const handleProductSearch = (e: FormEvent) => {
    e.preventDefault();
    if (!productSearchInput.trim()) return;
    const q = productSearchInput.toLowerCase();
    const found = Object.keys(PRODUCT_DESTINATION_INTELLIGENCE).find((key) => {
      const item = PRODUCT_DESTINATION_INTELLIGENCE[key];
      return (
        key.includes(q) ||
        item.name[currentLang].toLowerCase().includes(q) ||
        item.name.en.toLowerCase().includes(q) ||
        item.recommendedMandi[currentLang].toLowerCase().includes(q)
      );
    });
    if (found) {
      handleProductSelect(found);
    }
  };

  // Calculations
  const ratePerKm = vehicle === 'tractor' ? 24 : 16;
  const baseFreight = distanceKm * 2 * ratePerKm; // round trip diesel & driver
  const localPrice = currentIntel.localPrice;
  const distantMandiPrice = currentIntel.destinationPrice;
  const priceDiffPerQt = Math.max(0, distantMandiPrice - localPrice);
  const grossGain = loadQuintals * priceDiffPerQt;
  const netProfit = grossGain - baseFreight;
  const isProfitable = netProfit > 500;

  return (
    <div className="logistics-view-container">
      {/* Header Strip */}
      <div className="view-header-strip">
        <div className="title-row">
          <Truck size={24} className="view-icon" />
          <h2 className="view-title">{t.logisticsTitle}</h2>
        </div>
        <p className="view-desc">
          {currentLocation
            ? (currentLang === 'hi'
                ? `📍 ${currentLocation.name[currentLang]} (${currentLocation.district[currentLang]}) से अन्य प्रमुख मंडियों तक माल भेजने का शुद्ध लाभ कैलकुलेटर`
                : currentLang === 'te'
                ? `📍 ${currentLocation.name[currentLang]} నుండి ఇతర ప్రధాన మార్కెట్లకు రవాణా చేసి అమ్మితే నికర లాభం విశ్లేషణ`
                : `📍 Net transport ROI calculator from ${currentLocation.name[currentLang]} (${currentLocation.district[currentLang]}) to major terminal mandis`)
            : t.logisticsDesc}
        </p>
      </div>

      {/* Product Search & Quick Selection Chips */}
      <div className="logistics-product-search-bar-wrap">
        <form onSubmit={handleProductSearch} className="logistics-search-form">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder={t.productSearchPlaceholder}
            value={productSearchInput}
            onChange={(e) => setProductSearchInput(e.target.value)}
            className="logistics-search-input"
          />
          <button type="submit" className="logistics-search-btn">
            {t.searchBtn}
          </button>
        </form>

        <div className="logistics-crop-chips-row">
          {CROP_CHIPS.map((chip) => {
            const isSelected = chip.key === selectedCropKey;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => handleProductSelect(chip.key)}
                className={`logistics-crop-chip ${isSelected ? 'active' : ''}`}
              >
                <span className="chip-emoji">{chip.icon}</span>
                <span className="chip-txt">{chip.name[currentLang]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recommendation Spotlight Banner */}
      <div className="recommended-destination-spotlight">
        <div className="spotlight-badge">
          <Sparkles size={16} />
          <span>{t.suggestedBestMandi}</span>
        </div>
        <div className="spotlight-content">
          <div className="spotlight-title-row">
            <span className="spotlight-crop-icon">{currentIntel.icon}</span>
            <div className="spotlight-mandi-info">
              <h3 className="spotlight-mandi-name">
                📍 {currentIntel.recommendedMandi[currentLang]} {currentLocation ? `(${distanceKm} km from ${currentLocation.name[currentLang]})` : ''}
              </h3>
              <p className="spotlight-reason">
                {currentIntel.reason[currentLang]}
              </p>
            </div>
            <div className="spotlight-price-pill">
              <span className="spotlight-price-num">₹{currentIntel.destinationPrice.toLocaleString()}</span>
              <span className="spotlight-price-unit">{t.quintalUnit}</span>
              <span className="spotlight-diff-tag">
                +₹{currentIntel.destinationPrice - currentIntel.localPrice} {t.quintalUnit} Higher
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="logistics-grid">
        {/* Left Config Card */}
        <div className="logistics-config-card">
          <h3 className="card-subtitle">
            <Calculator size={18} />
            <span>
              {currentLang === 'hi' ? 'परिवहन विवरण दर्ज करें' : currentLang === 'te' ? 'రవాణా వివరాలు' : 'Enter Transport Details'}
            </span>
          </h3>

          {/* Vehicle Type */}
          <div className="form-group">
            <label className="form-label">{t.vehicleLabel}</label>
            <div className="vehicle-choice-row">
              <button
                type="button"
                onClick={() => {
                  setVehicle('tractor');
                  setLoadQuintals(50);
                }}
                className={`vehicle-btn ${vehicle === 'tractor' ? 'active' : ''}`}
              >
                <span className="v-icon">🚜</span>
                <span className="v-name">{t.tractorVehicle}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setVehicle('pickup');
                  setLoadQuintals(25);
                }}
                className={`vehicle-btn ${vehicle === 'pickup' ? 'active' : ''}`}
              >
                <span className="v-icon">🛻</span>
                <span className="v-name">{t.pickupVehicle}</span>
              </button>
            </div>
          </div>

          {/* Distance Slider */}
          <div className="form-group">
            <div className="label-val-row">
              <label className="form-label">{t.distanceLabel}</label>
              <span className="highlight-val">{distanceKm} km</span>
            </div>
            <input
              type="range"
              min={10}
              max={150}
              step={5}
              value={distanceKm}
              onChange={(e) => setDistanceKm(Number(e.target.value))}
              className="range-slider"
            />
            <div className="slider-markers">
              <span>10 km</span>
              <span>{currentIntel.distanceKm} km ({currentIntel.recommendedMandi[currentLang].split(' ')[0]})</span>
              <span>100 km</span>
              <span>150 km</span>
            </div>
          </div>

          {/* Load Quantity */}
          <div className="form-group">
            <label className="form-label">
              {currentLang === 'hi' ? 'फसल की मात्रा (क्विंटल):' : currentLang === 'te' ? 'సరుకు పరిమాణం (క్వింటాళ్లు):' : 'Quantity to Transport (Quintals):'}
            </label>
            <input
              type="number"
              value={loadQuintals}
              onChange={(e) => setLoadQuintals(Math.max(5, Number(e.target.value)))}
              className="form-input"
              min={5}
              max={200}
            />
          </div>
        </div>

        {/* Right ROI Result Card */}
        <div className="logistics-roi-card">
          <h3 className="card-subtitle">
            <DollarSign size={18} />
            <span>
              {currentLang === 'hi' ? 'शुद्ध लाभ विश्लेषण (ROI Report)' : currentLang === 'te' ? 'నికర లాభ నివేదిక' : 'Net Take-Home ROI Analysis'}
            </span>
          </h3>

          <div className="comparison-rates-box">
            <div className="cmp-column local">
              <span className="cmp-badge">
                {currentLang === 'hi' ? 'स्थानीय मंडी' : currentLang === 'te' ? 'స్థానిక మార్కెట్' : 'Local Mandi'}
              </span>
              <span className="cmp-name">📍 {effectiveLocalMandi}</span>
              <span className="cmp-price">₹{localPrice.toLocaleString()} {t.quintalUnit}</span>
            </div>
            <div className="cmp-arrow">
              <ArrowRight size={20} />
            </div>
            <div className="cmp-column distant">
              <span className="cmp-badge distant">
                {currentLang === 'hi' ? 'अनुशंसित मंडी' : currentLang === 'te' ? 'సిఫార్సు చేసిన మార్కెట్' : 'Recommended Mandi'}
              </span>
              <span className="cmp-name">{currentIntel.recommendedMandi[currentLang]}</span>
              <span className="cmp-price">₹{distantMandiPrice.toLocaleString()} {t.quintalUnit}</span>
            </div>
          </div>

          <div className="roi-metrics-list">
            <div className="metric-row">
              <span className="m-label">{t.priceGainLabel} ({loadQuintals} qt × +₹{priceDiffPerQt})</span>
              <span className="m-val positive">+₹{grossGain.toLocaleString()}</span>
            </div>
            <div className="metric-row">
              <span className="m-label">
                {t.freightCostLabel} ({distanceKm * 2} km {currentLang === 'hi' ? 'राउंड ट्रिप' : currentLang === 'te' ? 'రౌండ్ ట్రిప్' : 'round trip'})
              </span>
              <span className="m-val negative">-₹{baseFreight.toLocaleString()}</span>
            </div>
            <div className="metric-row total">
              <span className="m-label">{t.netRoiLabel}</span>
              <span className={`m-val ${netProfit > 0 ? 'profit' : 'loss'}`}>
                {netProfit >= 0 ? `+₹${netProfit.toLocaleString()}` : `-₹${Math.abs(netProfit).toLocaleString()}`}
              </span>
            </div>
          </div>

          {/* Decision Verdict Banner */}
          <div className={`decision-banner ${isProfitable ? 'profitable' : 'unprofitable'}`}>
            {isProfitable ? (
              <>
                <CheckCircle2 size={24} className="verdict-icon success" />
                <div className="verdict-text">
                  <strong>{t.profitableDecision}</strong>
                  <p>
                    {currentLang === 'hi'
                      ? `भाड़ा काटकर भी आपको ₹${netProfit.toLocaleString()} की शुद्ध अतिरिक्त बचत होगी।`
                      : currentLang === 'te'
                      ? `రవాణా ఖర్చు తీసివేసినా మీకు ₹${netProfit.toLocaleString()} అదనపు నికర లాభం వస్తుంది.`
                      : `After deducting transport freight, you take home an extra ₹${netProfit.toLocaleString()}.`}
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle size={24} className="verdict-icon warning" />
                <div className="verdict-text">
                  <strong>{t.localBetterDecision}</strong>
                  <p>
                    {currentLang === 'hi'
                      ? 'डीजल व समय का खर्च अतिरिक्त भाव से अधिक है। स्थानीय यार्ड में ही बेचें।'
                      : currentLang === 'te'
                      ? 'రవాణా ఖర్చు ధర పెరుగుదల కంటే ఎక్కువగా ఉంది. స్థానిక యార్డ్ ఉత్తమం.'
                      : 'Transport diesel cost exceeds price gain. Selling locally saves money.'}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
