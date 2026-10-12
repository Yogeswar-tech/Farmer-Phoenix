import { useState, type FC } from 'react';
import type { Language, LocationOption } from '../types';
import { AGRICULTURAL_LOCATIONS } from '../data/mockData';
import { translations } from '../data/i18n';
import { MapPin, Search, Check, X, Building2 } from 'lucide-react';

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

  if (!isOpen) return null;

  const filteredLocations = AGRICULTURAL_LOCATIONS.filter((loc) => {
    const term = searchTerm.toLowerCase();
    return (
      loc.name[currentLang].toLowerCase().includes(term) ||
      loc.state[currentLang].toLowerCase().includes(term) ||
      loc.mandiName[currentLang].toLowerCase().includes(term) ||
      loc.pincode.includes(term)
    );
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
            placeholder={t.searchLocationPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="loc-search-input"
            autoFocus
          />
          {searchTerm && (
            <button type="button" onClick={() => setSearchTerm('')} className="loc-clear-btn">
              ✕
            </button>
          )}
        </div>

        <div className="current-location-chip-banner">
          <span className="cur-label">{t.activeAgriZone}:</span>
          <strong className="cur-name">
            📍 {currentLocation.name[currentLang]}, {currentLocation.state[currentLang]} ({currentLocation.pincode})
          </strong>
        </div>

        <div className="locations-list">
          {filteredLocations.map((loc) => {
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
                    <span className="loc-mandi-name">{loc.mandiName[currentLang]}</span>
                    <span className="loc-sub-detail">
                      {loc.district[currentLang]}, {loc.state[currentLang]} · PIN {loc.pincode}
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

          {filteredLocations.length === 0 && (
            <div className="loc-empty-state">
              <p>
                {currentLang === 'hi'
                  ? `"${searchTerm}" से संबंधित कोई मंडी नहीं मिली। कृपया प्रमुख जिला या पिन कोड दर्ज करें।`
                  : currentLang === 'te'
                  ? `"${searchTerm}" కి సంబంధించిన మార్కెట్ కనుగొనబడలేదు.`
                  : `No mandi found matching "${searchTerm}". Try searching district or PIN code.`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
