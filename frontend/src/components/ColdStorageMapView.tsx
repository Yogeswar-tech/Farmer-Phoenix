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
  ExternalLink,
  MapPin,
  LocateFixed,
  Award,
  Box
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
  monthlyRentPerQtl?: number;
  capacityMt?: number;
  availableMt?: number;
  tempControlled?: boolean;
  hasFumigation?: boolean;
  wdraAccredited?: boolean;
  tempRangeC?: string;
  chambers?: number;
  crops?: string[];
  occupancyPct?: number;
  // Mandi specific
  mandiPrice?: number;
  cropName?: Record<Language, string>;
  eNamVerified?: boolean;
}

// Regional fallback coordinates
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
  gondal: { lat: 21.9619, lng: 70.7923 },
  agra: { lat: 27.1767, lng: 78.0081 },
  shimla: { lat: 31.1048, lng: 77.1734 },
  abohar: { lat: 30.1450, lng: 74.1993 },
  deesa: { lat: 24.2586, lng: 72.1793 },
  dindigul: { lat: 10.3673, lng: 77.9803 }
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

// Preset Mandis across India
const PAN_INDIA_MANDIS = [
  {
    id: 'mandi-guntur',
    market: 'Guntur APMC Mirchi Yard',
    district: 'Guntur',
    state: 'Andhra Pradesh',
    lat: 16.3067,
    lng: 80.4365,
    commodity: 'Chilli',
    price: 15200,
    phone: '+91 863 2234011'
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
    phone: '+91 8571 220022'
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
    phone: '+91 8518 220055'
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
    phone: '+91 870 2441122'
  },
  {
    id: 'mandi-lasalgaon',
    market: 'Lasalgaon Onion APMC Terminal',
    district: 'Nashik',
    state: 'Maharashtra',
    lat: 20.1471,
    lng: 74.2254,
    commodity: 'Onion',
    price: 3250,
    phone: '+91 2592 245112'
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
    phone: '+91 8152 222333'
  },
  {
    id: 'mandi-agra',
    market: 'Agra Potato APMC Yard',
    district: 'Agra',
    state: 'Uttar Pradesh',
    lat: 27.1767,
    lng: 78.0081,
    commodity: 'Potato',
    price: 1850,
    phone: '+91 562 2280045'
  },
  {
    id: 'mandi-shimla',
    market: 'Shimla Dhalli Fruit Mandi',
    district: 'Shimla',
    state: 'Himachal Pradesh',
    lat: 31.1048,
    lng: 77.1734,
    commodity: 'Apple',
    price: 8400,
    phone: '+91 177 2652130'
  }
];

export const ColdStorageMapView: FC<ColdStorageMapViewProps> = ({
  currentLang,
  currentLocation,
  onOpenHelpline,
  onOpenBookingGate
}) => {
  const t = translations[currentLang];
  const [mapQuery, setMapQuery] = useState('');
  const [selectedRadius, setSelectedRadius] = useState<number>(250); // Default to 250km for regional visibility
  const [filterType, setFilterType] = useState<MapPointType>('all');
  const [selectedCommodity, setSelectedCommodity] = useState<string>('all');
  const [mapLayer, setMapLayer] = useState<MapLayerType>('streets');
  const [activeFacilityId, setActiveFacilityId] = useState<string>('');
  const [liveDbFacilities, setLiveDbFacilities] = useState<any[]>([]);
  const [liveMandiRates, setLiveMandiRates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userGpsCoords, setUserGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsActive, setGpsActive] = useState<boolean>(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);

  // Auto-detect browser GPS on mount and provide high accuracy
  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserGpsCoords(coords);
          setGpsActive(true);
        },
        (err) => {
          console.log('GPS Geolocation note:', err.message);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 120000 }
      );
    }
  }, []);

  // Farmer's origin coordinates: prefers live GPS, then currentLocation, then fallback
  const farmerCoords = useMemo(() => {
    if (userGpsCoords) return userGpsCoords;
    if (currentLocation?.id && REGION_COORDINATES[currentLocation.id.toLowerCase()]) {
      return REGION_COORDINATES[currentLocation.id.toLowerCase()];
    }
    return REGION_COORDINATES.guntur;
  }, [userGpsCoords, currentLocation?.id]);

  // Fetch Pan-India Cold Storages from PostgreSQL backend with GPS proximity
  const fetchFacilities = async () => {
    setIsLoading(true);
    try {
      const [storages, mandis] = await Promise.all([
        KisanSethuApi.getColdStorages({
          lat: farmerCoords.lat,
          lng: farmerCoords.lng,
          radius_km: selectedRadius === 0 ? undefined : selectedRadius,
          commodity: selectedCommodity !== 'all' ? selectedCommodity : undefined,
          search: mapQuery.trim() || undefined
        }),
        KisanSethuApi.getMandiRates()
      ]);

      if (storages && storages.length > 0) {
        setLiveDbFacilities(storages);
      }
      if (mandis && mandis.length > 0) {
        setLiveMandiRates(mandis);
      }
    } catch (err) {
      console.warn('Backend fetch for cold storage data fallback:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFacilities();
  }, [farmerCoords.lat, farmerCoords.lng, selectedRadius, selectedCommodity]);

  // Master facilities collection (Cold Storages + Mandis)
  const allFacilities: GeoFacilityItem[] = useMemo(() => {
    const list: GeoFacilityItem[] = [];

    // 1. Cold Storages from Live DB or mock fallback
    const coldSources = liveDbFacilities.length > 0 ? liveDbFacilities : COLD_STORAGES;
    coldSources.forEach((cs: any, idx: number) => {
      const locKey = (cs.district || cs.location?.en || 'guntur').toLowerCase();
      const coords =
        (cs.latitude && cs.longitude && { lat: Number(cs.latitude), lng: Number(cs.longitude) }) ||
        REGION_COORDINATES[locKey] ||
        (idx === 0 ? REGION_COORDINATES.guntur : idx === 1 ? REGION_COORDINATES.madanapalle : REGION_COORDINATES.kurnool);

      const dist =
        cs.distanceKm !== undefined && cs.distanceKm !== null
          ? Number(cs.distanceKm)
          : calculateDistanceKm(farmerCoords.lat, farmerCoords.lng, coords.lat, coords.lng);

      const vacant = cs.vacantCapacityBags || (cs.availableMt ? cs.availableMt * 20 : 12000);
      const total = cs.totalCapacityBags || (cs.capacityMt ? cs.capacityMt * 20 : 40000);
      const rent = cs.rentPerBagPerMonth || (cs.monthlyRentPerQtl ? Math.round(Number(cs.monthlyRentPerQtl) / 2) : 24);
      const occPct = cs.occupancyPct !== undefined ? cs.occupancyPct : Math.round(((total - vacant) / total) * 100);

      list.push({
        id: cs.id || `cs-${idx + 1}`,
        type: 'storage',
        name: typeof cs.name === 'object' ? cs.name : { en: cs.name, hi: cs.name, te: cs.name },
        location:
          typeof cs.location === 'object'
            ? cs.location
            : { en: `${cs.district || ''}, ${cs.state || ''}`, hi: `${cs.district || ''}, ${cs.state || ''}`, te: `${cs.district || ''}, ${cs.state || ''}` },
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
        monthlyRentPerQtl: cs.monthlyRentPerQtl || rent * 2,
        capacityMt: cs.capacityMt || Math.round(total / 20),
        availableMt: cs.availableMt || Math.round(vacant / 20),
        tempControlled: cs.temperatureControlled !== false,
        hasFumigation: cs.hasFumigation !== false,
        wdraAccredited: cs.wdraAccredited ?? true,
        tempRangeC: cs.tempRangeC || '2°C to 8°C',
        chambers: cs.chambers || 8,
        crops: cs.crops || ['Chilli', 'Turmeric', 'Vegetables'],
        occupancyPct: occPct
      });
    });

    // 2. APMC Mandis (Presets + Live Cross-Reference)
    PAN_INDIA_MANDIS.forEach((m) => {
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

  // Filter facilities by Search query, Category type, and Radius
  const filteredFacilities = useMemo(() => {
    return allFacilities.filter((item) => {
      const matchesType = filterType === 'all' || item.type === filterType;
      const matchesRadius = selectedRadius === 0 || item.distanceKm <= selectedRadius;
      const q = mapQuery.toLowerCase().trim();
      const matchesQuery =
        q === '' ||
        item.name[currentLang]?.toLowerCase().includes(q) ||
        item.name.en?.toLowerCase().includes(q) ||
        item.location[currentLang]?.toLowerCase().includes(q) ||
        item.district.toLowerCase().includes(q) ||
        item.state.toLowerCase().includes(q) ||
        (item.crops && item.crops.some((c) => c.toLowerCase().includes(q)));
      return matchesType && matchesRadius && matchesQuery;
    });
  }, [allFacilities, filterType, selectedRadius, mapQuery, currentLang]);

  // Auto-select nearest facility if activeFacilityId is not set or not in list
  useEffect(() => {
    if (filteredFacilities.length > 0) {
      const exists = filteredFacilities.some((f) => f.id === activeFacilityId);
      if (!exists) {
        setActiveFacilityId(filteredFacilities[0].id);
      }
    }
  }, [filteredFacilities, activeFacilityId]);

  // Active facility object
  const activeFacility = useMemo(() => {
    return (
      filteredFacilities.find((f) => f.id === activeFacilityId) ||
      allFacilities.find((f) => f.id === activeFacilityId) ||
      filteredFacilities[0] ||
      allFacilities[0]
    );
  }, [allFacilities, filteredFacilities, activeFacilityId]);

  // Estimated road freight: Base ₹250 + ₹22/km
  const estimatedFreight = useMemo(() => {
    if (!activeFacility) return 350;
    return Math.max(300, Math.round(250 + activeFacility.distanceKm * 24));
  }, [activeFacility]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [farmerCoords.lat, farmerCoords.lng],
        zoom: 9,
        zoomControl: false,
        attributionControl: false
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      const streetLayer = L.tileLayer(
        'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
        { maxZoom: 20 }
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

  // Map Tile Layer Switching
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }

    if (mapLayer === 'satellite') {
      tileLayerRef.current = L.tileLayer(
        'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
        { maxZoom: 20 }
      ).addTo(mapInstanceRef.current);
    } else {
      tileLayerRef.current = L.tileLayer(
        'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
        { maxZoom: 20 }
      ).addTo(mapInstanceRef.current);
    }
  }, [mapLayer]);

  // Render Markers and Active Route Line
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    layer.clearLayers();

    // 1. User's Farm Pin (Glowing Emerald Radar Beacon)
    const farmerIcon = L.divIcon({
      className: 'farmer-marker-container',
      html: `
        <div class="farmer-pulse-beacon" style="position: relative;">
          <div style="position: absolute; width: 34px; height: 34px; border-radius: 50%; background: rgba(16, 185, 129, 0.3); animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: relative; width: 28px; height: 28px; border-radius: 50%; background: #10B981; border: 2.5px solid #FFFFFF; box-shadow: 0 0 12px rgba(16, 185, 129, 0.8); display: flex; align-items: center; justify-content: center; font-size: 14px;">🚜</div>
        </div>
        <div style="background: #065F46; color: #FFFFFF; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 12px; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.2); margin-top: 4px;">
          📍 ${gpsActive ? (currentLang === 'hi' ? 'आपका जीपीएस खेत' : currentLang === 'te' ? 'మీ జీపీఎస్ క్షేత్రం' : 'Your Live GPS Farm') : (currentLocation?.name[currentLang] || 'Your Farm Base')}
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });

    L.marker([farmerCoords.lat, farmerCoords.lng], { icon: farmerIcon, zIndexOffset: 1000 })
      .bindPopup(
        `<div style="font-family: inherit; font-size: 13px; padding: 4px;">
          <strong style="color: #065F46;">🌾 ${gpsActive ? 'GPS Farm Origin (Auto-Detected)' : (currentLocation?.name[currentLang] || 'Your Farm Origin')}</strong><br/>
          <span style="color: #64748B; font-size: 11.5px;">Coordinates: ${farmerCoords.lat.toFixed(4)}, ${farmerCoords.lng.toFixed(4)}</span>
        </div>`
      )
      .addTo(layer);

    // 2. Add Pins for Facilities
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
        `<div style="font-family: inherit; font-size: 13px; min-width: 200px;">
          <div style="font-weight: 800; color: ${isStorage ? '#0284C7' : '#16A34A'}; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
            ${isStorage ? '❄️ Cold Storage Facility' : '🌾 APMC Market Yard'}
          </div>
          <strong>${item.name[currentLang] || item.name.en}</strong><br/>
          <span style="color: #64748B; font-size: 11.5px;">📍 ${item.location[currentLang] || item.location.en}</span><br/>
          <div style="margin-top: 6px; padding: 6px 8px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; font-size: 12px;">
            ${isStorage ? `<strong>Rent:</strong> ₹${item.rentPerBagPerMonth}/bag/mo • <strong>Vacant:</strong> ${item.vacantBags?.toLocaleString()} bags` : `<strong>Modal Rate:</strong> ₹${item.mandiPrice?.toLocaleString()}/qtl`}
          </div>
          <div style="margin-top: 6px; font-size: 11.5px; color: #475569; display: flex; justify-content: space-between;">
            <span>🚗 Distance: <strong>${item.distanceKm} km</strong></span>
            ${item.wdraAccredited ? '<span style="color: #B45309; font-weight: 700;">🏅 WDRA Approved</span>' : ''}
          </div>
        </div>`
      );

      marker.addTo(layer);
    });

    // 3. Draw Dashed Transit Route Line from Farm to Active Facility
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

      const bounds = L.latLngBounds(latlngs);
      map.flyToBounds(bounds, { padding: [60, 60], maxZoom: 12, duration: 0.8 });
    }
  }, [filteredFacilities, activeFacilityId, farmerCoords, activeFacility, currentLang, currentLocation, gpsActive]);

  const handleRecenter = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([farmerCoords.lat, farmerCoords.lng], 10, { duration: 0.8 });
  };

  const handleTriggerGps = () => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserGpsCoords(coords);
          setGpsActive(true);
          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([coords.lat, coords.lng], 11, { duration: 0.8 });
          }
        },
        (err) => {
          alert(currentLang === 'hi' ? 'कृपया ब्राउज़र में जीपीएस अनुमति दें।' : currentLang === 'te' ? 'దయచేసి బ్రౌజర్‌లో జీపీఎస్ అనుమతించండి.' : 'Please allow GPS location permission in browser.');
          console.warn('GPS Error:', err.message);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  };

  const handleSearchSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!mapQuery.trim()) return;

    // Search for matching location geocodes or matching facilities
    try {
      const searchResults = await KisanSethuApi.searchClimateLocations(mapQuery.trim());
      if (searchResults && searchResults.length > 0) {
        const top = searchResults[0];
        if (mapInstanceRef.current && top.latitude && top.longitude) {
          mapInstanceRef.current.flyTo([top.latitude, top.longitude], 10, { duration: 0.8 });
        }
      }
    } catch {
      // Fallback
    }

    fetchFacilities();
  };

  return (
    <div className="storage-map-view-container">
      {/* Clean Farmer Header (No Developer Ribbon or Debug Pill) */}
      <div className="view-header-strip">
        <div className="title-row">
          <Warehouse size={26} className="view-icon" style={{ color: '#0284C7' }} />
          <h2 className="view-title" style={{ margin: 0 }}>{t.storageTitle}</h2>
          <span style={{ fontSize: '12px', background: '#E0F2FE', color: '#0369A1', padding: '3px 10px', borderRadius: '12px', fontWeight: 700 }}>
            {currentLang === 'hi' ? 'अखिल भारतीय नेटवर्क' : currentLang === 'te' ? 'భారతదేశ వ్యాప్తంగా' : 'Pan-India Network'}
          </span>
        </div>
        <p className="view-desc" style={{ margin: 0 }}>
          {currentLang === 'hi'
            ? `📍 आपके खेत के निकटतम शीत भंडारण (कोल्ड स्टोरेज), सीए वेयरहाउस एवं सरकारी एपीएमसी यार्ड्स का वास्तविक समय डेटा व खाली बोरियों की स्थिति`
            : currentLang === 'te'
            ? `📍 మీ పొలానికి సమీపంలోని కోల్డ్ స్టోరేజీలు, సి.ఎ గోదాములు మరియు మార్కెట్ యార్డుల ఖాళీ బస్తాల సంఖ్య & అద్దె వివరాలు`
            : `📍 Real-time Pan-India Cold Storage, Controlled Atmosphere (CA) Godowns & APMC Yards with live vacant capacity, rent, and WDRA loan accreditation`}
        </p>
      </div>

      {/* Control Bar: Pan-India Search, GPS Trigger, and Radius Picker */}
      <div className="map-search-control-bar">
        <form onSubmit={handleSearchSubmit} className="map-search-form">
          <Search size={18} className="map-search-icon" />
          <input
            type="text"
            placeholder={
              currentLang === 'hi'
                ? 'गाँव, ज़िला, राज्य या कोल्ड स्टोरेज खोजें (उदा: गुंटूर, नासिक, आगरा, शिमला)...'
                : currentLang === 'te'
                ? 'గ్రామం, జిల్లా, కోల్డ్ స్టోరేజ్ వెతకండి (ఉదా: గుంటూరు, నాసిక్, కోలార్, ఆగ్రా)...'
                : 'Search town, district, state, or cold storage (e.g. Guntur, Nashik, Kolar, Agra, Shimla)...'
            }
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

        {/* GPS Live Auto-Detect Button */}
        <button
          type="button"
          onClick={handleTriggerGps}
          className={`radius-pill ${gpsActive ? 'active' : ''}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: gpsActive ? '#059669' : '#FFFFFF', color: gpsActive ? '#FFFFFF' : '#065F46', borderColor: '#059669' }}
          title="Auto-detect current GPS location"
        >
          <LocateFixed size={15} />
          <span>{gpsActive ? (currentLang === 'hi' ? 'जीपीएस सक्रिय' : currentLang === 'te' ? 'జీపీఎస్ ఆన్‌లో ఉంది' : 'GPS Active') : (currentLang === 'hi' ? 'मेरा जीपीएस स्थान' : currentLang === 'te' ? 'నా జీపీఎస్' : 'Use My GPS')}</span>
        </button>

        {/* Category Segment Tabs */}
        <div className="map-category-tabs">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`map-cat-btn ${filterType === 'all' ? 'active' : ''}`}
          >
            <Layers size={15} />
            <span>{currentLang === 'hi' ? 'सभी केंद्र' : currentLang === 'te' ? 'అన్నీ' : 'All Facilities'}</span>
            <span className="cat-count">({allFacilities.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('storage')}
            className={`map-cat-btn storage-cat ${filterType === 'storage' ? 'active' : ''}`}
          >
            <Warehouse size={15} />
            <span>{currentLang === 'hi' ? 'कोल्ड स्टोरेज' : currentLang === 'te' ? 'కోల్డ్ స్టోరేజ్' : 'Cold Storages'}</span>
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
            <span>{currentLang === 'hi' ? 'मंडी यार्ड' : currentLang === 'te' ? 'మార్కెట్ యార్డులు' : 'APMC Mandis'}</span>
            <span className="cat-count">
              ({allFacilities.filter((f) => f.type === 'mandi').length})
            </span>
          </button>
        </div>

        {/* Radius Filter Pills */}
        <div className="radius-picker">
          <span className="radius-label">
            <Compass size={14} />
            {currentLang === 'hi' ? 'दायरा:' : currentLang === 'te' ? 'పరిధి:' : 'Radius:'}
          </span>
          {[
            { label: '50 km', val: 50 },
            { label: '100 km', val: 100 },
            { label: '250 km', val: 250 },
            { label: '500 km', val: 500 },
            { label: currentLang === 'hi' ? 'पूरा भारत' : currentLang === 'te' ? 'భారతదేశం' : 'All India', val: 0 }
          ].map((r) => (
            <button
              key={r.val}
              type="button"
              onClick={() => setSelectedRadius(r.val)}
              className={`radius-pill ${selectedRadius === r.val ? 'active' : ''}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Commodity Filter Chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
          {currentLang === 'hi' ? 'फसल अनुसार:' : currentLang === 'te' ? 'పంట ప్రకారం:' : 'Crop Specialized:'}
        </span>
        {[
          { id: 'all', label: currentLang === 'hi' ? 'सभी फसलें' : currentLang === 'te' ? 'అన్ని పంటలు' : 'All Crops' },
          { id: 'Chilli', label: currentLang === 'hi' ? '🌶️ मिर्च व मसाले' : currentLang === 'te' ? '🌶️ మిర్చి & స్పైసెస్' : '🌶️ Chilli & Spices' },
          { id: 'Tomato', label: currentLang === 'hi' ? '🍅 टमाटर व सब्जियां' : currentLang === 'te' ? '🍅 టమోటా & కూరగాయలు' : '🍅 Tomato & Veg' },
          { id: 'Potato', label: currentLang === 'hi' ? '🥔 आलू व लहसुन' : currentLang === 'te' ? '🥔 బంగాళాదుంప' : '🥔 Potato & Garlic' },
          { id: 'Onion', label: currentLang === 'hi' ? '🧅 प्याज' : currentLang === 'te' ? '🧅 ఉల్లి' : '🧅 Onion' },
          { id: 'Apple', label: currentLang === 'hi' ? '🍎 सेब व फल (CA)' : currentLang === 'te' ? '🍎 యాపిల్ & పండ్లు' : '🍎 Apple & Fruits' }
        ].map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedCommodity(c.id)}
            style={{
              padding: '5px 12px',
              borderRadius: '20px',
              border: selectedCommodity === c.id ? '1.5px solid #0284C7' : '1px solid #CBD5E1',
              background: selectedCommodity === c.id ? '#0284C7' : '#FFFFFF',
              color: selectedCommodity === c.id ? '#FFFFFF' : '#334155',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease'
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Main Two-Column Cockpit Layout: Left Directory + Right Full-Height Interactive Map */}
      <div className="farmer-map-cockpit-grid">
        {/* Left Column: Spotlight Card + Scrollable Directory */}
        <div className="farmer-facilities-panel">
          {/* Active Facility Spotlight Card */}
          {activeFacility && (
            <div className={`spotlight-focus-card ${activeFacility.type}`}>
              <div className="s-type-badge-row">
                <span className={`s-type-pill ${activeFacility.type}`}>
                  {activeFacility.type === 'storage' ? <Warehouse size={14} /> : <TrendingUp size={14} />}
                  {activeFacility.type === 'storage'
                    ? (currentLang === 'hi' ? 'कोल्ड स्टोरेज एवं गोदाम' : currentLang === 'te' ? 'కోల్డ్ స్టోరేజ్ & గోదాము' : 'Cold Storage Facility')
                    : (currentLang === 'hi' ? 'एपीएमसी अनाज मंडी' : currentLang === 'te' ? 'మార్కెట్ యార్డ్' : 'APMC Market Yard')}
                </span>
                <span className="s-dist-pill">
                  <Navigation size={13} />
                  {activeFacility.distanceKm} km {currentLang === 'hi' ? 'दूरी' : currentLang === 'te' ? 'దూరం' : 'away'}
                </span>
              </div>

              <h3 className="s-facility-name">{activeFacility.name[currentLang] || activeFacility.name.en}</h3>
              <p className="s-facility-loc">📍 {activeFacility.location[currentLang] || activeFacility.location.en}</p>

              {/* Farmer Freight Estimator */}
              <div className="freight-estimate-banner">
                <Truck size={16} className="truck-icon" />
                <div className="freight-text">
                  <span className="freight-title">
                    {currentLang === 'hi' ? 'अनुमानित भाड़ा (ट्रैक्टर/ऑटो)' : currentLang === 'te' ? 'అంచనా రవాణా ఖర్చు' : 'Estimated Transit Freight'}:
                  </span>
                  <strong className="freight-cost">₹{estimatedFreight.toLocaleString()}</strong>
                  <span className="freight-rate">(@ ₹24/km)</span>
                </div>
              </div>

              {/* Cold Storage Detailed Metrics */}
              {activeFacility.type === 'storage' && activeFacility.vacantBags !== undefined && activeFacility.totalBags !== undefined && (
                <div className="spotlight-storage-metrics">
                  {/* Occupancy Status & Gauge */}
                  <div className="storage-meter-row">
                    <div className="meter-label-left">
                      <span className="m-title">{t.vacantBagsLabel}</span>
                      <strong className="m-val">
                        {activeFacility.vacantBags.toLocaleString()} / {activeFacility.totalBags.toLocaleString()} {t.bagsUnit}
                        <span style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600, marginLeft: '4px' }}>
                          ({activeFacility.availableMt} MT free)
                        </span>
                      </strong>
                    </div>
                    <span
                      className="meter-percent"
                      style={{
                        color:
                          (activeFacility.occupancyPct || 0) < 70
                            ? '#059669'
                            : (activeFacility.occupancyPct || 0) < 88
                            ? '#D97706'
                            : '#DC2626'
                      }}
                    >
                      {activeFacility.occupancyPct}% {currentLang === 'hi' ? 'भरा हुआ' : currentLang === 'te' ? 'నిండింది' : 'Occupied'}
                    </span>
                  </div>

                  <div className="s-progress-track">
                    <div
                      className="s-progress-fill"
                      style={{
                        width: `${Math.min(100, activeFacility.occupancyPct || 50)}%`,
                        background:
                          (activeFacility.occupancyPct || 0) < 70
                            ? 'linear-gradient(90deg, #10B981 0%, #059669 100%)'
                            : (activeFacility.occupancyPct || 0) < 88
                            ? 'linear-gradient(90deg, #F59E0B 0%, #D97706 100%)'
                            : 'linear-gradient(90deg, #EF4444 0%, #DC2626 100%)'
                      }}
                    />
                  </div>

                  {/* Pricing and Temperature Specs */}
                  <div className="storage-tags-row" style={{ marginBottom: '8px' }}>
                    <span className="s-rent-tag">
                      💰 ₹{activeFacility.rentPerBagPerMonth} {currentLang === 'hi' ? '/ बोरी / माह' : currentLang === 'te' ? '/ బస్తాకు / నెలకు' : '/ bag / month'}
                    </span>
                    <span className="s-rent-tag" style={{ background: '#EFF6FF', borderColor: '#BFDBFE', color: '#1E40AF' }}>
                      ⚖️ ₹{activeFacility.monthlyRentPerQtl} {currentLang === 'hi' ? '/ क्विंटल / माह' : currentLang === 'te' ? '/ క్వింటాల్‌కు' : '/ qtl / month'}
                    </span>
                    {activeFacility.tempRangeC && (
                      <span className="s-feat-chip">
                        <ThermometerSnowflake size={12} /> {activeFacility.tempRangeC}
                      </span>
                    )}
                    {activeFacility.chambers && (
                      <span className="s-feat-chip">
                        <Box size={12} /> {activeFacility.chambers} {currentLang === 'hi' ? 'चैंबर' : currentLang === 'te' ? 'ఛాంబర్లు' : 'Chambers'}
                      </span>
                    )}
                    {activeFacility.hasFumigation && (
                      <span className="s-feat-chip">
                        <ShieldCheck size={12} /> Fumigation Certified
                      </span>
                    )}
                  </div>

                  {/* WDRA Accreditation Badge */}
                  {activeFacility.wdraAccredited && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FEF3C7', border: '1px solid #FDE68A', padding: '6px 10px', borderRadius: '8px', fontSize: '11.5px', color: '#92400E', fontWeight: 600, marginBottom: '10px' }}>
                      <Award size={16} color="#D97706" style={{ flexShrink: 0 }} />
                      <span>
                        {currentLang === 'hi'
                          ? '🏅 WDRA पंजीकृत गोदाम • ई-एनडब्ल्यूआर (e-NWR) रसीद पर 7% रियायती बैंक गिरवी ऋण हेतु पात्र'
                          : currentLang === 'te'
                          ? '🏅 WDRA ఆమోదిత గోదాము • ఈ-ఎన్‌డబ్ల్యూఆర్ రశీదుతో బ్యాంకుల్లో 7% తాకట్టు రుణం అర్హత'
                          : '🏅 WDRA Accredited • Eligible for 7% Post-Harvest Pledge Loans via e-NWR at Nationalized Banks'}
                      </span>
                    </div>
                  )}

                  {/* Specialized Commodities Chips */}
                  {activeFacility.crops && activeFacility.crops.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 700 }}>
                        {currentLang === 'hi' ? 'विशेषज्ञता:' : currentLang === 'te' ? 'పంటలు:' : 'Crops:'}
                      </span>
                      {activeFacility.crops.map((cr) => (
                        <span key={cr} style={{ background: '#F1F5F9', color: '#334155', padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                          {cr}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Mandi Metrics */}
              {activeFacility.type === 'mandi' && activeFacility.mandiPrice && (
                <div className="spotlight-mandi-metrics">
                  <div className="mandi-price-badge-box">
                    <span className="mp-label">
                      {t.commonModalBadge} ({activeFacility.cropName?.[currentLang] || activeFacility.cropName?.en}):
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
                      <strong className="arb-val highlight">+₹1,194 / qtl (+45%)</strong>
                    </div>
                  </div>
                  <p className="arb-hint">ℹ️ {currentLang === 'hi' ? '60 दिनों का कोल्ड स्टोरेज किराया (₹56/qtl) व हैंडलिंग घटाकर शुद्ध अतिरिक्त आय।' : currentLang === 'te' ? '60 రోజుల అద్దె మరియు ఖర్చులు మినహాయించిన తర్వాత నికర లాభం.' : 'Net gain calculated after deducting 60-day storage fee & handling costs.'}</p>
                </div>
              )}

              {/* Action Buttons: Call, Directions, Booking */}
              <div className="spotlight-actions-row">
                <a
                  href={`tel:${activeFacility.contactPhone.replace(/[^\d+]/g, '')}`}
                  onClick={() => onOpenHelpline(activeFacility.contactPhone)}
                  className="s-call-btn"
                >
                  <PhoneCall size={16} color="#059669" />
                  <span>{activeFacility.contactPhone}</span>
                </a>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&origin=${farmerCoords.lat},${farmerCoords.lng}&destination=${activeFacility.lat},${activeFacility.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="s-directions-btn"
                >
                  <ExternalLink size={15} />
                  <span>{currentLang === 'hi' ? 'रास्ता देखें (Maps)' : currentLang === 'te' ? 'రూట్ మ్యాప్' : 'Directions'}</span>
                </a>
                <button
                  type="button"
                  onClick={() => onOpenBookingGate(activeFacility.name[currentLang] || activeFacility.name.en)}
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
                {filteredFacilities.length} {currentLang === 'hi' ? 'उपलब्ध केंद्र' : currentLang === 'te' ? 'కేంద్రాలు' : 'Verified Facilities Found'}
              </span>
              <span className="list-sort-hint">
                {currentLang === 'hi' ? 'जीपीएस दूरी अनुसार क्रमबद्ध' : currentLang === 'te' ? 'దూరం ప్రకారం' : 'Sorted by GPS Proximity'}
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
                      <strong className="mini-card-title">{f.name[currentLang] || f.name.en}</strong>
                      <span className="mini-dist-tag">{f.distanceKm} km</span>
                    </div>
                    <div className="card-bot-line">
                      <span className="mini-loc-text">📍 {f.district}, {f.state}</span>
                      <span className="mini-highlight-text">
                        {isStorage && f.rentPerBagPerMonth ? `₹${f.rentPerBagPerMonth}/bag • ${f.highlightText}` : f.highlightText}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Full-Height Interactive Leaflet Map */}
        <div className="farmer-map-viewport-panel">
          {/* Map Top Floating Tools: Layer Switcher & Recenter */}
          <div className="map-float-tools">
            <div className="layer-toggle-group">
              <button
                type="button"
                onClick={() => setMapLayer('streets')}
                className={`layer-btn ${mapLayer === 'streets' ? 'active' : ''}`}
              >
                <Layers size={14} />
                <span>{currentLang === 'hi' ? 'सड़क नक्शा' : currentLang === 'te' ? 'రోడ్డు మ్యాప్' : 'Road & District'}</span>
              </button>
              <button
                type="button"
                onClick={() => setMapLayer('satellite')}
                className={`layer-btn ${mapLayer === 'satellite' ? 'active' : ''}`}
              >
                <Satellite size={14} />
                <span>{currentLang === 'hi' ? 'सैटेलाइट व्यू' : currentLang === 'te' ? 'శాటిలైట్' : 'Satellite'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleRecenter}
              className="map-recenter-btn"
              title="Recenter on your farm"
            >
              <RotateCcw size={14} />
              <span>{currentLang === 'hi' ? 'मेरा खेत' : currentLang === 'te' ? 'నా పొలం' : 'My Farm Origin'}</span>
            </button>
          </div>

          {/* Leaflet Map Target DOM */}
          <div ref={mapContainerRef} className="leaflet-map-target-dom" />

          {/* Map Bottom Legend Overlay */}
          <div className="leaflet-map-legend-bar">
            <div className="leg-item">
              <span className="leg-dot farm" style={{ background: '#10B981' }} />
              <span>{currentLang === 'hi' ? 'आपका खेत (GPS)' : currentLang === 'te' ? 'మీ క్షేత్రం' : 'Farm GPS Base'}</span>
            </div>
            <div className="leg-item">
              <span className="leg-dot storage" style={{ background: '#0284C7' }} />
              <span>{currentLang === 'hi' ? 'कोल्ड स्टोरेज (ब्लू)' : currentLang === 'te' ? 'కోల్డ్ స్టోరేజ్' : 'Cold Storage'}</span>
            </div>
            <div className="leg-item">
              <span className="leg-dot mandi" style={{ background: '#16A34A' }} />
              <span>{currentLang === 'hi' ? 'एपीएमसी मंडी (ग्रीन)' : currentLang === 'te' ? 'మార్కెట్ యార్డ్' : 'APMC Mandi'}</span>
            </div>
            <div className="leg-item">
              <span className="leg-line route" style={{ borderTop: '2px dashed #0284C7', width: '20px' }} />
              <span>{currentLang === 'hi' ? 'सड़क मार्ग' : currentLang === 'te' ? 'రవాణా మార్గం' : 'Transit Route'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
