import { useState, useEffect, type FC } from 'react';
import type { Language, LocationOption } from '../types';
import { AGRICULTURAL_LOCATIONS } from '../data/mockData';
import { translations } from '../data/i18n';
import { KisanSethuApi } from '../services/api';
import { MapPin, Search, Check, X, Building2, Navigation, Loader2 } from 'lucide-react';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLocation: LocationOption;
  onSelectLocation: (loc: LocationOption) => void;
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

  // Search All India Locations if not in local list
  useEffect(() => {
    if (!searchTerm.trim() || searchTerm.trim().length < 2) {
      setRemoteResults([]);
      return;
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
            hi: `${f.name} कृषि मंडी / केंद्र`,
            te: `${f.name} మార్కెట్ యార్డ్`,
            en: `${f.name} Agri Market Yard`
          },
          pincode: f.pincode || '',
          lat: f.latitude,
          lng: f.longitude
        }));
        setRemoteResults(mapped);
      } catch (err) {
        console.warn('Location modal remote search error:', err);
      } finally {
        setIsSearchingRemote(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  if (!isOpen) return null;

  const handleDetectGps = () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      alert('Geolocation is not supported in this browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const resolved = await KisanSethuApi.reverseGeocodeLocation(lat, lon);

          if (resolved) {
            const gpsLoc: LocationOption = {
              id: resolved.id,
              name: { hi: resolved.name, te: resolved.name, en: resolved.name },
              state: { hi: resolved.state, te: resolved.state, en: resolved.state },
              district: { hi: resolved.district, te: resolved.district, en: resolved.district },
              mandiName: {
                hi: `${resolved.name} कृषि क्षेत्र`,
                te: `${resolved.name} వ్యవసాయ ప్రాంతం`,
                en: `${resolved.name} Local Farm Area`
              },
              pincode: resolved.pincode || '',
              lat,
              lng: lon
            };
            onSelectLocation(gpsLoc);
          } else {
            const fallbackLoc: LocationOption = {
              id: `gps-${lat.toFixed(2)}-${lon.toFixed(2)}`,
              name: { hi: `खेत (${lat.toFixed(2)}°N)`, te: `పొలం (${lat.toFixed(2)}°N)`, en: `Farm (${lat.toFixed(2)}°N)` },
              state: { hi: 'भारत', te: 'భారత్', en: 'India' },
              district: { hi: 'स्थानीय जिला', te: 'స్థానిక జిల్లా', en: 'Local District' },
              mandiName: { hi: 'निकटतम कृषि मंडी', te: 'సమీప మార్కెట్', en: 'Nearest Agri Mandi' },
              pincode: '',
              lat,
              lng: lon
            };
            onSelectLocation(fallbackLoc);
          }
          setIsLocating(false);
          onClose();
        } catch (err) {
          setIsLocating(false);
          onClose();
        }
      },
      (_err) => {
        setIsLocating(false);
        alert(
          currentLang === 'hi'
            ? 'जीपीएस स्थान प्राप्त नहीं हुआ। कृपया खोज बॉक्स में अपना गांव या जिला लिखें।'
            : currentLang === 'te'
            ? 'జీపీఎస్ స్థానం లభించలేదు. దయచేసి శోధన పెట్టెలో మీ జిల్లాను ఎంచుకోండి.'
            : 'Could not access GPS location. Please type your district or PIN code.'
        );
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const term = searchTerm.toLowerCase();
  const filteredLocal = AGRICULTURAL_LOCATIONS.filter((loc) => {
    return (
      loc.name[currentLang]?.toLowerCase().includes(term) ||
      loc.name.en?.toLowerCase().includes(term) ||
      loc.state[currentLang]?.toLowerCase().includes(term) ||
      loc.state.en?.toLowerCase().includes(term) ||
      loc.district[currentLang]?.toLowerCase().includes(term) ||
      loc.district.en?.toLowerCase().includes(term) ||
      loc.pincode?.includes(term)
    );
  });

  // Combine local and remote results without duplicates
  const combinedLocations = [...filteredLocal];
  remoteResults.forEach((r) => {
    if (!combinedLocations.some((c) => c.name.en.toLowerCase() === r.name.en.toLowerCase())) {
      combinedLocations.push(r);
    }
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="location-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <MapPin className="modal-title-icon" size={20} />
            <h3 className="modal-title">{t.selectLocationTitle}</h3>
          </div>
          <button type="button" onClick={onClose} className="modal-close-btn" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="location-search-wrap">
          <Search size={16} className="loc-search-icon" />
          <input
            type="text"
            placeholder={
              currentLang === 'hi'
                ? 'पूरे भारत में कोई भी गांव, जिला या 6-अंकीय पिनकोड खोजें...'
                : currentLang === 'te'
                ? 'భారతదేశంలోని గ్రామం, జిల్లా లేదా పిన్‌కోడ్ శోధించండి...'
                : 'Search any village, district, or PIN code across India...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="loc-search-input"
            autoFocus
          />
          {isSearchingRemote && <Loader2 size={16} className="spin-icon" style={{ marginRight: '8px', color: '#059669' }} />}
          {searchTerm && (
            <button type="button" onClick={() => setSearchTerm('')} className="loc-clear-btn">
              ✕
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleDetectGps}
          disabled={isLocating}
          className="loc-gps-detect-btn"
        >
          {isLocating ? <Loader2 size={16} className="spin-icon" /> : <Navigation size={16} />}
          <span>
            {currentLang === 'hi'
              ? 'वर्तमान जीपीएस स्थान से खेत व मंडी चुनें (Auto-Detect GPS)'
              : currentLang === 'te'
              ? 'ప్రస్తుత జీపీఎస్ లొకేషన్ ఆధారంగా మార్కెట్ (Auto-Detect GPS)'
              : 'Use Current GPS Location (Auto-Detect Farm)'}
          </span>
        </button>

        <div className="current-location-chip-banner">
          <span className="cur-label">{t.activeAgriZone}:</span>
          <strong className="cur-name">
            📍 {currentLocation.name[currentLang] || currentLocation.name.en}, {currentLocation.state[currentLang] || currentLocation.state.en} ({currentLocation.pincode})
          </strong>
        </div>

        <div className="locations-list">
          {combinedLocations.map((loc) => {
            const isSelected = loc.id === currentLocation.id;
            return (
              <button
                key={loc.id}
                type="button"
                onClick={() => {
                  onSelectLocation(loc);
                  onClose();
                }}
                className={`location-list-item ${isSelected ? 'active-location' : ''}`}
              >
                <div className="loc-item-left">
                  <div className="loc-pin-box">
                    <Building2 size={16} />
                  </div>
                  <div className="loc-text-col">
                    <span className="loc-mandi-name">{loc.mandiName[currentLang] || loc.mandiName.en}</span>
                    <span className="loc-sub-detail">
                      {loc.name[currentLang] || loc.name.en}, {loc.district[currentLang] || loc.district.en}, {loc.state[currentLang] || loc.state.en} · PIN {loc.pincode || 'N/A'}
                    </span>
                  </div>
                </div>
                {isSelected ? (
                  <span className="loc-check-badge">
                    <Check size={14} />
                  </span>
                ) : (
                  <span className="loc-select-arrow">➔</span>
                )}
              </button>
            );
          })}

          {combinedLocations.length === 0 && !isSearchingRemote && (
            <div className="loc-empty-state">
              <p>
                {currentLang === 'hi'
                  ? `"${searchTerm}" से संबंधित कोई स्थान नहीं मिला। कृपया पिनकोड या तहसील का नाम लिखें।`
                  : `No location found matching "${searchTerm}". Try typing district, town, or 6-digit PIN code.`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
