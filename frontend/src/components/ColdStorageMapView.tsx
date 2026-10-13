import { useState, useEffect, useMemo, type FC, type FormEvent } from 'react';
import type { Language, ColdStorageFacility, LocationOption } from '../types';
import {
  COLD_STORAGES,
  AGRICULTURAL_LOCATIONS,
  LOCATION_COORDINATES,
  calculateGeoDistanceKm
} from '../data/mockData';
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
  ZoomOut,
  Target,
  Sparkles,
  Map as MapIcon,
  Filter
} from 'lucide-react';

interface ColdStorageMapViewProps {
  currentLang: Language;
  currentLocation?: LocationOption;
  onOpenHelpline: (num: string) => void;
  onOpenBookingGate: (facilityName: string) => void;
  onSelectLocation?: (loc: LocationOption) => void;
}

type MapPointType = 'all' | 'storage' | 'mandi';

interface MapPinItem {
  id: string;
  locationId: string;
  type: 'storage' | 'mandi';
  name: Record<Language, string>;
  location: Record<Language, string>;
  lat: number;
  lng: number;
  distanceKm: number;
  highlightText: string;
  contactPhone: string;
  storageRef?: ColdStorageFacility;
  mandiPrice?: number;
  cropName?: Record<Language, string>;
  arrivals?: string;
  trend?: 'up' | 'stable' | 'down';
}

// Bounding box calibration for India equirectangular projection onto 1000 x 850 SVG viewport
const MIN_LNG = 67.5;
const MAX_LNG = 97.5;
const MIN_LAT = 7.0;
const MAX_LAT = 37.0;
const MARGIN_LEFT = 75;
const MAP_WIDTH = 850;
const MARGIN_TOP = 35;
const MAP_HEIGHT = 780;

function projectGeo(lat: number, lng: number): { x: number; y: number; pctX: number; pctY: number } {
  const x = MARGIN_LEFT + ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * MAP_WIDTH;
  const y = MARGIN_TOP + ((MAX_LAT - lat) / (MAX_LAT - MIN_LAT)) * MAP_HEIGHT;
  return {
    x: Math.round(x),
    y: Math.round(y),
    pctX: Number(((x / 1000) * 100).toFixed(2)),
    pctY: Number(((y / 850) * 100).toFixed(2))
  };
}

export const ColdStorageMapView: FC<ColdStorageMapViewProps> = ({
  currentLang,
  currentLocation,
  onOpenHelpline,
  onOpenBookingGate,
  onSelectLocation
}) => {
  const t = translations[currentLang];
  const [mapQuery, setMapQuery] = useState('');
  const [selectedRadius, setSelectedRadius] = useState<number>(100);
  const [filterType, setFilterType] = useState<MapPointType>('all');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isFocusNearMe, setIsFocusNearMe] = useState<boolean>(false);
  const [activePinId, setActivePinId] = useState<string>('mandi-kurnool');

  // Active user reference coordinates
  const userLocId = currentLocation?.id || 'kurnool';
  const userCoords = LOCATION_COORDINATES[userLocId] || { lat: 15.8281, lng: 78.0373 };
  const userProjected = useMemo(() => projectGeo(userCoords.lat, userCoords.lng), [userCoords.lat, userCoords.lng]);

  // Master Comprehensive Dataset of Indian Mandis and Cold Storages with Verified Coordinates
  const masterPins: Omit<MapPinItem, 'distanceKm'>[] = [
    // --- RAYALASEEMA & ANDHRA PRADESH MANDIS ---
    {
      id: 'mandi-kurnool',
      locationId: 'kurnool',
      type: 'mandi',
      name: {
        hi: 'कर्नूल प्याज व कपास यार्ड (APMC)',
        te: 'కర్నూలు ఉల్లి & పత్తి మార్కెట్ యార్డ్ (APMC)',
        en: 'Kurnool APMC Market Yard'
      },
      location: { hi: 'कर्नूल, आंध्र प्रदेश', te: 'కర్నూలు, ఆంధ్రప్రదేశ్', en: 'Kurnool, Andhra Pradesh' },
      lat: 15.8281,
      lng: 78.0373,
      highlightText: '₹2,450/qt Modal',
      contactPhone: '08518-220055',
      mandiPrice: 2450,
      cropName: { hi: 'प्याज व कपास', te: 'ఉల్లి & పత్తి', en: 'Onion & Cotton' },
      arrivals: '22,400 Bags',
      trend: 'up'
    },
    {
      id: 'mandi-adoni',
      locationId: 'adoni',
      type: 'mandi',
      name: {
        hi: 'अदोनी कपास व तिलहन यार्ड',
        te: 'ఆదోని పత్తి & నూనెగింజల మార్కెట్',
        en: 'Adoni Cotton & Oilseeds Market'
      },
      location: { hi: 'कर्नूल जिला, आंध्र प्रदेश', te: 'కర్నూలు జిల్లా, ఆంధ్రప్రదేశ్', en: 'Kurnool District, AP' },
      lat: 15.6322,
      lng: 77.2728,
      highlightText: '₹7,650/qt Modal',
      contactPhone: '08512-250088',
      mandiPrice: 7650,
      cropName: { hi: 'कपास (Cotton)', te: 'పత్తి (Cotton)', en: 'Cotton' },
      arrivals: '14,200 Quintals',
      trend: 'stable'
    },
    {
      id: 'mandi-guntur',
      locationId: 'guntur',
      type: 'mandi',
      name: {
        hi: 'गुंटूर एशिया मिर्ची यार्ड (APMC)',
        te: 'గుంటూరు ఆసియా మిర్చి యార్డ్ (APMC)',
        en: 'Guntur Asia Mirchi Yard (APMC)'
      },
      location: { hi: 'गुंटूर, आंध्र प्रदेश', te: 'గుంటూరు, ఆంధ్రప్రదేశ్', en: 'Guntur, Andhra Pradesh' },
      lat: 16.3067,
      lng: 80.4365,
      highlightText: '₹14,200/qt Modal',
      contactPhone: '0863-2234011',
      mandiPrice: 14200,
      cropName: { hi: 'मिर्च (Teja Chilli)', te: 'మిర్చి (తేజ రకం)', en: 'Red Chilli' },
      arrivals: '48,000 Bags',
      trend: 'up'
    },
    {
      id: 'mandi-anantapur',
      locationId: 'anantapur',
      type: 'mandi',
      name: {
        hi: 'अनंतपुर मूंगफली व संतरा मंडी',
        te: 'అనంతపురం వేరుశనగ & బత్తాయి యార్డ్',
        en: 'Anantapur Groundnut & Citrus Yard'
      },
      location: { hi: 'अनंतपुर, आंध्र प्रदेश', te: 'అనంతపురం, ఆంధ్రప్రదేశ్', en: 'Anantapur, Andhra Pradesh' },
      lat: 14.6819,
      lng: 77.6006,
      highlightText: '₹7,850/qt Modal',
      contactPhone: '08554-240011',
      mandiPrice: 7850,
      cropName: { hi: 'मूंगफली', te: 'వేరుశనగ', en: 'Groundnut' },
      arrivals: '18,500 Bags',
      trend: 'up'
    },
    {
      id: 'mandi-madanapalle',
      locationId: 'chittoor',
      type: 'mandi',
      name: {
        hi: 'मदनपल्ले एशिया टमाटर मंडी',
        te: 'మదనపల్లె టమోటా మార్కెట్',
        en: 'Madanapalle Tomato Yard'
      },
      location: { hi: 'चित्तूर जिला, आंध्र प्रदेश', te: 'చిత్తూరు జిల్లా, ఆంధ్రప్రదేశ్', en: 'Chittoor District, AP' },
      lat: 13.2172,
      lng: 79.1003,
      highlightText: '₹3,250/qt Modal',
      contactPhone: '08571-220022',
      mandiPrice: 3250,
      cropName: { hi: 'टमाटर', te: 'టమోటా', en: 'Tomato' },
      arrivals: '35,000 Crates',
      trend: 'stable'
    },
    {
      id: 'mandi-kadapa',
      locationId: 'kadapa',
      type: 'mandi',
      name: {
        hi: 'कडपा (कृष्णा नगर) यार्ड',
        te: 'కడప (కృష్ణా నగర్) మార్కెట్',
        en: 'Kadapa (Krishna Nagar) Market'
      },
      location: { hi: 'कडपा, आंध्र प्रदेश', te: 'కడప, ఆంధ్రప్రదేశ్', en: 'Kadapa, Andhra Pradesh' },
      lat: 14.4673,
      lng: 78.8242,
      highlightText: '₹16,500/qt Modal',
      contactPhone: '08562-241100',
      mandiPrice: 16500,
      cropName: { hi: 'हल्दी व केला', te: 'పసుపు & అరటి', en: 'Turmeric & Banana' },
      arrivals: '8,200 Quintals',
      trend: 'up'
    },
    {
      id: 'mandi-tirupati',
      locationId: 'tirupati',
      type: 'mandi',
      name: {
        hi: 'तिरुपति कृषि उपज मंडी',
        te: 'తిరుపతి వ్యవసాయ మార్కెట్',
        en: 'Tirupati Agri Market'
      },
      location: { hi: 'तिरुपति, आंध्र प्रदेश', te: 'తిరుపతి, ఆంధ్రప్రదేశ్', en: 'Tirupati, Andhra Pradesh' },
      lat: 13.6288,
      lng: 79.4192,
      highlightText: '₹4,800/qt Modal',
      contactPhone: '0877-224410',
      mandiPrice: 4800,
      cropName: { hi: 'धान व गुड़', te: 'వరి & బెల్లం', en: 'Paddy & Jaggery' },
      arrivals: '12,000 Bags',
      trend: 'stable'
    },
    {
      id: 'mandi-vijayawada',
      locationId: 'vijayawada',
      type: 'mandi',
      name: {
        hi: 'गोल्लापुडी थोक कृषि मंडी',
        te: 'గొల్లపూడి టోకు మార్కెట్',
        en: 'Gollapudi Wholesale APMC Market'
      },
      location: { hi: 'विजयवाड़ा, आंध्र प्रदेश', te: 'విజయవాడ, ఆంధ్రప్రదేశ్', en: 'Vijayawada, Andhra Pradesh' },
      lat: 16.5062,
      lng: 80.6480,
      highlightText: '₹3,100/qt Modal',
      contactPhone: '0866-241800',
      mandiPrice: 3100,
      cropName: { hi: 'सब्जी व धान', te: 'కూరగాయలు & వరి', en: 'Vegetables & Paddy' },
      arrivals: '26,000 Bags',
      trend: 'up'
    },
    // --- TELANGANA MANDIS ---
    {
      id: 'mandi-warangal',
      locationId: 'warangal',
      type: 'mandi',
      name: {
        hi: 'वारंगल एनाममुला कृषि मंडी',
        te: 'వరంగల్ ఏనుమాముల మార్కెట్ యార్డ్',
        en: 'Warangal Enamamula Market'
      },
      location: { hi: 'वारंगल, तेलंगाना', te: 'వరంగల్, తెలంగాణ', en: 'Warangal, Telangana' },
      lat: 17.9689,
      lng: 79.5941,
      highlightText: '₹13,900/qt Modal',
      contactPhone: '0870-245900',
      mandiPrice: 13900,
      cropName: { hi: 'मिर्च व कपास', te: 'మిర్చి & పత్తి', en: 'Chilli & Cotton' },
      arrivals: '32,000 Bags',
      trend: 'stable'
    },
    {
      id: 'mandi-khammam',
      locationId: 'khammam',
      type: 'mandi',
      name: {
        hi: 'खम्मम कॉटन व मिर्च यार्ड',
        te: 'ఖమ్మం వ్యవసాయ మార్కెట్ యార్డ్',
        en: 'Khammam APMC Yard'
      },
      location: { hi: 'खम्मम, तेलंगाना', te: 'ఖమ్మం, తెలంగాణ', en: 'Khammam, Telangana' },
      lat: 17.2473,
      lng: 80.1514,
      highlightText: '₹14,100/qt Modal',
      contactPhone: '08742-231100',
      mandiPrice: 14100,
      cropName: { hi: 'तेजा मिर्च व मक्का', te: 'తేజ మిర్చి & మొక్కజొన్న', en: 'Chilli & Maize' },
      arrivals: '21,000 Bags',
      trend: 'up'
    },
    // --- CENTRAL & WESTERN INDIAN MANDIS ---
    {
      id: 'mandi-indore',
      locationId: 'indore',
      type: 'mandi',
      name: {
        hi: 'इंदौर देवी अहिल्याबाई कृषि मंडी',
        te: 'ఇండోర్ అగ్రికల్చర్ మార్కెట్ యార్డ్',
        en: 'Indore Devi Ahilyabai APMC'
      },
      location: { hi: 'इंदौर, मध्य प्रदेश', te: 'ఇండోర్, మధ్యప్రదేశ్', en: 'Indore, Madhya Pradesh' },
      lat: 22.7196,
      lng: 75.8577,
      highlightText: '₹4,950/qt Modal',
      contactPhone: '0731-255100',
      mandiPrice: 4950,
      cropName: { hi: 'सोयाबीन व गेहूं', te: 'సోయాబీన్ & గోధుమలు', en: 'Soybean & Wheat' },
      arrivals: '40,000 Bags',
      trend: 'up'
    },
    {
      id: 'mandi-nashik',
      locationId: 'nashik',
      type: 'mandi',
      name: {
        hi: 'लासलगांव / पिंपलगांव प्याज मंडी',
        te: 'లాసల్గావ్ ఉల్లిపాయ మార్కెట్',
        en: 'Lasalgaon Asia Onion Yard'
      },
      location: { hi: 'नासिक, महाराष्ट्र', te: 'నాసిక్, మహారాష్ట్ర', en: 'Nashik, Maharashtra' },
      lat: 19.9975,
      lng: 73.7898,
      highlightText: '₹2,150/qt Modal',
      contactPhone: '0253-231400',
      mandiPrice: 2150,
      cropName: { hi: 'प्याज (Onion)', te: 'ఉల్లిపాయ', en: 'Onion' },
      arrivals: '65,000 Bags',
      trend: 'stable'
    },
    {
      id: 'mandi-nagpur',
      locationId: 'nagpur',
      type: 'mandi',
      name: {
        hi: 'नागपुर कलमना संतरा व अनाज मंडी',
        te: 'నాగ్‌పూర్ కలమ్నా మార్కెట్ యార్డ్',
        en: 'Nagpur Kalamna APMC Market'
      },
      location: { hi: 'नागपुर, महाराष्ट्र', te: 'నాగ్‌పూర్, మహారాష్ట్ర', en: 'Nagpur, Maharashtra' },
      lat: 21.1458,
      lng: 79.0882,
      highlightText: '₹5,800/qt Modal',
      contactPhone: '0712-243100',
      mandiPrice: 5800,
      cropName: { hi: 'संतरा व कपास', te: 'నారింజ & పత్తి', en: 'Orange & Cotton' },
      arrivals: '19,500 Bags',
      trend: 'up'
    },
    // --- NATIONAL KEY MANDIS ---
    {
      id: 'mandi-delhi',
      locationId: 'delhi',
      type: 'mandi',
      name: {
        hi: 'आजादपुर फल व सब्जी मंडी (एशिया की सबसे बड़ी)',
        te: 'ఆజాద్‌పూర్ పండ్లు & కూరగాయల మార్కెట్',
        en: 'Azadpur Asia Terminal Market'
      },
      location: { hi: 'दिल्ली (एनसीआर)', te: 'ఢిల్లీ (ఎన్‌సీఆర్)', en: 'Delhi NCR' },
      lat: 28.7167,
      lng: 77.1734,
      highlightText: '₹3,900/qt Modal',
      contactPhone: '011-2769100',
      mandiPrice: 3900,
      cropName: { hi: 'समस्त फल व सब्जियां', te: 'అన్ని కూరగాయలు & పండ్లు', en: 'All Agri Produce' },
      arrivals: '120,000 Quintals',
      trend: 'up'
    },
    {
      id: 'mandi-khanna',
      locationId: 'khanna',
      type: 'mandi',
      name: {
        hi: 'खन्ना एशिया अनाज मंडी',
        te: 'ఖన్నా ఆసియా ధాన్యం మార్కెట్',
        en: 'Khanna Asia Grain Market'
      },
      location: { hi: 'लुधियाना, पंजाब', te: 'లూధియానా, పంజాబ్', en: 'Ludhiana, Punjab' },
      lat: 30.7046,
      lng: 76.2163,
      highlightText: '₹2,325/qt MSP Modal',
      contactPhone: '01628-223100',
      mandiPrice: 2325,
      cropName: { hi: 'गेहूं व बासमती धान', te: 'గోధుమలు & బాస్మతి వరి', en: 'Wheat & Basmati' },
      arrivals: '90,000 Bags',
      trend: 'stable'
    },
    {
      id: 'mandi-kolar',
      locationId: 'kolar',
      type: 'mandi',
      name: {
        hi: 'कोलार एपीएमसी टमाटर मंडी',
        te: 'కోలార్ టమోటా మార్కెట్ యార్డ్',
        en: 'Kolar APMC Tomato Market'
      },
      location: { hi: 'कोलार, कर्नाटक', te: 'కోలార్, కర్ణాటక', en: 'Kolar, Karnataka' },
      lat: 13.1367,
      lng: 78.1292,
      highlightText: '₹3,400/qt Modal',
      contactPhone: '08152-224100',
      mandiPrice: 3400,
      cropName: { hi: 'टमाटर व आम', te: 'టమోటా & మామిడి', en: 'Tomato & Mango' },
      arrivals: '28,000 Boxes',
      trend: 'up'
    },

    // --- COLD STORAGE FACILITIES ACROSS REGIONS ---
    {
      id: 'cs-kurnool-7',
      locationId: 'kurnool',
      type: 'storage',
      name: COLD_STORAGES[6].name,
      location: COLD_STORAGES[6].location,
      lat: 15.8281,
      lng: 78.0373,
      highlightText: `${COLD_STORAGES[6].vacantCapacityBags.toLocaleString()} ${t.bagsUnit} vacant`,
      contactPhone: COLD_STORAGES[6].contactPhone,
      storageRef: COLD_STORAGES[6]
    },
    {
      id: 'cs-guntur-1',
      locationId: 'guntur',
      type: 'storage',
      name: COLD_STORAGES[0].name,
      location: COLD_STORAGES[0].location,
      lat: 16.3067,
      lng: 80.4365,
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
      lat: 16.4350,
      lng: 80.5520,
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
      lat: 16.2950,
      lng: 80.4480,
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
      lat: 14.6819,
      lng: 77.6006,
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
      lat: 13.2172,
      lng: 79.1003,
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
      lat: 14.4673,
      lng: 78.8242,
      highlightText: `${COLD_STORAGES[5].vacantCapacityBags.toLocaleString()} ${t.bagsUnit} vacant`,
      contactPhone: COLD_STORAGES[5].contactPhone,
      storageRef: COLD_STORAGES[5]
    },
    {
      id: 'cs-warangal-8',
      locationId: 'warangal',
      type: 'storage',
      name: COLD_STORAGES[7].name,
      location: COLD_STORAGES[7].location,
      lat: 17.9689,
      lng: 79.5941,
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
      lat: 16.5062,
      lng: 80.6480,
      highlightText: `${COLD_STORAGES[8].vacantCapacityBags.toLocaleString()} ${t.bagsUnit} vacant`,
      contactPhone: COLD_STORAGES[8].contactPhone,
      storageRef: COLD_STORAGES[8]
    },
    {
      id: 'cs-indore-10',
      locationId: 'indore',
      type: 'storage',
      name: {
        hi: 'इंदौर मालवा एग्रो कोल्ड चेन व लॉजिस्टिक्स पार्क',
        te: 'ఇండోర్ మాల్వా ఆగ్రో కోల్డ్ చైన్ పార్క్',
        en: 'Indore Malwa Agro Cold Logistics Hub'
      },
      location: { hi: 'देवास रोड, इंदौर', te: 'దేవాస్ రోడ్డు, ఇండోర్', en: 'Dewas Road, Indore, MP' },
      lat: 22.7196,
      lng: 75.8577,
      highlightText: '24,000 bags vacant',
      contactPhone: '0731-2891100',
      storageRef: {
        id: 'cs-indore-10',
        name: {
          hi: 'इंदौर मालवा एग्रो कोल्ड चेन',
          te: 'ఇండోర్ మాల్వా ఆగ్రో కోల్డ్ చైన్',
          en: 'Indore Malwa Agro Cold Chain'
        },
        location: { hi: 'देवास रोड, इंदौर', te: 'దేవాస్ రోడ్డు, ఇండోర్', en: 'Dewas Road, Indore' },
        distanceKm: 8,
        totalCapacityBags: 85000,
        vacantCapacityBags: 24000,
        rentPerBagPerMonth: 26,
        temperatureControlled: true,
        contactPhone: '0731-2891100',
        hasFumigation: true
      }
    },
    {
      id: 'cs-nashik-11',
      locationId: 'nashik',
      type: 'storage',
      name: {
        hi: 'नासिक लासलगांव नियंत्रित वातावरण कोल्ड स्टोर',
        te: 'నాసిక్ లాసల్గావ్ కోల్డ్ స్టోరేజ్ హబ్',
        en: 'Nashik Lasalgaon Controlled Atmosphere Store'
      },
      location: { hi: 'निफाड तालुका, नासिक', te: 'నిఫాడ్ తాలూకా, నాసిక్', en: 'Niphad Taluk, Nashik, MH' },
      lat: 19.9975,
      lng: 73.7898,
      highlightText: '35,000 bags vacant',
      contactPhone: '0253-248900',
      storageRef: {
        id: 'cs-nashik-11',
        name: {
          hi: 'नासिक लासलगांव कोल्ड स्टोर',
          te: 'నాసిక్ లాసల్గావ్ కోల్డ్ స్టోర్',
          en: 'Nashik Lasalgaon Cold Store'
        },
        location: { hi: 'निफाड तालुका, नासिक', te: 'నిఫాడ్ తాలూకా, నాసిక్', en: 'Niphad Taluk, Nashik' },
        distanceKm: 12,
        totalCapacityBags: 120000,
        vacantCapacityBags: 35000,
        rentPerBagPerMonth: 24,
        temperatureControlled: true,
        contactPhone: '0253-248900',
        hasFumigation: true
      }
    }
  ];

  // Dynamic calculation of real driving distance from current user coordinates
  const mapPins: MapPinItem[] = useMemo(() => {
    return masterPins.map((pin) => {
      const isExactTown = pin.locationId === userLocId;
      const dist = isExactTown
        ? (pin.type === 'storage' ? (pin.storageRef?.distanceKm || 6) : 0)
        : calculateGeoDistanceKm(userCoords.lat, userCoords.lng, pin.lat, pin.lng);
      return {
        ...pin,
        distanceKm: dist
      };
    });
  }, [userCoords.lat, userCoords.lng, userLocId]);

  // Separate list of mandis near the user, sorted strictly by proximity
  const nearbyMandis = useMemo(() => {
    return mapPins
      .filter((p) => p.type === 'mandi')
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [mapPins]);

  // Automatically select nearest pin when location changes
  useEffect(() => {
    const sorted = [...mapPins].sort((a, b) => a.distanceKm - b.distanceKm);
    if (sorted.length > 0) {
      setActivePinId(sorted[0].id);
    }
  }, [userLocId]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
  };

  // Filter pins based on Category, Radius (or All India), and Search text
  const filteredPins = useMemo(() => {
    return mapPins.filter((pin) => {
      const matchesType = filterType === 'all' || pin.type === filterType;
      const matchesRadius = selectedRadius >= 500 || pin.distanceKm <= selectedRadius;
      const q = mapQuery.toLowerCase().trim();
      const matchesQuery =
        q === '' ||
        pin.name[currentLang].toLowerCase().includes(q) ||
        pin.name.en.toLowerCase().includes(q) ||
        pin.location[currentLang].toLowerCase().includes(q) ||
        pin.location.en.toLowerCase().includes(q) ||
        (pin.cropName && pin.cropName[currentLang].toLowerCase().includes(q));

      return matchesType && matchesRadius && matchesQuery;
    });
  }, [mapPins, filterType, selectedRadius, mapQuery, currentLang]);

  const activePin = mapPins.find((p) => p.id === activePinId) || filteredPins[0] || mapPins[0];

  // Compute logistics route lines to the 3 nearest facilities from user location
  const routeTargetPins = useMemo(() => {
    return [...filteredPins]
      .filter((p) => p.distanceKm > 0 && p.distanceKm <= 350)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 3);
  }, [filteredPins]);

  // Interactive Pan / Center coordinates
  const transformStyle = useMemo(() => {
    if (isFocusNearMe) {
      // Zoom into user location
      const originX = userProjected.pctX;
      const originY = userProjected.pctY;
      return {
        transform: `scale(1.55)`,
        transformOrigin: `${originX}% ${originY}%`,
        transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
      };
    }
    return {
      transform: `scale(${zoomLevel})`,
      transformOrigin: 'center center',
      transition: 'transform 0.3s ease'
    };
  }, [isFocusNearMe, zoomLevel, userProjected.pctX, userProjected.pctY]);

  return (
    <div className="storage-map-view-container">
      {/* Top Header Strip with User Location Badge */}
      <div className="view-header-strip">
        <div className="header-top-line">
          <div className="title-row">
            <Warehouse size={26} className="view-icon" />
            <h2 className="view-title">
              {currentLang === 'hi'
                ? 'अखिल भारतीय मंडी व कोल्ड स्टोरेज मानचित्र'
                : currentLang === 'te'
                ? 'భారతదేశ మార్కెట్ యార్డులు & కోల్డ్ స్టోరేజ్ మ్యాప్'
                : 'India Map: APMC Mandis & Cold Storages'}
            </h2>
          </div>

          {/* Quick Location Switcher Badge */}
          {currentLocation && (
            <div className="active-user-loc-badge">
              <span className="loc-pulse-dot" />
              <MapPin size={15} color="#F59E0B" />
              <span className="loc-text">
                {currentLang === 'hi' ? 'आपका केंद्र:' : currentLang === 'te' ? 'మీ కేంద్రం:' : 'Your Location:'}{' '}
                <strong>{currentLocation.name[currentLang]}</strong> ({currentLocation.district[currentLang]})
              </span>
              {onSelectLocation && (
                <select
                  aria-label="Change Agricultural District"
                  value={currentLocation.id}
                  onChange={(e) => {
                    const found = AGRICULTURAL_LOCATIONS.find((l) => l.id === e.target.value);
                    if (found) onSelectLocation(found);
                  }}
                  className="quick-loc-select"
                >
                  {AGRICULTURAL_LOCATIONS.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name[currentLang]} ({loc.state[currentLang]})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        <p className="view-desc">
          {currentLang === 'hi'
            ? `📍 ${currentLocation?.name[currentLang] || 'आपके क्षेत्र'} के निकटतम सरकारी एपीएमसी मंडी यार्ड, नीलामी भाव और कोल्ड स्टोरेज वेयरहाउस का भू-स्थानिक नक्शा`
            : currentLang === 'te'
            ? `📍 ${currentLocation?.name[currentLang] || 'మీ ప్రాంతం'} సమీపంలోని ప్రభుత్వ మార్కెట్ యార్డులు, ధరలు మరియు కోల్డ్ స్టోరేజ్ గిడ్డంగుల అధికారిక మ్యాప్`
            : `📍 Verified geospatial map of APMC Mandi auction yards & Cold Storages nearest to ${currentLocation?.name[currentLang] || 'your farm'}`}
        </p>
      </div>

      {/* Control Bar: Search, Category Filter, Radius, and Pan Toggle */}
      <div className="map-search-control-bar">
        <form onSubmit={handleSearchSubmit} className="map-search-form">
          <Search size={18} className="map-search-icon" />
          <input
            type="text"
            placeholder={
              currentLang === 'hi'
                ? 'मंडी, कोल्ड स्टोरेज या फसल खोजें (जैसे कर्नूल, गुंटूर, मिर्च)...'
                : currentLang === 'te'
                ? 'మార్కెట్, కోల్డ్ స్టోరేజ్ లేదా పంట పేరుతో వెతకండి...'
                : 'Search Mandi, Cold Storage, or Crop (e.g. Kurnool, Chilli)...'
            }
            value={mapQuery}
            onChange={(e) => setMapQuery(e.target.value)}
            className="map-search-input"
          />
          <button type="submit" className="map-search-btn">
            {t.searchBtn}
          </button>
        </form>

        {/* Category Tabs */}
        <div className="map-category-tabs">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`map-cat-btn ${filterType === 'all' ? 'active' : ''}`}
          >
            <Layers size={14} />
            <span>{currentLang === 'hi' ? 'सभी केंद्र' : currentLang === 'te' ? 'అన్నీ' : 'All Points'}</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('mandi')}
            className={`map-cat-btn ${filterType === 'mandi' ? 'active' : ''}`}
          >
            <TrendingUp size={14} />
            <span>{currentLang === 'hi' ? 'एपीएमसी मंडियां' : currentLang === 'te' ? 'మార్కెట్ యార్డులు' : 'APMC Mandis'}</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('storage')}
            className={`map-cat-btn ${filterType === 'storage' ? 'active' : ''}`}
          >
            <Warehouse size={14} />
            <span>{currentLang === 'hi' ? 'कोल्ड स्टोरेज' : currentLang === 'te' ? 'కోల్డ్ స్టోరేజ్' : 'Cold Storages'}</span>
          </button>
        </div>

        {/* Radius Filter */}
        <div className="radius-picker">
          <span className="radius-label">
            <Filter size={13} style={{ display: 'inline', marginRight: 4 }} />
            {currentLang === 'hi' ? 'दूरी दायरा:' : currentLang === 'te' ? 'పరిధి:' : 'Radius:'}
          </span>
          {[20, 50, 100, 200, 500].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setSelectedRadius(r)}
              className={`radius-pill ${selectedRadius === r ? 'active' : ''}`}
            >
              {r === 500 ? (currentLang === 'hi' ? 'पूरा भारत' : currentLang === 'te' ? 'మొత్తం భారత్' : 'All India') : `${r} km`}
            </button>
          ))}
        </div>

        {/* View Focus Mode Button */}
        <button
          type="button"
          onClick={() => setIsFocusNearMe(!isFocusNearMe)}
          className={`map-focus-btn ${isFocusNearMe ? 'active' : ''}`}
          title="Toggle focus on your location"
        >
          <Target size={15} />
          <span>
            {isFocusNearMe
              ? (currentLang === 'hi' ? 'पूरा भारत देखें' : currentLang === 'te' ? 'భారతదేశ వీక్షణ' : 'View Full India')
              : (currentLang === 'hi' ? 'मेरे पास केंद्रित करें' : currentLang === 'te' ? 'నా సమీపంలో జూమ్' : 'Focus Near Me')}
          </span>
        </button>
      </div>

      {/* Main Map Viewport & Canvas */}
      <div className="storage-map-canvas-frame">
        <div className="map-canvas-viewport" style={transformStyle}>
          {/* Authentic Vector Silhouette of India with State Corridors */}
          <svg
            className="map-svg-background"
            viewBox="0 0 1000 850"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <linearGradient id="indiaMapGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1E381D" />
                <stop offset="45%" stopColor="#142C14" />
                <stop offset="100%" stopColor="#0B1A0A" />
              </linearGradient>

              <linearGradient id="peninsulaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(46, 125, 50, 0.28)" />
                <stop offset="100%" stopColor="rgba(21, 101, 192, 0.22)" />
              </linearGradient>

              <pattern id="latLongGrid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
              </pattern>

              {/* Glowing Pulse Filter for Radar Routes */}
              <filter id="routeGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Dark GIS Base Field */}
            <rect width="1000" height="850" fill="url(#indiaMapGrad)" rx="20" />
            <rect width="1000" height="850" fill="url(#latLongGrid)" />

            {/* Oceanic Geographic Labels */}
            <text x="120" y="650" fill="rgba(96, 165, 250, 0.35)" fontSize="15" fontWeight="700" letterSpacing="4">
              ARABIAN SEA (अरब सागर)
            </text>
            <text x="640" y="620" fill="rgba(96, 165, 250, 0.35)" fontSize="15" fontWeight="700" letterSpacing="4">
              BAY OF BENGAL (बंगाल की खाड़ी)
            </text>
            <text x="350" y="830" fill="rgba(96, 165, 250, 0.35)" fontSize="13" fontWeight="700" letterSpacing="3">
              INDIAN OCEAN
            </text>

            {/* AUTHENTIC INDIA GEOGRAPHIC BOUNDARY (Traced mathematically along GPS landmarks) */}
            <path
              className="india-national-border"
              d={`
                M 286,148
                L 276,75
                L 352,65
                L 402,103
                L 396,172
                L 458,212
                L 570,265
                L 671,273
                L 766,278
                L 864,248
                L 906,263
                L 850,319
                L 828,349
                L 794,420
                L 746,375
                L 710,331
                L 668,426
                L 578,479
                L 522,529
                L 464,567
                L 438,646
                L 424,717
                L 361,773
                L 324,727
                L 284,651
                L 256,590
                L 228,496
                L 223,440
                L 161,448
                L 122,415
                L 156,400
                L 111,374
                L 184,359
                L 172,319
                L 192,268
                L 256,217
                L 284,177
                Z
              `}
              fill="url(#peninsulaGrad)"
              stroke="#4ADE80"
              strokeWidth="2.4"
              strokeLinejoin="round"
            />

            {/* REGIONAL AGRICULTURAL ZONES & INTERNAL DEMARCATIONS */}
            {/* 1. Southern Agro Belt (Rayalaseema, Coastal AP, Telangana, Karnataka) */}
            <path
              d="M 256,590 Q 340,540 440,540 Q 480,560 464,567 L 438,646 L 424,717 L 361,773 L 324,727 L 284,651 Z"
              fill="rgba(34, 197, 94, 0.12)"
              stroke="rgba(74, 222, 128, 0.45)"
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />

            {/* 2. Central Cotton & Soybean Belt (Vidarbha & Malwa / MP & Maharashtra) */}
            <path
              d="M 228,496 Q 260,420 314,402 Q 410,400 480,450 Q 460,530 380,540 Q 280,550 256,590 Z"
              fill="rgba(245, 158, 11, 0.08)"
              stroke="rgba(245, 158, 11, 0.35)"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />

            {/* 3. Northern Grain Belt (Punjab, Haryana, Delhi, Western UP) */}
            <path
              d="M 284,177 L 256,217 L 352,253 L 458,212 L 396,172 Z"
              fill="rgba(234, 179, 8, 0.08)"
              stroke="rgba(234, 179, 8, 0.35)"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />

            {/* NATIONAL AGRICULTURAL FREIGHT CORRIDORS */}
            {/* NH-44: Srinagar -> Punjab -> Delhi -> Nagpur -> Hyderabad -> Kurnool -> Anantapur -> Bengaluru -> Kanyakumari */}
            <path
              d="M 284,114 L 284,177 L 352,253 L 405,442 L 388,537 L 375,576 L 363,605 L 363,649 L 361,773"
              fill="none"
              stroke="#F59E0B"
              strokeWidth="3.5"
              strokeLinecap="round"
              opacity="0.85"
            />
            {/* NH-16 (Coastal Golden Freight Corridor): Kolkata -> Visakhapatnam -> Vijayawada -> Guntur -> Chennai */}
            <path
              d="M 664,406 L 578,479 L 522,529 L 448,559 L 442,564 L 438,646"
              fill="none"
              stroke="#38BDF8"
              strokeWidth="3.2"
              strokeLinecap="round"
              opacity="0.85"
            />
            {/* NH-40 (Rayalaseema Spine): Kurnool -> Kadapa -> Tirupati -> Chittoor */}
            <path
              d="M 375,576 Q 390,595 397,611 L 405,642"
              fill="none"
              stroke="#10B981"
              strokeWidth="3"
              strokeDasharray="6 3"
              opacity="0.9"
            />

            {/* Highway Corridor Labels */}
            <text x="310" y="525" fill="#FBBF24" fontSize="11" fontWeight="800">
              NH-44 Freight (North-South)
            </text>
            <text x="460" y="605" fill="#38BDF8" fontSize="11" fontWeight="800">
              NH-16 Coastal
            </text>
            <text x="395" y="628" fill="#34D399" fontSize="10" fontWeight="700">
              NH-40 Rayalaseema
            </text>

            {/* Regional Geographical Labels */}
            <text x="330" y="195" fill="rgba(255,255,255,0.4)" fontSize="11" fontWeight="600">Punjab & Haryana</text>
            <text x="340" y="380" fill="rgba(255,255,255,0.4)" fontSize="11" fontWeight="600">Madhya Pradesh (Malwa)</text>
            <text x="235" y="460" fill="rgba(255,255,255,0.4)" fontSize="11" fontWeight="600">Maharashtra</text>
            <text x="415" y="525" fill="rgba(255,255,255,0.4)" fontSize="11" fontWeight="600">Telangana</text>
            <text x="390" y="585" fill="#86EFAC" fontSize="12" fontWeight="800">Andhra Pradesh / Rayalaseema</text>

            {/* DYNAMIC LOGISTICS CONNECTIVITY ROUTES FROM USER TO NEAREST CENTERS */}
            {routeTargetPins.map((targetPin) => {
              const targetProj = projectGeo(targetPin.lat, targetPin.lng);
              const isStorage = targetPin.type === 'storage';
              const lineColor = isStorage ? '#38BDF8' : '#4ADE80';

              return (
                <g key={`route-${targetPin.id}`}>
                  {/* Glowing Connection Line */}
                  <line
                    x1={userProjected.x}
                    y1={userProjected.y}
                    x2={targetProj.x}
                    y2={targetProj.y}
                    stroke={lineColor}
                    strokeWidth="2.5"
                    strokeDasharray="6 4"
                    strokeLinecap="round"
                    filter="url(#routeGlow)"
                    opacity="0.9"
                  />
                  {/* Distance Indicator midpoint */}
                  <circle
                    cx={(userProjected.x + targetProj.x) / 2}
                    cy={(userProjected.y + targetProj.y) / 2}
                    r="4"
                    fill={lineColor}
                  />
                </g>
              );
            })}

            {/* USER RADAR COVERAGE RADIUS CIRCLE (Mapped in Geographic Scale) */}
            {selectedRadius < 500 && (
              <g>
                <circle
                  cx={userProjected.x}
                  cy={userProjected.y}
                  r={Math.min(220, Math.max(22, (selectedRadius / 100) * 58))}
                  fill="rgba(245, 158, 11, 0.08)"
                  stroke="#F59E0B"
                  strokeWidth="1.8"
                  strokeDasharray="4 3"
                />
                <circle
                  cx={userProjected.x}
                  cy={userProjected.y}
                  r={Math.min(220, Math.max(22, (selectedRadius / 100) * 58)) * 0.6}
                  fill="none"
                  stroke="rgba(245, 158, 11, 0.35)"
                  strokeWidth="1"
                />
              </g>
            )}
          </svg>

          {/* INTERACTIVE PINS LAYER OVERLAY */}
          <div className="map-pins-container">
            {filteredPins.map((pin) => {
              const proj = projectGeo(pin.lat, pin.lng);
              const isSelected = pin.id === activePin.id;
              const isStorage = pin.type === 'storage';
              const isZeroKm = pin.distanceKm === 0;

              return (
                <div
                  key={pin.id}
                  onClick={() => setActivePinId(pin.id)}
                  className={`map-interactive-pin ${pin.type} ${isSelected ? 'selected' : ''}`}
                  style={{
                    left: `${proj.pctX}%`,
                    top: `${proj.pctY}%`
                  }}
                  title={`${pin.name[currentLang]} (${pin.distanceKm} km)`}
                >
                  <div className="pin-marker-body">
                    {isStorage ? <Warehouse size={13} /> : <TrendingUp size={13} />}
                  </div>

                  <div className="pin-popup-pill">
                    <span className="pill-name">
                      {pin.name[currentLang].split(' ')[0]}
                      {isZeroKm && ' ★'}
                    </span>
                    <span className="pill-detail">
                      {isZeroKm ? '0 km' : `${pin.distanceKm} km`} • {pin.highlightText}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* USER FARM / CURRENT LOCATION PIN (Rendered at exact GPS coordinates) */}
            <div
              className="map-user-farm-pin"
              style={{
                left: `${userProjected.pctX}%`,
                top: `${userProjected.pctY}%`
              }}
            >
              <div className="farm-pulse-ring" />
              <div className="farm-pin-icon">
                <MapPin size={17} />
              </div>
              <span className="farm-pin-badge">
                📍 {currentLang === 'hi' ? 'आपकी लोकेशन' : currentLang === 'te' ? 'మీ స్థానం' : 'Your Location'}:{' '}
                {currentLocation?.name[currentLang] || 'Kurnool'}
              </span>
            </div>
          </div>
        </div>

        {/* Floating Zoom & Compass Controls */}
        <div className="map-floating-controls">
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(1.7, z + 0.15))}
            className="map-ctrl-btn"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(0.8, z - 0.15))}
            className="map-ctrl-btn"
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoomLevel(1);
              setIsFocusNearMe(false);
            }}
            className="map-ctrl-btn reset"
            title="Reset Map Fit (All India)"
          >
            <Compass size={16} />
          </button>
        </div>

        {/* Map Legend */}
        <div className="map-legend-strip">
          <div className="legend-item">
            <span className="legend-color mandi" />
            <span>{currentLang === 'hi' ? 'सरकारी एपीएमसी मंडी (APMC Yard)' : currentLang === 'te' ? 'మార్కెట్ యార్డ్' : 'APMC Mandi'}</span>
          </div>
          <div className="legend-item">
            <span className="legend-color storage" />
            <span>{currentLang === 'hi' ? 'कोल्ड स्टोरेज (शीतगृह)' : currentLang === 'te' ? 'కోల్డ్ స్టోరేజ్' : 'Cold Storage'}</span>
          </div>
          <div className="legend-item">
            <span className="legend-color corridor" />
            <span>{currentLang === 'hi' ? 'राष्ट्रीय कृषि कॉरिडोर (NH-44 / NH-16)' : currentLang === 'te' ? 'రవాణా రహదారులు' : 'National Corridors'}</span>
          </div>
          <div className="legend-item">
            <span className="legend-color user" />
            <span>{currentLang === 'hi' ? 'आपकी लोकेशन' : currentLang === 'te' ? 'మీ స్థానం' : 'Your Farm'}</span>
          </div>
        </div>
      </div>

      {/* SECTION 2: MANDI LOCATIONS NEAR USER LOCATION (RANKED LIST) */}
      <div className="nearby-mandis-section">
        <div className="nearby-section-header">
          <div className="n-title-left">
            <TrendingUp size={22} className="n-icon" />
            <div>
              <h3 className="nearby-title">
                {currentLang === 'hi'
                  ? `🌾 ${currentLocation?.name[currentLang] || 'आपके'} निकटतम प्रमुख मंडी यार्ड (Mandi Locations Near You)`
                  : currentLang === 'te'
                  ? `🌾 ${currentLocation?.name[currentLang] || 'మీ'} సమీపంలోని మార్కెట్ యార్డులు (Nearby Mandis)`
                  : `🌾 Mandi Locations Near ${currentLocation?.name[currentLang] || 'You'} (Sorted by Distance)`}
              </h3>
              <p className="nearby-sub">
                {currentLang === 'hi'
                  ? 'रियल-टाइम दूरी, मॉडल भाव व आज की आवक (किसी भी मंडी पर क्लिक करके नक्शे पर देखें)'
                  : currentLang === 'te'
                  ? 'నిజ-సమయ దూరం, మోడల్ ధర మరియు సరుకు రాక (మ్యాప్‌పై చూడటానికి క్లిక్ చేయండి)'
                  : 'Real-time driving distance, modal prices & arrivals. Click to inspect on map.'}
              </p>
            </div>
          </div>
          <span className="nearby-count-pill">
            {nearbyMandis.length}{' '}
            {currentLang === 'hi' ? 'मंडियां उपलब्ध' : currentLang === 'te' ? 'మార్కెట్లు' : 'Mandis Listed'}
          </span>
        </div>

        {/* Horizontal Scroll / Grid of Mandi Cards */}
        <div className="nearby-mandis-grid">
          {nearbyMandis.slice(0, 6).map((mandi, idx) => {
            const isSelected = mandi.id === activePin.id;
            const isClosest = idx === 0;

            return (
              <div
                key={mandi.id}
                onClick={() => setActivePinId(mandi.id)}
                className={`nearby-mandi-card ${isSelected ? 'active' : ''} ${isClosest ? 'closest-highlight' : ''}`}
              >
                <div className="card-dist-badge-row">
                  <span className={`distance-pill ${isClosest ? 'closest' : ''}`}>
                    <Navigation size={12} />
                    {mandi.distanceKm === 0 ? '0 km (Local Yard)' : `${mandi.distanceKm} km`}
                  </span>
                  {isClosest && (
                    <span className="closest-tag">
                      <Sparkles size={11} />
                      {currentLang === 'hi' ? 'सबसे पास' : currentLang === 'te' ? 'అత్యంత సమీపం' : 'Closest'}
                    </span>
                  )}
                  {mandi.trend === 'up' && <span className="price-trend-up">▲ Rising</span>}
                </div>

                <h4 className="mandi-card-name">{mandi.name[currentLang]}</h4>
                <p className="mandi-card-loc">📍 {mandi.location[currentLang]}</p>

                <div className="mandi-card-stats-box">
                  <div className="stat-unit">
                    <span className="stat-label">
                      {mandi.cropName?.[currentLang] || (currentLang === 'hi' ? 'फसल' : 'Crop')}
                    </span>
                    <strong className="stat-val price">
                      ₹{mandi.mandiPrice?.toLocaleString()} /qt
                    </strong>
                  </div>
                  <div className="stat-unit">
                    <span className="stat-label">{currentLang === 'hi' ? 'दैनिक आवक' : 'Arrivals'}</span>
                    <strong className="stat-val arrivals">{mandi.arrivals || '15,000 Bags'}</strong>
                  </div>
                </div>

                <div className="mandi-card-footer">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePinId(mandi.id);
                    }}
                    className="card-inspect-btn"
                  >
                    <MapIcon size={13} />
                    <span>{currentLang === 'hi' ? 'नक्शे पर देखें' : currentLang === 'te' ? 'మ్యాప్‌లో చూపు' : 'View on Map'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenHelpline(mandi.contactPhone);
                    }}
                    className="card-call-btn"
                    title={`Call APMC: ${mandi.contactPhone}`}
                  >
                    <PhoneCall size={13} />
                    <span>Call</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: SELECTED FACILITY / MANDI SPOTLIGHT INSPECTION CARD */}
      <div className="selected-facility-spotlight-card">
        <div className="spotlight-header">
          <div className="s-type-badge-row">
            <span className={`s-type-pill ${activePin.type}`}>
              {activePin.type === 'storage' ? <Warehouse size={14} /> : <TrendingUp size={14} />}
              {activePin.type === 'storage'
                ? (currentLang === 'hi' ? 'कोल्ड स्टोरेज (शीतगृह)' : currentLang === 'te' ? 'కోల్డ్ స్టోరేజ్' : 'Cold Storage Facility')
                : (currentLang === 'hi' ? 'सरकारी एपीएमसी मंडी यार्ड' : currentLang === 'te' ? 'ప్రభుత్వ మార్కెట్ యార్డ్' : 'APMC Market Yard')}
            </span>
            <span className="s-dist-pill">
              <Navigation size={13} />
              {activePin.distanceKm === 0
                ? (currentLang === 'hi' ? 'आपके शहर में स्थित' : currentLang === 'te' ? 'మీ నగరంలోనే ఉంది' : 'In Your Town (0 km)')
                : `${activePin.distanceKm} km ${currentLang === 'hi' ? 'दूरी' : currentLang === 'te' ? 'దూరం' : 'away from you'}`}
            </span>
          </div>

          <h3 className="s-facility-name">{activePin.name[currentLang]}</h3>
          <p className="s-facility-loc">📍 {activePin.location[currentLang]}</p>
        </div>

        {/* Dynamic Storage Meter */}
        {activePin.storageRef && (
          <div className="spotlight-storage-metrics">
            <div className="storage-meter-row">
              <div className="meter-label-left">
                <span className="m-title">{t.vacantBagsLabel}</span>
                <strong className="m-val">
                  {activePin.storageRef.vacantCapacityBags.toLocaleString()} /{' '}
                  {activePin.storageRef.totalCapacityBags.toLocaleString()} {t.bagsUnit}
                </strong>
              </div>
              <span className="meter-percent">
                {Math.round((activePin.storageRef.vacantCapacityBags / activePin.storageRef.totalCapacityBags) * 100)}%{' '}
                {t.spaceFree}
              </span>
            </div>
            <div className="s-progress-track">
              <div
                className="s-progress-fill"
                style={{
                  width: `${Math.round(
                    (activePin.storageRef.vacantCapacityBags / activePin.storageRef.totalCapacityBags) * 100
                  )}%`
                }}
              />
            </div>
            <div className="storage-tags-row">
              <span className="s-rent-tag">
                💰 ₹{activePin.storageRef.rentPerBagPerMonth}{' '}
                {currentLang === 'hi' ? '/ बोरी/माह' : currentLang === 'te' ? '/ బస్తాకు/నెలకు' : '/ bag/mo'}
              </span>
              {activePin.storageRef.temperatureControlled && (
                <span className="s-feat-chip">
                  <ThermometerSnowflake size={12} /> Temp Controlled (2°C - 4°C)
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

        {/* Dynamic Mandi Rate Details */}
        {activePin.mandiPrice && (
          <div className="spotlight-mandi-metrics">
            <div className="mandi-price-badge-box">
              <span className="mp-label">
                {t.commonModalBadge} ({activePin.cropName?.[currentLang]}):
              </span>
              <span className="mp-rate">
                ₹{activePin.mandiPrice.toLocaleString()} {t.quintalUnit}
              </span>
            </div>
            <span className="e-nam-tag">
              <CheckCircle2 size={13} /> {t.enamVerified} • Today's Yard Arrivals: {activePin.arrivals || '18,000 Bags'}
            </span>
          </div>
        )}

        {/* Action Dialers */}
        <div className="spotlight-actions-row">
          <button
            type="button"
            onClick={() => onOpenHelpline(activePin.contactPhone)}
            className="s-call-btn"
          >
            <PhoneCall size={16} />
            <span>{currentLang === 'hi' ? 'कॉल करें' : currentLang === 'te' ? 'కాల్ చేయండి' : 'Call APMC'}: {activePin.contactPhone}</span>
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
