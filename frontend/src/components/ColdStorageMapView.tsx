import { useState, useEffect, type FC, type FormEvent } from 'react';
import type { Language, ColdStorageFacility, LocationOption } from '../types';
import { COLD_STORAGES, calculateLocationDistanceKm } from '../data/mockData';
import { translations } from '../data/i18n';
import {
  Warehouse,
  Search,
  PhoneCall,
  CheckCircle2,
  ShieldCheck,
  ThermometerSnowflake,
  MapPin,
  TrendingUp,
  Compass,
  Navigation,
  Layers,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

interface ColdStorageMapViewProps {
  currentLang: Language;
  currentLocation?: LocationOption;
  onOpenHelpline: (num: string) => void;
  onOpenBookingGate: (facilityName: string) => void;
}

type MapPointType = 'all' | 'storage' | 'mandi';

interface MapPinItem {
  id: string;
  locationId: string;
  type: 'storage' | 'mandi';
  name: Record<Language, string>;
  location: Record<Language, string>;
  coords: { x: number; y: number }; // percentage on SVG
  distanceKm: number;
  highlightText: string;
  contactPhone: string;
  storageRef?: ColdStorageFacility;
  mandiPrice?: number;
  cropName?: Record<Language, string>;
}

export const ColdStorageMapView: FC<ColdStorageMapViewProps> = ({
  currentLang,
  currentLocation,
  onOpenHelpline,
  onOpenBookingGate
}) => {
  const t = translations[currentLang];
  const [mapQuery, setMapQuery] = useState('');
  const [selectedRadius, setSelectedRadius] = useState<number>(100);
  const [filterType, setFilterType] = useState<MapPointType>('all');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [activePinId, setActivePinId] = useState<string>('cs-guntur-1');

  // Unified Map Pins Dataset (Both Mandis and Cold Storages)
  const baseMapPins: MapPinItem[] = [
    // Cold Storages
    {
      id: 'cs-guntur-1',
      locationId: 'guntur',
      type: 'storage',
      name: COLD_STORAGES[0].name,
      location: COLD_STORAGES[0].location,
      coords: { x: 67, y: 44 },
      distanceKm: COLD_STORAGES[0].distanceKm,
      highlightText: `${COLD_STORAGES[0].vacantCapacityBags.toLocaleString()} ${t.bagsUnit} vacant`,
      contactPhone: COLD_STORAGES[0].contactPhone,
      storageRef: COLD_STORAGES[0]
    },
    {
      id: 'cs-amaravati-2',
      locationId: 'guntur',
      type: 'storage',
      name: COLD_STORAGES[1].name,
      location: COLD_STORAGES[1].location,
      coords: { x: 72, y: 38 },
      distanceKm: COLD_STORAGES[1].distanceKm,
      highlightText: `${COLD_STORAGES[1].vacantCapacityBags.toLocaleString()} ${t.bagsUnit} vacant`,
      contactPhone: COLD_STORAGES[1].contactPhone,
      storageRef: COLD_STORAGES[1]
    },
    {
      id: 'cs-mirchi-yard-3',
      locationId: 'guntur',
      type: 'storage',
      name: COLD_STORAGES[2].name,
      location: COLD_STORAGES[2].location,
      coords: { x: 65, y: 46 },
      distanceKm: COLD_STORAGES[2].distanceKm,
      highlightText: `${COLD_STORAGES[2].vacantCapacityBags.toLocaleString()} ${t.bagsUnit} vacant`,
      contactPhone: COLD_STORAGES[2].contactPhone,
      storageRef: COLD_STORAGES[2]
    },
    {
      id: 'cs-anantapur-4',
      locationId: 'anantapur',
      type: 'storage',
      name: COLD_STORAGES[3].name,
      location: COLD_STORAGES[3].location,
      coords: { x: 30, y: 64 },
      distanceKm: COLD_STORAGES[3].distanceKm,
      highlightText: `${COLD_STORAGES[3].vacantCapacityBags.toLocaleString()} ${t.bagsUnit} vacant`,
      contactPhone: COLD_STORAGES[3].contactPhone,
      storageRef: COLD_STORAGES[3]
    },
    {
      id: 'cs-madanapalle-5',
      locationId: 'chittoor',
      type: 'storage',
      name: COLD_STORAGES[4].name,
      location: COLD_STORAGES[4].location,
      coords: { x: 42, y: 88 },
      distanceKm: COLD_STORAGES[4].distanceKm,
      highlightText: `${COLD_STORAGES[4].vacantCapacityBags.toLocaleString()} ${t.bagsUnit} vacant`,
      contactPhone: COLD_STORAGES[4].contactPhone,
      storageRef: COLD_STORAGES[4]
    },
    {
      id: 'cs-kadapa-6',
      locationId: 'kadapa',
      type: 'storage',
      name: COLD_STORAGES[5].name,
      location: COLD_STORAGES[5].location,
      coords: { x: 48, y: 72 },
      distanceKm: COLD_STORAGES[5].distanceKm,
      highlightText: `${COLD_STORAGES[5].vacantCapacityBags.toLocaleString()} ${t.bagsUnit} vacant`,
      contactPhone: COLD_STORAGES[5].contactPhone,
      storageRef: COLD_STORAGES[5]
    },
    {
      id: 'cs-kurnool-7',
      locationId: 'kurnool',
      type: 'storage',
      name: COLD_STORAGES[6].name,
      location: COLD_STORAGES[6].location,
      coords: { x: 38, y: 38 },
      distanceKm: COLD_STORAGES[6].distanceKm,
      highlightText: `${COLD_STORAGES[6].vacantCapacityBags.toLocaleString()} ${t.bagsUnit} vacant`,
      contactPhone: COLD_STORAGES[6].contactPhone,
      storageRef: COLD_STORAGES[6]
    },
    {
      id: 'cs-warangal-8',
      locationId: 'warangal',
      type: 'storage',
      name: COLD_STORAGES[7].name,
      location: COLD_STORAGES[7].location,
      coords: { x: 64, y: 20 },
      distanceKm: COLD_STORAGES[7].distanceKm,
      highlightText: `${COLD_STORAGES[7].vacantCapacityBags.toLocaleString()} ${t.bagsUnit} vacant`,
      contactPhone: COLD_STORAGES[7].contactPhone,
      storageRef: COLD_STORAGES[7]
    },
    {
      id: 'cs-vijayawada-9',
      locationId: 'vijayawada',
      type: 'storage',
      name: COLD_STORAGES[8].name,
      location: COLD_STORAGES[8].location,
      coords: { x: 74, y: 44 },
      distanceKm: COLD_STORAGES[8].distanceKm,
      highlightText: `${COLD_STORAGES[8].vacantCapacityBags.toLocaleString()} ${t.bagsUnit} vacant`,
      contactPhone: COLD_STORAGES[8].contactPhone,
      storageRef: COLD_STORAGES[8]
    },
    // Mandi Yards
    {
      id: 'mandi-guntur',
      locationId: 'guntur',
      type: 'mandi',
      name: { hi: 'गुंटूर मिर्ची यार्ड (APMC)', te: 'గుంటూరు మిర్చి యార్డ్ (APMC)', en: 'Guntur Mirchi Yard (APMC)' },
      location: { hi: 'गुंटूर, आंध्र प्रदेश', te: 'గుంటూరు, ఆంధ్రప్రదేశ్', en: 'Guntur, Andhra Pradesh' },
      coords: { x: 69, y: 46 },
      distanceKm: 4,
      highlightText: '₹14,200/qt Modal',
      contactPhone: '0863-2234011',
      mandiPrice: 14200,
      cropName: { hi: 'मिर्च', te: 'మిర్చి', en: 'Chilli' }
    },
    {
      id: 'mandi-anantapur',
      locationId: 'anantapur',
      type: 'mandi',
      name: { hi: 'अनंतपुर मूंगफली यार्ड (APMC)', te: 'అనంతపురం మార్కెట్ యార్డ్', en: 'Anantapur Agri Market Yard' },
      location: { hi: 'अनंतपुर, आंध्र प्रदेश', te: 'అనంతపురం, ఆంధ్రప్రదేశ్', en: 'Anantapur, Andhra Pradesh' },
      coords: { x: 28, y: 62 },
      distanceKm: 12,
      highlightText: '₹7,850/qt Modal',
      contactPhone: '08554-240011',
      mandiPrice: 7850,
      cropName: { hi: 'मूंगफली', te: 'వేరుశనగ', en: 'Groundnut' }
    },
    {
      id: 'mandi-madanapalle',
      locationId: 'chittoor',
      type: 'mandi',
      name: { hi: 'मदनपल्ले एशिया टमाटर मंडी', te: 'మదనపల్లె టమోటా మార్కెట్', en: 'Madanapalle Tomato Yard' },
      location: { hi: 'चित्तूर जिला, आंध्र प्रदेश', te: 'చిత్తూరు జిల్లా, ఆంధ్రప్రదేశ్', en: 'Chittoor District, AP' },
      coords: { x: 40, y: 90 },
      distanceKm: 18,
      highlightText: '₹3,250/qt Modal',
      contactPhone: '08571-220022',
      mandiPrice: 3250,
      cropName: { hi: 'टमाटर', te: 'టమోటా', en: 'Tomato' }
    },
    {
      id: 'mandi-kadapa',
      locationId: 'kadapa',
      type: 'mandi',
      name: { hi: 'कडपा (कृष्णा नगर) यार्ड', te: 'కడప (కృష్ణా నగర్) మార్కెట్', en: 'Kadapa (Krishna Nagar) Market' },
      location: { hi: 'कडपा, आंध्र प्रदेश', te: 'కడప, ఆంధ్రప్రదేశ్', en: 'Kadapa, Andhra Pradesh' },
      coords: { x: 50, y: 70 },
      distanceKm: 10,
      highlightText: '₹16,500/qt Modal',
      contactPhone: '08562-241100',
      mandiPrice: 16500,
      cropName: { hi: 'हल्दी व केला', te: 'పసుపు & అరటి', en: 'Turmeric & Banana' }
    },
    {
      id: 'mandi-kurnool',
      locationId: 'kurnool',
      type: 'mandi',
      name: { hi: 'कर्नूल प्याज व कपास यार्ड', te: 'కర్నూలు ఉల్లి & పత్తి మార్కెట్', en: 'Kurnool Onion & Cotton Yard' },
      location: { hi: 'कर्नूल, आंध्र प्रदेश', te: 'కర్నూలు, ఆంధ్రప్రదేశ్', en: 'Kurnool, Andhra Pradesh' },
      coords: { x: 38, y: 40 },
      distanceKm: 25,
      highlightText: '₹2,450/qt Modal',
      contactPhone: '08518-220055',
      mandiPrice: 2450,
      cropName: { hi: 'प्याज व कपास', te: 'ఉల్లి & పత్తి', en: 'Onion & Cotton' }
    },
    {
      id: 'mandi-adoni',
      locationId: 'adoni',
      type: 'mandi',
      name: { hi: 'अदोनी कपास जिनिंग यार्ड', te: 'ఆదోని పత్తి మార్కెట్', en: 'Adoni Cotton Market' },
      location: { hi: 'कर्नूल जिला, आंध्र प्रदेश', te: 'కర్నూలు జిల్లా, ఆంధ్రప్రదేశ్', en: 'Kurnool District, AP' },
      coords: { x: 22, y: 36 },
      distanceKm: 42,
      highlightText: '₹7,650/qt Modal',
      contactPhone: '08512-250088',
      mandiPrice: 7650,
      cropName: { hi: 'कपास', te: 'పత్తి', en: 'Cotton' }
    }
  ];

  // Dynamic distance calculation relative to currentLocation
  const mapPins: MapPinItem[] = baseMapPins.map((pin) => {
    if (!currentLocation) return pin;
    const isSameTown = pin.locationId === currentLocation.id;
    let dist = 0;
    if (isSameTown) {
      dist = pin.type === 'storage' ? (pin.storageRef?.distanceKm || 6) : 0;
    } else {
      dist = calculateLocationDistanceKm(currentLocation.id, pin.locationId);
    }
    return {
      ...pin,
      distanceKm: dist
    };
  });

  // Automatically select nearest facility when currentLocation changes
  useEffect(() => {
    if (currentLocation) {
      const sorted = [...mapPins].sort((a, b) => a.distanceKm - b.distanceKm);
      if (sorted.length > 0) {
        setActivePinId(sorted[0].id);
      }
    }
  }, [currentLocation?.id]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
  };

  const filteredPins = mapPins.filter((pin) => {
    const matchesType = filterType === 'all' || pin.type === filterType;
    const matchesRadius = pin.distanceKm <= selectedRadius;
    const q = mapQuery.toLowerCase().trim();
    const matchesQuery =
      q === '' ||
      pin.name[currentLang].toLowerCase().includes(q) ||
      pin.name.en.toLowerCase().includes(q) ||
      pin.location[currentLang].toLowerCase().includes(q) ||
      pin.location.en.toLowerCase().includes(q);

    return matchesType && matchesRadius && matchesQuery;
  });

  const activePin = mapPins.find((p) => p.id === activePinId) || filteredPins[0] || mapPins[0];

  return (
    <div className="storage-map-view-container">
      {/* Header Strip */}
      <div className="view-header-strip">
        <div className="title-row">
          <Warehouse size={24} className="view-icon" />
          <h2 className="view-title">{t.storageTitle}</h2>
        </div>
        <p className="view-desc">
          {currentLocation
            ? (currentLang === 'hi'
                ? `📍 ${currentLocation.name[currentLang]} (${currentLocation.district[currentLang]}) के निकटतम कोल्ड स्टोरेज, वेयरहाउस एवं एपीएमसी अनाज व फल मंडी यार्ड का लाइव नक्शा`
                : currentLang === 'te'
                ? `📍 ${currentLocation.name[currentLang]} సమీపంలోని కోల్డ్ స్టోరేజీలు, గోదాములు & మార్కెట్ యార్డుల సమగ్ర మ్యాప్`
                : `📍 Interactive map of Cold Storages & APMC Market Yards nearest to ${currentLocation.name[currentLang]} (${currentLocation.district[currentLang]})`)
            : (currentLang === 'hi'
                ? 'अपने क्षेत्र के कोल्ड स्टोरेज, वेयरहाउस एवं एपीएमसी अनाज व फल मंडी यार्ड का लाइव नक्शा'
                : currentLang === 'te'
                ? 'మీ ప్రాంతంలోని కోల్డ్ స్టోరేజీలు, గోదాములు & మార్కెట్ యార్డుల సమగ్ర మ్యాప్'
                : 'Interactive Regional Map of Cold Storages, Godowns & APMC Market Yards with Real Vacancy')}
        </p>
      </div>

      {/* Control Bar: Search, Category Filter, and Radius */}
      <div className="map-search-control-bar">
        <form onSubmit={handleSearchSubmit} className="map-search-form">
          <Search size={18} className="map-search-icon" />
          <input
            type="text"
            placeholder={t.storageMapSearchPlaceholder}
            value={mapQuery}
            onChange={(e) => setMapQuery(e.target.value)}
            className="map-search-input"
          />
          <button type="submit" className="map-search-btn">
            {t.searchBtn}
          </button>
        </form>

        {/* Category Tabs: All / Cold Storages / APMC Mandis */}
        <div className="map-category-tabs">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`map-cat-btn ${filterType === 'all' ? 'active' : ''}`}
          >
            <Layers size={14} />
            <span>
              {currentLang === 'hi' ? 'सभी केंद्र' : currentLang === 'te' ? 'అన్నీ' : 'All Points'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('storage')}
            className={`map-cat-btn ${filterType === 'storage' ? 'active' : ''}`}
          >
            <Warehouse size={14} />
            <span>
              {currentLang === 'hi' ? 'कोल्ड स्टोरेज' : currentLang === 'te' ? 'కోల్డ్ స్టోరేజ్' : 'Cold Storages'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('mandi')}
            className={`map-cat-btn ${filterType === 'mandi' ? 'active' : ''}`}
          >
            <TrendingUp size={14} />
            <span>
              {currentLang === 'hi' ? 'मंडी यार्ड' : currentLang === 'te' ? 'మార్కెట్ యార్డులు' : 'APMC Mandis'}
            </span>
          </button>
        </div>

        {/* Radius Filter */}
        <div className="radius-picker">
          <span className="radius-label">
            {currentLang === 'hi' ? 'दूरी:' : currentLang === 'te' ? 'పరిధి:' : 'Radius:'}
          </span>
          {[20, 50, 100, 200].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setSelectedRadius(r)}
              className={`radius-pill ${selectedRadius === r ? 'active' : ''}`}
            >
              {r} km
            </button>
          ))}
        </div>
      </div>

      {/* Correctly-Fitted Interactive Regional Vector Map */}
      <div className="storage-map-canvas-frame">
        <div className="map-canvas-viewport" style={{ transform: `scale(${zoomLevel})` }}>
          {/* Topographic Background Overlay */}
          <svg className="map-svg-background" viewBox="0 0 1000 650" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="mapBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1E371C" />
                <stop offset="50%" stopColor="#152B14" />
                <stop offset="100%" stopColor="#0F1F0E" />
              </linearGradient>
              <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" />
              </pattern>
            </defs>

            {/* Base Terrain Surface */}
            <rect width="1000" height="650" fill="url(#mapBgGrad)" rx="16" />
            <rect width="1000" height="650" fill="url(#gridPattern)" />

            {/* Regional State Boundaries (Andhra Pradesh & Rayalaseema Basin Outline) */}
            <path
              d="M 180,180 Q 320,160 550,120 Q 720,180 850,280 Q 820,420 740,540 Q 620,620 400,600 Q 220,560 160,420 Z"
              fill="rgba(45, 90, 39, 0.15)"
              stroke="rgba(82, 168, 70, 0.3)"
              strokeWidth="2"
              strokeDasharray="6 4"
            />

            {/* National Highways & Freight Corridors */}
            {/* NH-44 Corridor: Hyderabad -> Kurnool -> Anantapur -> Bengaluru */}
            <path
              d="M 380,80 L 380,260 L 300,410 L 320,580"
              fill="none"
              stroke="rgba(245, 158, 11, 0.45)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* NH-16 Coastal Corridor: Vijayawada -> Guntur -> Ongole -> Chennai */}
            <path
              d="M 720,240 L 680,290 L 690,440 L 650,580"
              fill="none"
              stroke="rgba(59, 130, 246, 0.45)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* NH-40 Rayalaseema Express: Kurnool -> Kadapa -> Chittoor */}
            <path
              d="M 380,260 Q 450,380 490,460 L 420,580"
              fill="none"
              stroke="rgba(16, 185, 129, 0.45)"
              strokeWidth="3.5"
              strokeDasharray="8 4"
            />

            {/* Highway Corridor Labels */}
            <text x="325" y="320" fill="rgba(245, 158, 11, 0.7)" fontSize="12" fontWeight="bold">NH-44 Corridor</text>
            <text x="695" y="360" fill="rgba(59, 130, 246, 0.7)" fontSize="12" fontWeight="bold">NH-16 Coastal Freight</text>
            <text x="440" y="420" fill="rgba(16, 185, 129, 0.7)" fontSize="12" fontWeight="bold">NH-40 Rayalaseema Line</text>

            {/* Regional Hub Names */}
            <text x="210" y="415" fill="#A7D49B" fontSize="13" fontWeight="600">Anantapur (515001)</text>
            <text x="480" y="490" fill="#A7D49B" fontSize="13" fontWeight="600">Kadapa / Krishna Nagar (516001)</text>
            <text x="340" y="595" fill="#A7D49B" fontSize="13" fontWeight="600">Chittoor / Madanapalle (517001)</text>
            <text x="660" y="305" fill="#A7D49B" fontSize="13" fontWeight="600">Guntur Mirchi Basin (522001)</text>
            <text x="310" y="255" fill="#A7D49B" fontSize="13" fontWeight="600">Kurnool / Adoni Basin (518001)</text>
          </svg>

          {/* Interactive Pins Overlay */}
          <div className="map-pins-container">
            {filteredPins.map((pin) => {
              const isSelected = pin.id === activePin.id;
              const isStorage = pin.type === 'storage';

              return (
                <div
                  key={pin.id}
                  onClick={() => setActivePinId(pin.id)}
                  className={`map-interactive-pin ${pin.type} ${isSelected ? 'selected' : ''}`}
                  style={{
                    left: `${pin.coords.x}%`,
                    top: `${pin.coords.y}%`
                  }}
                >
                  <div className="pin-marker-body">
                    {isStorage ? <Warehouse size={13} /> : <TrendingUp size={13} />}
                  </div>
                  <div className="pin-popup-pill">
                    <span className="pill-name">{pin.name[currentLang].split(' ')[0]}</span>
                    <span className="pill-detail">{pin.highlightText}</span>
                  </div>
                </div>
              );
            })}

            {/* Dynamic User Location Pin */}
            <div className="map-user-farm-pin" style={{ left: '55%', top: '56%' }}>
              <div className="farm-pulse-ring" />
              <div className="farm-pin-icon">
                <MapPin size={15} />
              </div>
              <span className="farm-pin-badge">
                📍 {currentLang === 'hi' ? 'आपका खेत' : currentLang === 'te' ? 'మీ పొలం' : 'Your Location'}
              </span>
            </div>
          </div>
        </div>

        {/* Floating Zoom & Compass Controls */}
        <div className="map-floating-controls">
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(1.4, z + 0.1))}
            className="map-ctrl-btn"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(0.85, z - 0.1))}
            className="map-ctrl-btn"
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel(1)}
            className="map-ctrl-btn reset"
            title="Reset Map Fit"
          >
            <Compass size={16} />
          </button>
        </div>

        {/* Map Legend */}
        <div className="map-legend-strip">
          <div className="legend-item">
            <span className="legend-color storage" />
            <span>{currentLang === 'hi' ? 'कोल्ड स्टोरेज (शीतगृह)' : currentLang === 'te' ? 'కోల్డ్ స్టోరేజ్' : 'Cold Storage'}</span>
          </div>
          <div className="legend-item">
            <span className="legend-color mandi" />
            <span>{currentLang === 'hi' ? 'एपीएमसी मंडी यार्ड' : currentLang === 'te' ? 'మార్కెట్ యార్డ్' : 'APMC Mandi'}</span>
          </div>
          <div className="legend-item">
            <span className="legend-color corridor" />
            <span>{currentLang === 'hi' ? 'प्रमुख कृषि राजमार्ग' : currentLang === 'te' ? 'రవాణా రహదారులు' : 'Agri Highways'}</span>
          </div>
        </div>
      </div>

      {/* Selected Facility / Mandi Spotlight Inspection Card */}
      <div className="selected-facility-spotlight-card">
        <div className="spotlight-header">
          <div className="s-type-badge-row">
            <span className={`s-type-pill ${activePin.type}`}>
              {activePin.type === 'storage' ? <Warehouse size={14} /> : <TrendingUp size={14} />}
              {activePin.type === 'storage'
                ? (currentLang === 'hi' ? 'कोल्ड स्टोरेज' : currentLang === 'te' ? 'కోల్డ్ స్టోరేజ్' : 'Cold Storage Facility')
                : (currentLang === 'hi' ? 'सरकारी मंडी यार्ड' : currentLang === 'te' ? 'ప్రభుత్వ మార్కెట్' : 'APMC Market Yard')}
            </span>
            <span className="s-dist-pill">
              <Navigation size={13} />
              {activePin.distanceKm} km {currentLang === 'hi' ? 'दूरी' : currentLang === 'te' ? 'దూరం' : 'away'}
            </span>
          </div>
          <h3 className="s-facility-name">{activePin.name[currentLang]}</h3>
          <p className="s-facility-loc">📍 {activePin.location[currentLang]}</p>
        </div>

        {/* Dynamic Storage Meter or Mandi Rate Details */}
        {activePin.storageRef && (
          <div className="spotlight-storage-metrics">
            <div className="storage-meter-row">
              <div className="meter-label-left">
                <span className="m-title">{t.vacantBagsLabel}</span>
                <strong className="m-val">
                  {activePin.storageRef.vacantCapacityBags.toLocaleString()} / {activePin.storageRef.totalCapacityBags.toLocaleString()} {t.bagsUnit}
                </strong>
              </div>
              <span className="meter-percent">
                {Math.round((activePin.storageRef.vacantCapacityBags / activePin.storageRef.totalCapacityBags) * 100)}% {t.spaceFree}
              </span>
            </div>
            <div className="s-progress-track">
              <div
                className="s-progress-fill"
                style={{ width: `${Math.round((activePin.storageRef.vacantCapacityBags / activePin.storageRef.totalCapacityBags) * 100)}%` }}
              />
            </div>
            <div className="storage-tags-row">
              <span className="s-rent-tag">
                💰 ₹{activePin.storageRef.rentPerBagPerMonth} {currentLang === 'hi' ? '/ बोरी/माह' : currentLang === 'te' ? '/ బస్తాకు/నెలకు' : '/ bag/mo'}
              </span>
              {activePin.storageRef.temperatureControlled && (
                <span className="s-feat-chip">
                  <ThermometerSnowflake size={12} /> Temp Controlled
                </span>
              )}
              {activePin.storageRef.hasFumigation && (
                <span className="s-feat-chip">
                  <ShieldCheck size={12} /> Certified Fumigation
                </span>
              )}
            </div>
          </div>
        )}

        {activePin.mandiPrice && (
          <div className="spotlight-mandi-metrics">
            <div className="mandi-price-badge-box">
              <span className="mp-label">{t.commonModalBadge} ({activePin.cropName?.[currentLang]}):</span>
              <span className="mp-rate">₹{activePin.mandiPrice.toLocaleString()} {t.quintalUnit}</span>
            </div>
            <span className="e-nam-tag">
              <CheckCircle2 size={13} /> {t.enamVerified}
            </span>
          </div>
        )}

        {/* Direct Action Dialers */}
        <div className="spotlight-actions-row">
          <button
            type="button"
            onClick={() => onOpenHelpline(activePin.contactPhone)}
            className="s-call-btn"
          >
            <PhoneCall size={16} />
            <span>{activePin.contactPhone}</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenBookingGate(activePin.name[currentLang])}
            className="s-book-btn"
          >
            <CheckCircle2 size={16} />
            <span>{activePin.type === 'storage' ? t.bookStorageBtn : t.shareWhatsapp}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
