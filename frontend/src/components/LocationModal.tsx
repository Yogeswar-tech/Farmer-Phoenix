import { useState, useEffect, type FC } from 'react';
import type { Language, LocationOption } from '../types';
import { AGRICULTURAL_LOCATIONS } from '../data/mockData';
import { translations } from '../data/i18n';
import { KisanSethuApi } from '../services/api';
import { MapPin, Search, Check, X, Navigation, Loader2 } from 'lucide-react';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLocation: LocationOption;
  onSelectLocation: (loc: LocationOption, isAutoGps?: boolean) => void;
  currentLang: Language;
}

export const LocationModal: FC<LocationModalProps> = ({
  isOpen,
  onClose,
  currentLocation,
  onSelectLocation,
  currentLang
}) => {
  const t = translations[currentLang];
  const [searchTerm, setSearchTerm] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [remoteResults, setRemoteResults] = useState<LocationOption[]>([]);
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>('ALL');

  // Debounced Pan-India API search across 28 states & UTs
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
        const found = await KisanSethuApi.searchClimateLocations(searchTerm.trim());
        const mapped: LocationOption[] = found.map((f: any) => ({
          id: f.id,
          name: { hi: f.name, te: f.name, en: f.name },
          state: { hi: f.state, te: f.state, en: f.state },
          district: { hi: f.district, te: f.district, en: f.district },
          mandiName: {
            hi: f.name,
            te: f.name,
            en: f.name
          },
          pincode: f.pincode || '',
          lat: f.latitude,
          lng: f.longitude
        }));
        setRemoteResults(mapped);
      } catch (err) {
        console.warn('Location search error:', err);
      } finally {
        setIsSearchingRemote(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  if (!isOpen) return null;

  // Modern Auto-GPS Geolocation
  const handleDetectAutoGps = () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const resolved = await KisanSethuApi.reverseGeocodeLocation(lat, lon);

          let resolvedLoc: LocationOption;
          if (resolved) {
            resolvedLoc = {
              id: resolved.id || `gps-${lat.toFixed(4)}-${lon.toFixed(4)}`,
              name: { hi: resolved.name, te: resolved.name, en: resolved.name },
              state: { hi: resolved.state, te: resolved.state, en: resolved.state },
              district: { hi: resolved.district, te: resolved.district, en: resolved.district },
              mandiName: {
                hi: resolved.name,
                te: resolved.name,
                en: resolved.name
              },
              pincode: resolved.pincode || '',
              lat,
              lng: lon
            };
          } else {
            resolvedLoc = {
              id: `gps-${lat.toFixed(4)}-${lon.toFixed(4)}`,
              name: {
                hi: `खेत (${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E)`,
                te: `పొలం (${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E)`,
                en: `Farm (${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E)`
              },
              state: { hi: 'भारत', te: 'భారత్', en: 'India' },
              district: { hi: 'स्थानीय जिला', te: 'స్థానిక జిల్లా', en: 'Local' },
              mandiName: { hi: 'निकटतम मंडी', te: 'సమీప మార్కెట్', en: 'Nearest Mandi' },
              pincode: '',
              lat,
              lng: lon
            };
          }

          onSelectLocation(resolvedLoc, true);
          setIsLocating(false);
          onClose();
        } catch {
          setIsLocating(false);
          onClose();
        }
      },
      () => {
        setIsLocating(false);
        alert(
          currentLang === 'hi'
            ? 'जीपीएस स्थान प्राप्त नहीं हुआ। कृपया खोज बॉक्स में अपना गांव या जिला चुनें।'
            : currentLang === 'te'
            ? 'జీపీఎస్ స్థానం లభించలేదు. దయచేసి శోధన పెట్టెలో మీ గ్రామం లేదా జిల్లాను ఎంచుకోండి.'
            : 'Could not access GPS. Please type your city, mandi, or PIN code.'
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

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

  // Clean merged list without duplicates
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
    { id: 'Uttar Pradesh', label: 'UP' },
    { id: 'Gujarat', label: 'Gujarat' },
    { id: 'Madhya Pradesh', label: 'MP' }
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="clean-location-modal" onClick={(e) => e.stopPropagation()}>
        {/* Minimalist Header */}
        <div className="clean-loc-header">
          <div className="clean-loc-title-group">
            <span className="clean-loc-title">
              {currentLang === 'hi' ? 'स्थान चुनें' : currentLang === 'te' ? 'లొకేషన్ ఎంచుకోండి' : 'Select Location'}
            </span>
            <span className="clean-loc-tag">Pan-India</span>
          </div>
          <button type="button" onClick={onClose} className="clean-loc-close-btn" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Clean Search Bar + Auto-GPS Button Row */}
        <div className="clean-search-row">
          <div className="clean-search-box">
            <Search size={16} className="clean-search-icon" />
            <input
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
            {isSearchingRemote && <Loader2 size={15} className="spin-icon" style={{ color: '#16A34A', marginRight: '6px' }} />}
            {searchTerm && (
              <button type="button" onClick={() => setSearchTerm('')} className="clean-clear-btn" aria-label="Clear">
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleDetectAutoGps}
            disabled={isLocating}
            className="clean-gps-btn"
            title="Auto detect GPS"
          >
            {isLocating ? (
              <>
                <Loader2 size={14} className="spin-icon" />
                <span>Locating...</span>
              </>
            ) : (
              <>
                <Navigation size={14} />
                <span>Auto GPS</span>
              </>
            )}
          </button>
        </div>

        {/* State Filter Pills */}
        <div className="clean-filter-scroll">
          {stateFilters.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedStateFilter(s.id)}
              className={`clean-filter-chip ${selectedStateFilter === s.id ? 'active' : ''}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Active Selection Indicator */}
        <div className="clean-current-bar">
          <span className="clean-current-label">{t.activeAgriZone || 'Current'}:</span>
          <span className="clean-current-value">
            📍 {currentLocation.name[currentLang] || currentLocation.name.en}, {currentLocation.state[currentLang] || currentLocation.state.en}
            {currentLocation.pincode ? ` • PIN ${currentLocation.pincode}` : ''}
          </span>
        </div>

        {/* Clean Results List */}
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
                  onSelectLocation(loc, false);
                  onClose();
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
                      {districtName ? `${districtName}, ` : ''}{stateName}
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
                  ? `"${searchTerm}" से संबंधित कोई स्थान नहीं मिला।`
                  : currentLang === 'te'
                  ? `"${searchTerm}" కి సంబంధించి ఫలితాలు లేవు.`
                  : `No location found matching "${searchTerm}". Try district or PIN.`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
