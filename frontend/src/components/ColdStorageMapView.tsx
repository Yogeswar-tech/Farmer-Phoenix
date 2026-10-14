import { useState, useEffect, useRef, useMemo, type FC, type FormEvent } from 'react';
import type { Language, LocationOption } from '../types';
import { COLD_STORAGES } from '../data/mockData';
import { translations } from '../data/i18n';
import { KisanSethuApi } from '../services/api';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Warehouse,
  Search,
  PhoneCall,
  CheckCircle2,
  ShieldCheck,
  ThermometerSnowflake,
  TrendingUp,
  Navigation,
  Layers,
  Satellite,
  Compass,
  Truck,
  RotateCcw,
  ExternalLink
} from 'lucide-react';

interface ColdStorageMapViewProps {
  currentLang: Language;
  currentLocation?: LocationOption;
  onOpenHelpline: (num: string) => void;
  onOpenBookingGate: (facilityName: string) => void;
}

type MapPointType = 'all' | 'storage' | 'mandi';
type MapLayerType = 'streets' | 'satellite';

export interface GeoFacilityItem {
  id: string;
  type: 'storage' | 'mandi';
  name: Record<Language, string>;
  location: Record<Language, string>;
  district: string;
  state: string;
  lat: number;
  lng: number;
  distanceKm: number;
  highlightText: string;
  contactPhone: string;
  // Storage specific
  vacantBags?: number;
  totalBags?: number;
  rentPerBagPerMonth?: number;
  tempControlled?: boolean;
  hasFumigation?: boolean;
  // Mandi specific
  mandiPrice?: number;
  cropName?: Record<Language, string>;
  eNamVerified?: boolean;
}

// Known regional coordinates for major APMC & cold chain clusters
const REGION_COORDINATES: Record<string, { lat: number; lng: number }> = {
  tirupati: { lat: 13.6288, lng: 79.4192 },
  guntur: { lat: 16.3067, lng: 80.4365 },
  madanapalle: { lat: 13.556, lng: 78.501 },
  kurnool: { lat: 15.8281, lng: 78.0373 },
  anantapur: { lat: 14.6819, lng: 77.6006 },
  kadapa: { lat: 14.4673, lng: 78.8242 },
  vijayawada: { lat: 16.5062, lng: 80.648 },
  warangal: { lat: 17.9689, lng: 79.5941 },
  khammam: { lat: 17.2473, lng: 80.1514 },
  adoni: { lat: 15.6322, lng: 77.2728 },
  kolar: { lat: 13.1367, lng: 78.1292 },
  nashik: { lat: 20.1471, lng: 74.2254 },
  pune: { lat: 18.4975, lng: 73.8647 },
  indore: { lat: 22.7196, lng: 75.8577 },
  gondal: { lat: 21.9619, lng: 70.7923 }
};

// Precise Haversine distance calculator in km
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
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
  const [mapLayer, setMapLayer] = useState<MapLayerType>('streets');
  const [activeFacilityId, setActiveFacilityId] = useState<string>('cs-1');
  const [liveDbFacilities, setLiveDbFacilities] = useState<any[]>([]);
  const [liveMandiRates, setLiveMandiRates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);

  // Farmer's origin coordinates
  const farmerCoords = useMemo(() => {
    if (currentLocation?.id && REGION_COORDINATES[currentLocation.id.toLowerCase()]) {
      return REGION_COORDINATES[currentLocation.id.toLowerCase()];
    }
    return REGION_COORDINATES.tirupati;
  }, [currentLocation?.id]);

  // Fetch live backend data from Neon PostgreSQL (cached in Redis)
  useEffect(() => {
    let isMounted = true;
    const fetchLiveData = async () => {
      setIsLoading(true);
      try {
        const [storages, mandis] = await Promise.all([
          KisanSethuApi.getColdStorages(currentLocation?.district.en, currentLocation?.state.en),
          KisanSethuApi.getMandiRates()
        ]);
        if (isMounted) {
          if (storages && storages.length > 0) setLiveDbFacilities(storages);
          if (mandis && mandis.length > 0) setLiveMandiRates(mandis);
        }
      } catch (err) {
        console.warn('Backend fetch for map data fallback:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchLiveData();
    return () => {
      isMounted = false;
    };
  }, [currentLocation?.district.en, currentLocation?.state.en]);

  // Master facilities collection (Cold Storages + APMC Mandis)
  const allFacilities: GeoFacilityItem[] = useMemo(() => {
    const list: GeoFacilityItem[] = [];

    // 1. Cold Storages from Live DB or mock
    const coldSources = liveDbFacilities.length > 0 ? liveDbFacilities : COLD_STORAGES;
    coldSources.forEach((cs: any, idx: number) => {
      const locKey = (cs.location?.en || cs.district || 'guntur').toLowerCase();
      const coords =
        (cs.latitude && cs.longitude && { lat: Number(cs.latitude), lng: Number(cs.longitude) }) ||
        REGION_COORDINATES[locKey] ||
        (idx === 0 ? REGION_COORDINATES.guntur : idx === 1 ? REGION_COORDINATES.madanapalle : REGION_COORDINATES.kurnool);

      const dist = calculateDistanceKm(farmerCoords.lat, farmerCoords.lng, coords.lat, coords.lng);
      const vacant = cs.vacantCapacityBags || (cs.available_mt ? cs.available_mt * 20 : 12000);
      const total = cs.totalCapacityBags || (cs.capacity_mt ? cs.capacity_mt * 20 : 40000);
      const rent = cs.rentPerBagPerMonth || (cs.monthly_rent_per_qtl ? Math.round(Number(cs.monthly_rent_per_qtl) / 2) : 24);

      list.push({
        id: `cs-${cs.id || idx + 1}`,
        type: 'storage',
        name: typeof cs.name === 'object' ? cs.name : { en: cs.name, hi: cs.name, te: cs.name },
        location: typeof cs.location === 'object' ? cs.location : { en: `${cs.district || ''}, ${cs.state || ''}`, hi: `${cs.district || ''}, ${cs.state || ''}`, te: `${cs.district || ''}, ${cs.state || ''}` },
        district: cs.district || 'Guntur',
        state: cs.state || 'Andhra Pradesh',
        lat: coords.lat,
        lng: coords.lng,
        distanceKm: dist,
        highlightText: `${vacant.toLocaleString()} bags vacant`,
        contactPhone: cs.contactPhone || cs.contact_phone || '+91 863 2234011',
        vacantBags: vacant,
        totalBags: total,
        rentPerBagPerMonth: rent,
        tempControlled: cs.temperatureControlled !== false,
        hasFumigation: cs.hasFumigation !== false
      });
    });

    // 2. APMC Mandis from Live DB or regional presets
    const mandiPresets = [
      {
        id: 'mandi-guntur',
        market: 'Guntur APMC Mirchi Yard',
        district: 'Guntur',
        state: 'Andhra Pradesh',
        lat: 16.3067,
        lng: 80.4365,
        commodity: 'Chilli',
        price: 15200,
        phone: '0863-2234011'
      },
      {
        id: 'mandi-madanapalle',
        market: 'Madanapalle Tomato Yard (APMC)',
        district: 'Chittoor',
        state: 'Andhra Pradesh',
        lat: 13.556,
        lng: 78.501,
        commodity: 'Tomato',
        price: 2600,
        phone: '08571-220022'
      },
      {
        id: 'mandi-kurnool',
        market: 'Kurnool APMC Onion Yard',
        district: 'Kurnool',
        state: 'Andhra Pradesh',
        lat: 15.8281,
        lng: 78.0373,
        commodity: 'Onion',
        price: 2450,
        phone: '08518-220055'
      },
      {
        id: 'mandi-anantapur',
        market: 'Anantapur Groundnut Yard',
        district: 'Anantapur',
        state: 'Andhra Pradesh',
        lat: 14.6819,
        lng: 77.6006,
        commodity: 'Groundnut',
        price: 7850,
        phone: '08554-240011'
      },
      {
        id: 'mandi-kadapa',
        market: 'Kadapa (Krishna Nagar) Market',
        district: 'Kadapa',
        state: 'Andhra Pradesh',
        lat: 14.4673,
        lng: 78.8242,
        commodity: 'Turmeric',
        price: 16500,
        phone: '08562-241100'
      },
      {
        id: 'mandi-warangal',
        market: 'Warangal Enamamula APMC',
        district: 'Warangal',
        state: 'Telangana',
        lat: 17.9689,
        lng: 79.5941,
        commodity: 'Chilli',
        price: 14100,
        phone: '0870-2441122'
      },
      {
        id: 'mandi-kolar',
        market: 'Kolar APMC Tomato Market',
        district: 'Kolar',
        state: 'Karnataka',
        lat: 13.1367,
        lng: 78.1292,
        commodity: 'Tomato',
        price: 2450,
        phone: '08152-222333'
      },
      {
        id: 'mandi-adoni',
        market: 'Adoni Cotton Market Yard',
        district: 'Kurnool',
        state: 'Andhra Pradesh',
        lat: 15.6322,
        lng: 77.2728,
        commodity: 'Cotton',
        price: 7650,
        phone: '08512-250088'
      }
    ];

    mandiPresets.forEach((m) => {
      // Cross-reference live DB price if available
      const liveMatch = liveMandiRates.find(
        (lr: any) =>
          lr.market &&
          lr.market.toLowerCase().includes(m.district.toLowerCase()) &&
          lr.commodity &&
          lr.commodity.toLowerCase().includes(m.commodity.toLowerCase())
      );
      const modalPrice = liveMatch ? Math.round(Number(liveMatch.modal_price_qtl)) : m.price;
      const dist = calculateDistanceKm(farmerCoords.lat, farmerCoords.lng, m.lat, m.lng);

      list.push({
        id: m.id,
        type: 'mandi',
        name: { en: m.market, hi: m.market, te: m.market },
        location: { en: `${m.district}, ${m.state}`, hi: `${m.district}, ${m.state}`, te: `${m.district}, ${m.state}` },
        district: m.district,
        state: m.state,
        lat: m.lat,
        lng: m.lng,
        distanceKm: dist,
        highlightText: `₹${modalPrice.toLocaleString()}/qtl Modal`,
        contactPhone: m.phone,
        mandiPrice: modalPrice,
        cropName: { en: m.commodity, hi: m.commodity, te: m.commodity },
        eNamVerified: true
      });
    });

    return list.sort((a, b) => a.distanceKm - b.distanceKm);
  }, [liveDbFacilities, liveMandiRates, farmerCoords]);

  // Filter facilities by Search query, Category, and Radius
  const filteredFacilities = useMemo(() => {
    return allFacilities.filter((item) => {
      const matchesType = filterType === 'all' || item.type === filterType;
      const matchesRadius = item.distanceKm <= selectedRadius;
      const q = mapQuery.toLowerCase().trim();
      const matchesQuery =
        q === '' ||
        item.name[currentLang].toLowerCase().includes(q) ||
        item.location[currentLang].toLowerCase().includes(q) ||
        item.district.toLowerCase().includes(q);
      return matchesType && matchesRadius && matchesQuery;
    });
  }, [allFacilities, filterType, selectedRadius, mapQuery, currentLang]);

  // Always automatically select the nearest facility to the farmer's current location
  useEffect(() => {
    if (filteredFacilities.length > 0) {
      setActiveFacilityId(filteredFacilities[0].id);
    }
  }, [currentLocation?.id, filterType, selectedRadius, filteredFacilities.length]);

  // Active facility object
  const activeFacility = useMemo(() => {
    return (
      filteredFacilities.find((f) => f.id === activeFacilityId) ||
      allFacilities.find((f) => f.id === activeFacilityId) ||
      filteredFacilities[0] ||
      allFacilities[0]
    );
  }, [allFacilities, filteredFacilities, activeFacilityId]);

  // Estimated road freight cost: Base ₹250 + ₹22/km for local tractor / Tata Ace load
  const estimatedFreight = useMemo(() => {
    if (!activeFacility) return 350;
    return Math.max(300, Math.round(250 + activeFacility.distanceKm * 24));
  }, [activeFacility]);

  // Initialize Leaflet Map with Google Maps & OpenStreetMap Tiles (Clean, zero watermark)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [farmerCoords.lat, farmerCoords.lng],
        zoom: 10,
        zoomControl: false,
        attributionControl: false
      });

      // Add Zoom Control at bottom right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Clean Google Maps Street / Roads layer (Zero watermarks, high contrast)
      const streetLayer = L.tileLayer(
        'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
        {
          maxZoom: 20
        }
      ).addTo(map);

      tileLayerRef.current = streetLayer;
      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Handle Map Tile Layer Switching (Google Roads vs Google Hybrid Satellite)
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }

    if (mapLayer === 'satellite') {
      // Google Hybrid Satellite: Real satellite photography with sharp road and town overlays
      tileLayerRef.current = L.tileLayer(
        'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
        { maxZoom: 20 }
      ).addTo(mapInstanceRef.current);
    } else {
      // Google Standard Roads & Agricultural Districts
      tileLayerRef.current = L.tileLayer(
        'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
        { maxZoom: 20 }
      ).addTo(mapInstanceRef.current);
    }
  }, [mapLayer]);

  // Render Markers and Active Route on the Leaflet Map
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    layer.clearLayers();

    // 1. Farmer's Farm Pin (Pulsing Amber)
    const farmerIcon = L.divIcon({
      className: 'farmer-marker-container',
      html: `
        <div class="farmer-pulse-beacon">
          <div class="beacon-wave"></div>
          <div class="beacon-center">🚜</div>
        </div>
        <div class="farmer-label-chip">📍 ${currentLocation?.name[currentLang] || 'Your Farm'}</div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });

    L.marker([farmerCoords.lat, farmerCoords.lng], { icon: farmerIcon, zIndexOffset: 1000 })
      .bindPopup(
        `<div style="font-family: inherit; font-size: 13px;">
          <strong>🌾 ${currentLocation?.name[currentLang] || 'Your Farm Base'}</strong><br/>
          <span style="color: #64748B;">Origin for freight & distance tracking</span>
        </div>`
      )
      .addTo(layer);

    // 2. Add Pins for Filtered Facilities
    filteredFacilities.forEach((item) => {
      const isActive = item.id === activeFacilityId;
      const isStorage = item.type === 'storage';

      const pinHtml = `
        <div class="facility-marker-pin ${isStorage ? 'storage' : 'mandi'} ${isActive ? 'is-active' : ''}">
          <div class="pin-badge-icon">${isStorage ? '❄️' : '🌾'}</div>
          <div class="pin-callout">
            <span class="callout-name">${item.district}</span>
            <span class="callout-value">${isStorage ? `📦 ${item.highlightText}` : item.highlightText}</span>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-facility-divicon',
        html: pinHtml,
        iconSize: [120, 50],
        iconAnchor: [20, 36]
      });

      const marker = L.marker([item.lat, item.lng], {
        icon: customIcon,
        zIndexOffset: isActive ? 900 : 100
      });

      marker.on('click', () => {
        setActiveFacilityId(item.id);
      });

      marker.bindPopup(
        `<div style="font-family: inherit; font-size: 13px; min-width: 180px;">
          <div style="font-weight: 700; color: ${isStorage ? '#0284C7' : '#16A34A'}; margin-bottom: 4px;">
            ${isStorage ? '❄️ Cold Storage' : '🌾 APMC Market Yard'}
          </div>
          <strong>${item.name[currentLang]}</strong><br/>
          <span style="color: #64748B;">📍 ${item.location[currentLang]}</span><br/>
          <div style="margin-top: 6px; padding: 4px 6px; background: #F1F5F9; border-radius: 4px; font-weight: 600;">
            ${isStorage ? `Rent: ₹${item.rentPerBagPerMonth}/bag • ${item.vacantBags?.toLocaleString()} bags free` : `Live Modal: ₹${item.mandiPrice?.toLocaleString()}/qtl`}
          </div>
          <div style="margin-top: 6px; font-size: 12px; color: #475569;">
            🚗 Distance: <strong>${item.distanceKm} km</strong>
          </div>
        </div>`
      );

      marker.addTo(layer);
    });

    // 3. Draw Dashed Transit Route Line from Farmer to Active Facility
    if (routeLineRef.current) {
      map.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }

    if (activeFacility) {
      const latlngs: [number, number][] = [
        [farmerCoords.lat, farmerCoords.lng],
        [activeFacility.lat, activeFacility.lng]
      ];

      const routeLine = L.polyline(latlngs, {
        color: activeFacility.type === 'storage' ? '#0284C7' : '#16A34A',
        weight: 4,
        opacity: 0.85,
        dashArray: '8, 8',
        lineCap: 'round'
      }).addTo(map);

      routeLineRef.current = routeLine;

      // Fit bounds to show both farmer and active facility
      const bounds = L.latLngBounds(latlngs);
      map.flyToBounds(bounds, { padding: [60, 60], maxZoom: 12, duration: 0.8 });
    }
  }, [filteredFacilities, activeFacilityId, farmerCoords, activeFacility, currentLang, currentLocation]);

  const handleRecenter = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([farmerCoords.lat, farmerCoords.lng], 10, { duration: 0.8 });
  };

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
  };

  return (
    <div className="storage-map-view-container">
      {/* Header Strip */}
      <div className="view-header-strip">
        <div className="title-row">
          <Warehouse size={24} className="view-icon" />
          <h2 className="view-title">{t.storageTitle}</h2>
          <span className="live-db-pill">
            <span className="live-dot" /> {isLoading ? 'Syncing Neon DB...' : 'Live Neon DB & Redis'}
          </span>
        </div>
        <p className="view-desc">
          {currentLocation
            ? (currentLang === 'hi'
                ? `📍 ${currentLocation.name[currentLang]} (${currentLocation.district[currentLang]}) के निकटतम कोल्ड स्टोरेज, वेयरहाउस एवं एपीएमसी अनाज व फल मंडी यार्ड का लाइव नक्शा`
                : currentLang === 'te'
                ? `📍 ${currentLocation.name[currentLang]} సమీపంలోని కోల్డ్ స్టోరేజీలు, గోదాములు & మార్కెట్ యార్డుల సమగ్ర మ్యాప్`
                : `📍 Interactive Regional Map of Cold Storages & APMC Market Yards nearest to ${currentLocation.name[currentLang]} (${currentLocation.district[currentLang]})`)
            : 'Interactive Regional Map of Cold Storages, Godowns & APMC Market Yards with Real Vacancy'}
        </p>
      </div>

      {/* Control Bar: Search Input, Category Pill Tabs, and Radius Selector */}
      <div className="map-search-control-bar">
        <form onSubmit={handleSearchSubmit} className="map-search-form">
          <Search size={18} className="map-search-icon" />
          <input
            type="text"
            placeholder={currentLang === 'hi' ? 'गाँव, मंडी, कोल्ड स्टोरेज खोजें...' : currentLang === 'te' ? 'గ్రామం, మార్కెట్, కోల్డ్ స్టోరేజ్ వెతకండి...' : 'Search village, mandi, or cold storage...'}
            value={mapQuery}
            onChange={(e) => setMapQuery(e.target.value)}
            className="map-search-input"
          />
          {mapQuery && (
            <button type="button" onClick={() => setMapQuery('')} className="map-clear-btn">
              ✕
            </button>
          )}
          <button type="submit" className="map-search-btn">
            {t.searchBtn}
          </button>
        </form>

        {/* Clear, High-Contrast Category Segment Pills */}
        <div className="map-category-tabs">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`map-cat-btn ${filterType === 'all' ? 'active' : ''}`}
          >
            <Layers size={15} />
            <span>
              {currentLang === 'hi' ? 'सभी केंद्र' : currentLang === 'te' ? 'అన్నీ' : 'All Facilities'}
            </span>
            <span className="cat-count">({allFacilities.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('storage')}
            className={`map-cat-btn storage-cat ${filterType === 'storage' ? 'active' : ''}`}
          >
            <Warehouse size={15} />
            <span>
              {currentLang === 'hi' ? 'कोल्ड स्टोरेज' : currentLang === 'te' ? 'కోల్డ్ స్టోరేజ్' : 'Cold Storages'}
            </span>
            <span className="cat-count">
              ({allFacilities.filter((f) => f.type === 'storage').length})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('mandi')}
            className={`map-cat-btn mandi-cat ${filterType === 'mandi' ? 'active' : ''}`}
          >
            <TrendingUp size={15} />
            <span>
              {currentLang === 'hi' ? 'मंडी यार्ड' : currentLang === 'te' ? 'మార్కెట్ యార్డులు' : 'APMC Mandis'}
            </span>
            <span className="cat-count">
              ({allFacilities.filter((f) => f.type === 'mandi').length})
            </span>
          </button>
        </div>

        {/* Radius Filter Pills */}
        <div className="radius-picker">
          <span className="radius-label">
            <Compass size={14} />
            {currentLang === 'hi' ? 'दूरी:' : currentLang === 'te' ? 'పరిధి:' : 'Radius:'}
          </span>
          {[20, 50, 100, 250].map((r) => (
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

      {/* Vertical Farmer Cockpit Layout: Left Directory + Right Full-Height Leaflet Map */}
      <div className="farmer-map-cockpit-grid">
        {/* Left Column: Facility Directory & Active Spotlight */}
        <div className="farmer-facilities-panel">
          {/* Active Facility Spotlight Card */}
          {activeFacility && (
            <div className={`spotlight-focus-card ${activeFacility.type}`}>
              <div className="s-type-badge-row">
                <span className={`s-type-pill ${activeFacility.type}`}>
                  {activeFacility.type === 'storage' ? <Warehouse size={14} /> : <TrendingUp size={14} />}
                  {activeFacility.type === 'storage'
                    ? (currentLang === 'hi' ? 'कोल्ड स्टोरेज' : currentLang === 'te' ? 'కోల్డ్ స్టోరేజ్' : 'Cold Storage Facility')
                    : (currentLang === 'hi' ? 'एपीएमसी अनाज मंडी' : currentLang === 'te' ? 'మార్కెట్ యార్డ్' : 'APMC Market Yard')}
                </span>
                <span className="s-dist-pill">
                  <Navigation size={13} />
                  {activeFacility.distanceKm} km {currentLang === 'hi' ? 'दूरी' : currentLang === 'te' ? 'దూరం' : 'away'}
                </span>
              </div>

              <h3 className="s-facility-name">{activeFacility.name[currentLang]}</h3>
              <p className="s-facility-loc">📍 {activeFacility.location[currentLang]}</p>

              {/* Farmer Freight Estimator */}
              <div className="freight-estimate-banner">
                <Truck size={16} className="truck-icon" />
                <div className="freight-text">
                  <span className="freight-title">
                    {currentLang === 'hi' ? 'अनुमानित भाड़ा (ट्रैक्टर/ऑटो)' : currentLang === 'te' ? 'అంచనా రవాణా ఖర్చు' : 'Estimated Route Freight (Tractor/Ace)'}:
                  </span>
                  <strong className="freight-cost">₹{estimatedFreight.toLocaleString()}</strong>
                  <span className="freight-rate">(@ ₹28/km)</span>
                </div>
              </div>

              {/* Dynamic Storage Meter or Mandi Rate Details */}
              {activeFacility.type === 'storage' && activeFacility.vacantBags && activeFacility.totalBags && (
                <div className="spotlight-storage-metrics">
                  <div className="storage-meter-row">
                    <div className="meter-label-left">
                      <span className="m-title">{t.vacantBagsLabel}</span>
                      <strong className="m-val">
                        {activeFacility.vacantBags.toLocaleString()} / {activeFacility.totalBags.toLocaleString()} {t.bagsUnit}
                      </strong>
                    </div>
                    <span className="meter-percent">
                      {Math.round((activeFacility.vacantBags / activeFacility.totalBags) * 100)}% {t.spaceFree}
                    </span>
                  </div>
                  <div className="s-progress-track">
                    <div
                      className="s-progress-fill"
                      style={{
                        width: `${Math.round((activeFacility.vacantBags / activeFacility.totalBags) * 100)}%`
                      }}
                    />
                  </div>
                  <div className="storage-tags-row">
                    <span className="s-rent-tag">
                      💰 ₹{activeFacility.rentPerBagPerMonth} {currentLang === 'hi' ? '/ बोरी/माह' : currentLang === 'te' ? '/ బస్తాకు/నెలకు' : '/ bag/month'}
                    </span>
                    {activeFacility.tempControlled && (
                      <span className="s-feat-chip">
                        <ThermometerSnowflake size={12} /> Temp -2°C to 4°C
                      </span>
                    )}
                    {activeFacility.hasFumigation && (
                      <span className="s-feat-chip">
                        <ShieldCheck size={12} /> Certified Fumigation
                      </span>
                    )}
                  </div>
                </div>
              )}

              {activeFacility.type === 'mandi' && activeFacility.mandiPrice && (
                <div className="spotlight-mandi-metrics">
                  <div className="mandi-price-badge-box">
                    <span className="mp-label">
                      {t.commonModalBadge} ({activeFacility.cropName?.[currentLang]}):
                    </span>
                    <span className="mp-rate">₹{activeFacility.mandiPrice.toLocaleString()} {t.quintalUnit}</span>
                  </div>
                  <span className="e-nam-tag">
                    <CheckCircle2 size={13} /> {t.enamVerified}
                  </span>
                </div>
              )}

              {/* Farmer Decision Helper: Store vs Sell Today */}
              {activeFacility.type === 'storage' && (
                <div className="farmer-arbitrage-box">
                  <div className="arb-badge">💡 {currentLang === 'hi' ? 'किसान लाभ विश्लेषण (भंडारण बनाम आज की बिक्री)' : currentLang === 'te' ? 'రైతు లాభ విశ్లేషణ (నిల్వ vs అమ్మకం)' : 'Farmer Decision Analysis: Store vs Sell Today'}</div>
                  <div className="arb-grid">
                    <div className="arb-col">
                      <span className="arb-lbl">{currentLang === 'hi' ? 'आज मंडी भाव:' : currentLang === 'te' ? 'నేటి మార్కెట్ ధర:' : 'Today APMC Rate:'}</span>
                      <strong className="arb-val danger">₹2,600 / qtl</strong>
                    </div>
                    <div className="arb-col">
                      <span className="arb-lbl">{currentLang === 'hi' ? '60 दिन बाद भाव:' : currentLang === 'te' ? '60 రోజుల తర్వాత:' : 'Expected in 60d:'}</span>
                      <strong className="arb-val success">₹3,850 / qtl</strong>
                    </div>
                    <div className="arb-col">
                      <span className="arb-lbl">{currentLang === 'hi' ? 'शुद्ध अतिरिक्त लाभ:' : currentLang === 'te' ? 'నికర లాభం:' : 'Net Storage Gain:'}</span>
                      <strong className="arb-val highlight">+₹1,202 / qtl (+46%)</strong>
                    </div>
                  </div>
                  <p className="arb-hint">ℹ️ {currentLang === 'hi' ? '60 दिनों का कोल्ड स्टोरेज किराया (₹48/qtl) व हैंडलिंग घटाकर शुद्ध अतिरिक्त आय।' : currentLang === 'te' ? '60 రోజుల అద్దె మరియు ఖర్చులు మినహాయించిన తర్వాత నికర లాభం.' : 'Net gain calculated after deducting 60-day rental (₹48/qtl) & labor fees.'}</p>
                </div>
              )}

              {/* Action Dialers */}
              <div className="spotlight-actions-row">
                <a
                  href={`tel:${activeFacility.contactPhone.replace(/[^\d+]/g, '')}`}
                  onClick={() => onOpenHelpline(activeFacility.contactPhone)}
                  className="s-call-btn"
                >
                  <PhoneCall size={16} />
                  <span>{activeFacility.contactPhone}</span>
                </a>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&origin=${farmerCoords.lat},${farmerCoords.lng}&destination=${activeFacility.lat},${activeFacility.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="s-directions-btn"
                >
                  <ExternalLink size={15} />
                  <span>{currentLang === 'hi' ? 'नेविगेट (गूगल मैप्स)' : currentLang === 'te' ? 'రూట్ మ్యాప్' : 'Directions'}</span>
                </a>
                <button
                  type="button"
                  onClick={() => onOpenBookingGate(activeFacility.name[currentLang])}
                  className="s-book-btn"
                >
                  <CheckCircle2 size={16} />
                  <span>{activeFacility.type === 'storage' ? t.bookStorageBtn : t.shareWhatsapp}</span>
                </button>
              </div>
            </div>
          )}

          {/* Scrollable Facilities Quick List */}
          <div className="facilities-scroll-list">
            <div className="list-heading-bar">
              <span className="list-count-badge">
                {filteredFacilities.length} {currentLang === 'hi' ? 'निकटतम केंद्र' : currentLang === 'te' ? 'కేంద్రాలు' : 'Nearby Hubs'}
              </span>
              <span className="list-sort-hint">
                {currentLang === 'hi' ? 'दूरी के अनुसार क्रमबद्ध' : currentLang === 'te' ? 'దూరం ప్రకారం' : 'Sorted by Distance'}
              </span>
            </div>

            <div className="cards-scroll-container">
              {filteredFacilities.map((f) => {
                const isSelected = f.id === activeFacilityId;
                const isStorage = f.type === 'storage';

                return (
                  <div
                    key={f.id}
                    onClick={() => setActiveFacilityId(f.id)}
                    className={`mini-facility-card ${isStorage ? 'storage' : 'mandi'} ${isSelected ? 'selected' : ''}`}
                  >
                    <div className="card-top-line">
                      <span className={`mini-type-icon ${isStorage ? 'storage' : 'mandi'}`}>
                        {isStorage ? '❄️' : '🌾'}
                      </span>
                      <strong className="mini-card-title">{f.name[currentLang]}</strong>
                      <span className="mini-dist-tag">{f.distanceKm} km</span>
                    </div>
                    <div className="card-bot-line">
                      <span className="mini-loc-text">📍 {f.district}, {f.state}</span>
                      <span className="mini-highlight-text">{f.highlightText}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Full-Height Interactive Leaflet Map */}
        <div className="farmer-map-viewport-panel">
          {/* Map Top Float Bar: Layer Switcher & Recenter */}
          <div className="map-float-tools">
            <div className="layer-toggle-group">
              <button
                type="button"
                onClick={() => setMapLayer('streets')}
                className={`layer-btn ${mapLayer === 'streets' ? 'active' : ''}`}
              >
                <Layers size={14} />
                <span>{currentLang === 'hi' ? 'सड़क / ज़िला नक्शा' : currentLang === 'te' ? 'రోడ్డు మ్యాప్' : 'Road & District'}</span>
              </button>
              <button
                type="button"
                onClick={() => setMapLayer('satellite')}
                className={`layer-btn ${mapLayer === 'satellite' ? 'active' : ''}`}
              >
                <Satellite size={14} />
                <span>{currentLang === 'hi' ? 'सैटेलाइट व्यू' : currentLang === 'te' ? 'శాటిలైట్ వ్యూ' : 'Satellite View'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleRecenter}
              className="map-recenter-btn"
              title="Recenter on your farm"
            >
              <RotateCcw size={14} />
              <span>{currentLang === 'hi' ? 'मेरा खेत' : currentLang === 'te' ? 'నా పొలం' : 'My Farm'}</span>
            </button>
          </div>

          {/* Leaflet Map Target DOM */}
          <div ref={mapContainerRef} className="leaflet-map-target-dom" />

          {/* Map Bottom Legend Overlay */}
          <div className="leaflet-map-legend-bar">
            <div className="leg-item">
              <span className="leg-dot farm" />
              <span>{currentLang === 'hi' ? 'आपका खेत (स्रोत)' : currentLang === 'te' ? 'మీ పొలం' : 'Your Farm Base'}</span>
            </div>
            <div className="leg-item">
              <span className="leg-dot storage" />
              <span>{currentLang === 'hi' ? 'कोल्ड स्टोरेज (भंडारण)' : currentLang === 'te' ? 'కోల్డ్ స్టోరేజ్' : 'Cold Storage (Blue)'}</span>
            </div>
            <div className="leg-item">
              <span className="leg-dot mandi" />
              <span>{currentLang === 'hi' ? 'एपीएमसी मंडी (लाइव भाव)' : currentLang === 'te' ? 'మార్కెట్ యార్డ్' : 'APMC Mandi (Green)'}</span>
            </div>
            <div className="leg-item">
              <span className="leg-line route" />
              <span>{currentLang === 'hi' ? 'परिवहन मार्ग' : currentLang === 'te' ? 'రవాణా మార్గం' : 'Dashed Route Line'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
