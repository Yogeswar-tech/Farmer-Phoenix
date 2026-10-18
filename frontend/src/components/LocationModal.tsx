import { useState, useEffect, useRef, type FC } from 'react';
import type { Language, LocationOption } from '../types';
import { AGRICULTURAL_LOCATIONS } from '../data/mockData';
import { translations } from '../data/i18n';
import {
  loadGoogleMapsSdk,
  searchGoogleAndAgriLocations,
  reverseGeocodeGpsCoordinates
} from '../services/googleMapsService';
import { KisanSethuApi } from '../services/api';
import {
  MapPin,
  Search,
  Check,
  X,
  Navigation,
  Loader2,
  AlertTriangle,
  Building2,
  Compass,
  ArrowLeft,
  Edit3,
  Lightbulb
} from 'lucide-react';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLocation: LocationOption;
  onSelectLocation: (loc: LocationOption, isAutoGps?: boolean) => void;
  currentLang: Language;
  isPostLoginPrompt?: boolean;
}

type ModalViewMode = 'auto_gps' | 'manual_search' | 'location_details';

export const LocationModal: FC<LocationModalProps> = ({
  isOpen,
  onClose,
  currentLocation,
  onSelectLocation,
  currentLang,
  isPostLoginPrompt = false
}) => {
  const t = translations[currentLang];

  const [viewMode, setViewMode] = useState<ModalViewMode>('auto_gps');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [remoteResults, setRemoteResults] = useState<LocationOption[]>([]);
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>('ALL');
  const [candidateLocation, setCandidateLocation] = useState<LocationOption | null>(null);
  const [isFromGps, setIsFromGps] = useState(false);
  const [isEditingPin, setIsEditingPin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isCalibratingPin, setIsCalibratingPin] = useState(false);
  const [calibrateSuccess, setCalibrateSuccess] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Initialize view mode and load Google Maps SDK
  useEffect(() => {
    if (isOpen) {
      loadGoogleMapsSdk().catch(() => {});
      if (isPostLoginPrompt) {
        setViewMode('auto_gps');
        setGpsError(null);
        triggerAutoGps();
      } else {
        setViewMode('auto_gps');
        setGpsError(null);
      }
    } else {
      setCandidateLocation(null);
      setGpsError(null);
      setSearchTerm('');
      setIsEditingPin(false);
      setPinError(null);
      setPinInput('');
      setCalibrateSuccess(false);
    }
  }, [isOpen, isPostLoginPrompt]);

  // Focus search input when switching to manual search
  useEffect(() => {
    if (viewMode === 'manual_search') {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [viewMode]);

  // Debounced search with Google Maps API and Pan-India Agricultural Geocoder
  useEffect(() => {
    if (!searchTerm.trim() || searchTerm.trim().length < 2) {
      const timer = setTimeout(() => {
        setRemoteResults([]);
      }, 0);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(async () => {
      setIsSearchingRemote(true);
      try {
        const found = await searchGoogleAndAgriLocations(searchTerm.trim(), currentLang);
        setRemoteResults(found);
      } catch (err) {
        console.warn('Location search error:', err);
      } finally {
        setIsSearchingRemote(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [searchTerm, currentLang]);

  if (!isOpen) return null;

  // High-Precision GPS Geolocation Handler
  const triggerAutoGps = () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setGpsError(
        currentLang === 'hi'
          ? 'आपके ब्राउज़र में जीपीएस सुविधा उपलब्ध नहीं है। कृपया नीचे स्थान का नाम लिखें।'
          : currentLang === 'te'
          ? 'మీ బ్రౌజర్‌లో జీపీఎస్ సదుపాయం లేదు. దయచేసి క్రింద లొకేషన్ నమోదు చేయండి.'
          : 'Geolocation is not supported by your browser. Please enter location manually.'
      );
      setViewMode('manual_search');
      return;
    }

    setIsLocating(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const resolvedLoc = await reverseGeocodeGpsCoordinates(lat, lon, currentLang);

          if (resolvedLoc) {
            setCandidateLocation(resolvedLoc);
            setIsFromGps(true);
            setViewMode('location_details');
          }
        } catch (err) {
          console.warn('GPS Reverse Geocoding failed:', err);
          setGpsError(
            currentLang === 'hi'
              ? 'जीपीएस स्थान का पता नहीं चल पाया। कृपया नीचे अपना गांव या मंडी खोजें।'
              : currentLang === 'te'
              ? 'జీపీఎస్ స్థానం లభించలేదు. దయచేసి క్రింద మీ గ్రామం లేదా మార్కెట్‌ను శోధించండి.'
              : 'Could not resolve farm address from GPS. Please search manually.'
          );
          setViewMode('manual_search');
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        let errorMsg = currentLang === 'hi'
          ? 'जीपीएस अनुमति अस्वीकार कर दी गई या सिग्नल कमजोर है। कृपया अपना स्थान मैन्युअल रूप से खोजें।'
          : currentLang === 'te'
          ? 'జీపీఎస్ అనుమతి నిరాకరించబడింది లేదా సిగ్నల్ బలహీనంగా ఉంది. దయచేసి మీ లొకేషన్ మాన్యువల్‌గా నమోదు చేయండి.'
          : 'GPS location permission denied or unavailable. Please search manually using Google Maps.';

        if (err.code === 1) {
          errorMsg = currentLang === 'hi'
            ? 'जीपीएस की अनुमति नहीं मिली। कृपया नीचे अपने गांव, मंडी या जिले का नाम लिखें।'
            : currentLang === 'te'
            ? 'జీపీఎస్ అనుమతి రద్దయింది. దయచేసి క్రింద మీ గ్రామం లేదా మార్కెట్ పేరు టైప్ చేయండి.'
            : 'GPS permission denied. Please enter your village, mandi, district or PIN code manually.';
        }
        setGpsError(errorMsg);
        setViewMode('manual_search');
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 0 }
    );
  };

  // Local static agricultural options filtered
  const term = searchTerm.toLowerCase();
  const filteredLocal = AGRICULTURAL_LOCATIONS.filter((loc) => {
    const matchesSearch =
      loc.name[currentLang]?.toLowerCase().includes(term) ||
      loc.name.en?.toLowerCase().includes(term) ||
      loc.state[currentLang]?.toLowerCase().includes(term) ||
      loc.state.en?.toLowerCase().includes(term) ||
      loc.district[currentLang]?.toLowerCase().includes(term) ||
      loc.district.en?.toLowerCase().includes(term) ||
      loc.pincode?.includes(term);

    const matchesState =
      selectedStateFilter === 'ALL' ||
      loc.state.en.toLowerCase().includes(selectedStateFilter.toLowerCase());

    return matchesSearch && matchesState;
  });

  // Clean deduplicated results list
  const combinedLocations = [...filteredLocal];
  remoteResults.forEach((r) => {
    if (!combinedLocations.some((c) => c.name.en.toLowerCase() === r.name.en.toLowerCase())) {
      combinedLocations.push(r);
    }
  });

  const stateFilters = [
    { id: 'ALL', label: 'All India' },
    { id: 'Andhra Pradesh', label: 'Andhra Pradesh' },
    { id: 'Telangana', label: 'Telangana' },
    { id: 'Maharashtra', label: 'Maharashtra' },
    { id: 'Karnataka', label: 'Karnataka' },
    { id: 'Punjab', label: 'Punjab' },
    { id: 'Uttar Pradesh', label: 'Uttar Pradesh' },
    { id: 'Gujarat', label: 'Gujarat' },
    { id: 'Madhya Pradesh', label: 'Madhya Pradesh' }
  ];

  // Calibrate location using exact 6-digit postal PIN code
  const handleCalibratePin = async (rawCode: string) => {
    const code = rawCode.trim();
    if (code.length !== 6) {
      setPinError(
        currentLang === 'hi'
          ? 'कृपया 6 अंकों का मान्य पिन कोड दर्ज करें'
          : currentLang === 'te'
          ? 'దయచేసి 6 అంకెల సరైన పిన్ కోడ్ నమోదు చేయండి'
          : 'Please enter a valid 6-digit PIN code'
      );
      return;
    }
    setIsCalibratingPin(true);
    setPinError(null);
    try {
      // 1. Check local AGRICULTURAL_LOCATIONS first (instant match)
      const localMatch = AGRICULTURAL_LOCATIONS.find((loc) => loc.pincode === code);
      if (localMatch) {
        setCandidateLocation(localMatch);
        setIsFromGps(false);
        setIsEditingPin(false);
        setCalibrateSuccess(true);
        setTimeout(() => setCalibrateSuccess(false), 4000);
        return;
      }

      // 2. Query Pan-India Geocoding API from backend
      const remote = await KisanSethuApi.searchClimateLocations(code);
      if (Array.isArray(remote) && remote.length > 0) {
        const best = remote.find((r) => r.pincode === code) || remote[0];
        const newLoc: LocationOption = {
          id: best.id || `pin-${code}`,
          name: {
            en: best.name || `PIN ${code}`,
            hi: best.name || `पिन ${code}`,
            te: best.name || `పిన్ ${code}`
          },
          district: {
            en: best.district || 'Local District',
            hi: best.district || 'स्थानीय जिला',
            te: best.district || 'స్థానిక జిల్లా'
          },
          state: {
            en: best.state || 'India',
            hi: best.state || 'भारत',
            te: best.state || 'భారత్'
          },
          mandiName: {
            en: `${best.name || best.district} APMC Yard`,
            hi: `${best.name || best.district} कृषि मंडी`,
            te: `${best.name || best.district} మార్కెట్ యార్డ్`
          },
          pincode: code,
          lat: best.latitude,
          lng: best.longitude
        };
        setCandidateLocation(newLoc);
        setIsFromGps(false);
        setIsEditingPin(false);
        setCalibrateSuccess(true);
        setTimeout(() => setCalibrateSuccess(false), 4000);
        return;
      }

      setPinError(
        currentLang === 'hi'
          ? `पिन कोड ${code} का विवरण नहीं मिला। कृपया मैन्युअल खोज का उपयोग करें।`
          : currentLang === 'te'
          ? `పిన్ కోడ్ ${code} వివరాలు లభించలేదు. దయచేసి మాన్యువల్‌గా శోధించండి.`
          : `Could not resolve PIN code ${code}. Please try manual search.`
      );
    } catch (err) {
      setPinError(
        currentLang === 'hi'
          ? 'पिन कोड से स्थान खोजने में त्रुटि हुई। कृपया मैन्युअल खोज का उपयोग करें।'
          : currentLang === 'te'
          ? 'పిన్ కోడ్ ద్వారా లొకేషన్ శోధించడంలో లోపం ఏర్పడింది. దయచేసి మాన్యువల్‌గా శోధించండి.'
          : 'Failed to calibrate location for PIN. Please try manual search.'
      );
    } finally {
      setIsCalibratingPin(false);
    }
  };

  // Confirm and set farm location
  const handleConfirmLocation = () => {
    const targetLoc = candidateLocation || currentLocation;
    onSelectLocation(targetLoc, isFromGps);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="clean-location-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="clean-loc-header">
          <div className="clean-loc-title-group">
            {viewMode === 'location_details' && (
              <button
                type="button"
                onClick={() => setViewMode(isFromGps ? 'auto_gps' : 'manual_search')}
                className="clean-loc-close-btn"
                style={{ marginRight: '4px' }}
                title="Back"
                aria-label="Back"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <span className="clean-loc-title">
              {viewMode === 'location_details'
                ? currentLang === 'hi'
                  ? 'स्थान विवरण'
                  : currentLang === 'te'
                  ? 'లొకేషన్ వివరాలు'
                  : 'Location Details'
                : isPostLoginPrompt
                ? currentLang === 'hi'
                  ? 'खेत का जीपीएस स्थान चुनें'
                  : currentLang === 'te'
                  ? 'పొలం జీపీఎస్ లొకేషన్ ఎంచుకోండి'
                  : 'Set Farm Location'
                : currentLang === 'hi'
                ? 'स्थान व मंडी चुनें'
                : currentLang === 'te'
                ? 'లొకేషన్ & మార్కెట్'
                : 'Select Location'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="clean-loc-close-btn"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switch between Auto GPS and Manual Search (hidden on details preview) */}
        {viewMode !== 'location_details' && (
          <div className="clean-loc-tab-bar">
            <button
              type="button"
              onClick={() => {
                setViewMode('auto_gps');
                setGpsError(null);
              }}
              className={`clean-loc-tab ${viewMode === 'auto_gps' ? 'active' : ''}`}
            >
              <Navigation size={13} />
              <span>{currentLang === 'hi' ? 'ऑटो जीपीएस' : currentLang === 'te' ? 'ఆటో జీపీఎస్' : 'Auto GPS'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('manual_search');
                setGpsError(null);
              }}
              className={`clean-loc-tab ${viewMode === 'manual_search' ? 'active' : ''}`}
            >
              <Search size={13} />
              <span>{currentLang === 'hi' ? 'मैन्युअल दर्ज करें' : currentLang === 'te' ? 'మాన్యువల్ నమోదు' : 'Enter Location Manually'}</span>
            </button>
          </div>
        )}

        {/* Alert banner if GPS could not be enabled */}
        {gpsError && viewMode === 'manual_search' && (
          <div className="clean-loc-alert-banner warning">
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div>{gpsError}</div>
              <button
                type="button"
                onClick={triggerAutoGps}
                className="clean-loc-alert-btn"
              >
                <Navigation size={11} />
                <span>{currentLang === 'hi' ? 'पुनः प्रयास करें' : currentLang === 'te' ? 'మళ్లీ ప్రయత్నించండి' : 'Retry Auto GPS'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ----------------- VIEW 1: AUTO GPS DETECTION VIEW ----------------- */}
        {viewMode === 'auto_gps' && (
          <div className="clean-gps-card">
            <div className="clean-gps-radar-wrap">
              {isLocating && <div className="clean-gps-radar-pulse" />}
              <div className="clean-gps-radar-core">
                {isLocating ? (
                  <Loader2 size={24} className="spin-icon" />
                ) : (
                  <Navigation size={24} />
                )}
              </div>
            </div>

            <div className="clean-gps-card-title">
              {isLocating
                ? currentLang === 'hi'
                  ? 'खेत का जीपीएस स्थान खोज रहे हैं...'
                  : currentLang === 'te'
                  ? 'పొలం జీపీఎస్ లొకేషన్ శోధిస్తున్నాము...'
                  : 'Acquiring Farm GPS Location...'
                : currentLang === 'hi'
                ? 'खेत का स्थान स्वतः पहचानें'
                : currentLang === 'te'
                ? 'పొలం లొకేషన్ స్వయంచాలకంగా గుర్తించండి'
                : 'Auto-Detect Farm Location'}
            </div>

            <p className="clean-gps-card-desc">
              {currentLang === 'hi'
                ? 'निकटतम मंडी भाव, सटीक मौसम पूर्वानुमान व फसल छिड़काव सलाह प्राप्त करने के लिए अपने डिवाइस का जीपीएस स्थान सक्षम करें।'
                : currentLang === 'te'
                ? 'సమీప మార్కెట్ ధరలు, ఖచ్చితమైన వాతావరణ సమాచారం కొరకు మీ పరికరం జీపీఎస్ స్థానాన్ని అనుమతించండి.'
                : 'Enable GPS location to automatically calibrate nearest APMC mandi rates, hyper-local weather alerts, and crop spray windows for your farm.'}
            </p>

            <button
              type="button"
              onClick={triggerAutoGps}
              disabled={isLocating}
              className="clean-gps-trigger-btn"
            >
              {isLocating ? (
                <>
                  <Loader2 size={16} className="spin-icon" />
                  <span>{currentLang === 'hi' ? 'स्थान प्राप्त कर रहे हैं...' : currentLang === 'te' ? 'లొకేషన్ గుర్తిస్తున్నాము...' : 'Detecting GPS...'}</span>
                </>
              ) : (
                <>
                  <Navigation size={16} />
                  <span>{currentLang === 'hi' ? 'वर्तमान जीपीएस स्थान का उपयोग करें' : currentLang === 'te' ? 'ప్రస్తుత జీపీఎస్ లొకేషన్ ఉపయోగించండి' : 'Use Current GPS Location'}</span>
                </>
              )}
            </button>

            {/* Action Buttons: Confirm Location + Enter Location Manually below */}
            <div className="clean-gps-actions">
              <button
                type="button"
                onClick={handleConfirmLocation}
                className="clean-confirm-loc-btn"
              >
                <Check size={16} />
                <span>
                  {currentLang === 'hi'
                    ? 'स्थान की पुष्टि करें'
                    : currentLang === 'te'
                    ? 'లొకేషన్ నిర్ధారించండి'
                    : 'Confirm Location'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewMode('manual_search');
                  setGpsError(null);
                }}
                className="clean-change-loc-btn"
              >
                <Search size={14} />
                <span>
                  {currentLang === 'hi'
                    ? 'स्थान मैन्युअल रूप से दर्ज करें'
                    : currentLang === 'te'
                    ? 'లొకేషన్ మాన్యువల్‌గా నమోదు చేయండి'
                    : 'Enter Location Manually'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ----------------- VIEW 2: MANUAL SEARCH VIEW (GOOGLE MAPS API) ----------------- */}
        {viewMode === 'manual_search' && (
          <>
            {/* Search Input Box */}
            <div className="clean-search-row">
              <div className="clean-search-box">
                <Search size={16} className="clean-search-icon" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={
                    currentLang === 'hi'
                      ? 'मंडी, शहर, जिला या पिनकोड खोजें...'
                      : currentLang === 'te'
                      ? 'మార్కెట్, నగరం, జిల్లా లేదా పిన్ వెతకండి...'
                      : 'Search mandi, city, district or PIN...'
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="clean-search-input"
                  autoFocus
                />
                {isSearchingRemote && (
                  <Loader2 size={15} className="spin-icon" style={{ color: '#16A34A', marginRight: '6px' }} />
                )}
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="clean-clear-btn"
                    aria-label="Clear"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Results List */}
            <div className="clean-results-list">
              {combinedLocations.map((loc) => {
                const isSelected = loc.id === currentLocation.id;
                const primaryName = loc.name[currentLang] || loc.name.en;
                const stateName = loc.state[currentLang] || loc.state.en;
                const districtName = loc.district[currentLang] || loc.district.en;

                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => {
                      setCandidateLocation(loc);
                      setIsFromGps(false);
                      setViewMode('location_details');
                    }}
                    className={`clean-item-row ${isSelected ? 'selected' : ''}`}
                  >
                    <div className="clean-item-left">
                      <div className={`clean-item-icon ${isSelected ? 'selected' : ''}`}>
                        <MapPin size={15} />
                      </div>
                      <div className="clean-item-info">
                        <span className="clean-item-primary">{primaryName}</span>
                        <span className="clean-item-secondary">
                          {districtName ? `${districtName}, ` : ''}${stateName}
                          {loc.pincode ? ` • PIN ${loc.pincode}` : ''}
                        </span>
                      </div>
                    </div>

                    {isSelected ? (
                      <span className="clean-item-badge">
                        <Check size={14} />
                      </span>
                    ) : (
                      <span className="clean-item-state-tag">{stateName}</span>
                    )}
                  </button>
                );
              })}

              {combinedLocations.length === 0 && !isSearchingRemote && (
                <div className="clean-empty-state">
                  <p>
                    {currentLang === 'hi'
                      ? `"${searchTerm}" से संबंधित कोई स्थान नहीं मिला। जिला या 6-अंकीय पिन कोड लिखकर देखें।`
                      : currentLang === 'te'
                      ? `"${searchTerm}" కి సంబంధించి ఫలితాలు లేవు. జిల్లా లేదా 6-అంకెల పిన్ కోడ్ ప్రయత్నించండి.`
                      : `No location found matching "${searchTerm}". Try district, taluk or 6-digit PIN.`}
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ----------------- VIEW 3: LOCATION DETAILS VIEW (NO MAP VIEW) ----------------- */}
        {viewMode === 'location_details' && candidateLocation && (
          <div className="clean-details-view">

            {/* Hero Card with Location Name */}
            <div className="clean-details-hero">
              <div className="clean-details-hero-title">
                {candidateLocation.name[currentLang] || candidateLocation.name.en}
              </div>
              <div className="clean-details-hero-sub">
                {candidateLocation.district[currentLang] || candidateLocation.district.en},{' '}
                {candidateLocation.state[currentLang] || candidateLocation.state.en}
                {candidateLocation.pincode ? ` - ${candidateLocation.pincode}` : ''}
              </div>
            </div>

            {/* Quick PIN Recalibration Box */}
            <div className="clean-pin-calibration-box">
              <div className="clean-pin-calibration-header">
                <span className="clean-pin-calibration-title" style={{ display: 'flex', alignItems: 'center' }}>
                  <MapPin size={14} style={{ color: '#16A34A', marginRight: 6, flexShrink: 0 }} />
                  {currentLang === 'hi'
                    ? 'पिन कोड या स्थान सही नहीं है? पिन से सेट करें:'
                    : currentLang === 'te'
                    ? 'పిన్ కోడ్ లేదా లొకేషన్ సరైనది కాదా? పిన్ ద్వారా సరిచేయండి:'
                    : 'PIN code or location incorrect? Calibrate with PIN:'}
                </span>
                {!isEditingPin && (
                  <button
                    type="button"
                    onClick={() => {
                      setPinInput(candidateLocation.pincode === '562130' ? '560037' : candidateLocation.pincode || '');
                      setIsEditingPin(true);
                      setPinError(null);
                    }}
                    className="clean-pin-quick-edit-btn"
                    style={{ display: 'flex', alignItems: 'center' }}
                  >
                    <Edit3 size={11} style={{ marginRight: 4 }} />
                    <span>
                      {currentLang === 'hi'
                        ? 'पिन बदलें (उदा. 560037)'
                        : currentLang === 'te'
                        ? 'పిన్ మార్చండి (ఉదా. 560037)'
                        : 'Edit PIN (e.g. 560037)'}
                    </span>
                  </button>
                )}
              </div>

              {isEditingPin && (
                <div className="clean-pin-edit-form">
                  <div className="clean-pin-input-group">
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="e.g. 560037"
                      value={pinInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setPinInput(val);
                        if (pinError) setPinError(null);
                      }}
                      className="clean-pin-code-input"
                      autoFocus
                    />
                    <button
                      type="button"
                      disabled={isCalibratingPin || pinInput.length !== 6}
                      onClick={() => handleCalibratePin(pinInput)}
                      className="clean-pin-apply-btn"
                    >
                      {isCalibratingPin ? (
                        <Loader2 size={13} className="spin-icon" />
                      ) : (
                        <Check size={13} />
                      )}
                      <span>
                        {currentLang === 'hi' ? 'पिन लागू करें' : currentLang === 'te' ? 'పిన్ వర్తింపజేయండి' : 'Apply PIN'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingPin(false)}
                      className="clean-pin-cancel-btn"
                      title="Cancel"
                    >
                      ✕
                    </button>
                  </div>
                  {pinError && <div className="clean-pin-error-text">{pinError}</div>}
                  <div className="clean-pin-hint-text" style={{ display: 'flex', alignItems: 'center' }}>
                    <Lightbulb size={13} style={{ color: '#D97706', marginRight: 5, flexShrink: 0 }} />
                    <span>
                      {currentLang === 'hi'
                        ? 'अपना 6 अंकों का पिन कोड (उदा. 560037) दर्ज करें। सही मंडी व मौसम स्वतः सेट हो जाएगा।'
                        : currentLang === 'te'
                        ? 'మీ 6 అంకెల పిన్ కోడ్ (ఉదా. 560037) నమోదు చేయండి. సరైన మార్కెట్ మరియు వాతావరణం సెట్ అవుతుంది.'
                        : 'Enter your 6-digit PIN (e.g. 560037) to automatically calibrate exact village, APMC mandi and weather.'}
                    </span>
                  </div>
                </div>
              )}

              {calibrateSuccess && (
                <div className="clean-pin-success-text" style={{ display: 'flex', alignItems: 'center' }}>
                  <Check size={14} style={{ color: '#16A34A', marginRight: 4 }} />
                  <span>
                    {currentLang === 'hi'
                      ? 'स्थान सफलतापूर्वक अपडेट हो गया!'
                      : currentLang === 'te'
                      ? 'లొకేషన్ విజయవంతంగా అప్‌డేట్ చేయబడింది!'
                      : 'Location calibrated successfully to your PIN code!'}
                  </span>
                </div>
              )}
            </div>

            {/* Grid of Structured Location Attributes (NO MAP VIEW) */}
            <div className="clean-details-grid">
              {/* District */}
              <div className="clean-details-cell">
                <div className="clean-details-cell-icon">
                  <Building2 size={15} />
                </div>
                <div className="clean-details-cell-body">
                  <span className="clean-details-cell-label">
                    {currentLang === 'hi' ? 'जिला / तहसील' : currentLang === 'te' ? 'జిల్లా / మండలం' : 'District / Tehsil'}
                  </span>
                  <span className="clean-details-cell-val">
                    {candidateLocation.district[currentLang] || candidateLocation.district.en || 'Local District'}
                  </span>
                </div>
              </div>

              {/* State */}
              <div className="clean-details-cell">
                <div className="clean-details-cell-icon">
                  <MapPin size={15} />
                </div>
                <div className="clean-details-cell-body">
                  <span className="clean-details-cell-label">
                    {currentLang === 'hi' ? 'राज्य' : currentLang === 'te' ? 'రాష్ట్రం' : 'State'}
                  </span>
                  <span className="clean-details-cell-val">
                    {candidateLocation.state[currentLang] || candidateLocation.state.en}
                  </span>
                </div>
              </div>

              {/* PIN Code */}
              <div className="clean-details-cell">
                <div className="clean-details-cell-icon">
                  <Compass size={15} />
                </div>
                <div className="clean-details-cell-body" style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="clean-details-cell-label">
                      {currentLang === 'hi' ? 'पिन कोड' : currentLang === 'te' ? 'పిన్ కోడ్' : 'Postal PIN Code'}
                    </span>
                    {!isEditingPin && (
                      <button
                        type="button"
                        onClick={() => {
                          setPinInput(candidateLocation.pincode === '562130' ? '560037' : candidateLocation.pincode || '');
                          setIsEditingPin(true);
                          setPinError(null);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#16A34A',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          padding: '0 2px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <Edit3 size={11} style={{ marginRight: 3 }} />
                        <span>{currentLang === 'hi' ? 'बदलें' : currentLang === 'te' ? 'మార్చండి' : 'Edit'}</span>
                      </button>
                    )}
                  </div>
                  <span className="clean-details-cell-val" style={{ color: candidateLocation.pincode === '560037' ? '#15803D' : undefined }}>
                    {candidateLocation.pincode || 'Available on GPS'}
                  </span>
                </div>
              </div>

              {/* GPS Coordinates */}
              <div className="clean-details-cell">
                <div className="clean-details-cell-icon">
                  <Navigation size={15} />
                </div>
                <div className="clean-details-cell-body">
                  <span className="clean-details-cell-label">
                    {currentLang === 'hi' ? 'जीपीएस निर्देशांक' : currentLang === 'te' ? 'జీపీఎస్ కోఆర్డినేట్స్' : 'GPS Coordinates'}
                  </span>
                  <span className="clean-details-cell-val">
                    {candidateLocation.lat && candidateLocation.lng
                      ? `${candidateLocation.lat.toFixed(4)}°N, ${candidateLocation.lng.toFixed(4)}°E`
                      : 'High Accuracy GPS'}
                  </span>
                </div>
              </div>
            </div>

            {/* Confirm & Enter Manually Actions */}
            <div className="clean-details-action-group">
              <button
                type="button"
                onClick={handleConfirmLocation}
                className="clean-confirm-loc-btn"
              >
                <Check size={16} />
                <span>
                  {currentLang === 'hi'
                    ? 'स्थान की पुष्टि करें'
                    : currentLang === 'te'
                    ? 'లొకేషన్ నిర్ధారించండి'
                    : 'Confirm Location'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('manual_search')}
                className="clean-change-loc-btn"
              >
                <Search size={14} />
                <span>
                  {currentLang === 'hi'
                    ? 'स्थान मैन्युअल रूप से दर्ज करें'
                    : currentLang === 'te'
                    ? 'లొకేషన్ మాన్యువల్‌గా నమోదు చేయండి'
                    : 'Enter Location Manually'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
