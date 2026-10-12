import { useState, type FC, type FormEvent } from 'react';
import type { Language, LocationOption } from '../types';
import { translations } from '../data/i18n';
import { CROP_CHIPS } from '../data/mockData';
import { Search, Mic, Globe, User, Smartphone, Monitor, MapPin } from 'lucide-react';

interface HeaderProps {
  currentLang: Language;
  onLanguageChange: (lang: Language) => void;
  isMobileSimulator: boolean;
  onToggleSimulator: () => void;
  onOpenLogin: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectCrop: (cropKey: string) => void;
  isLoggedIn: boolean;
  userName?: string;
  currentLocation: LocationOption;
  onOpenLocationModal: () => void;
}

export const Header: FC<HeaderProps> = ({
  currentLang,
  onLanguageChange,
  isMobileSimulator,
  onToggleSimulator,
  onOpenLogin,
  searchQuery,
  onSearchChange,
  onSelectCrop,
  isLoggedIn,
  userName,
  currentLocation,
  onOpenLocationModal
}) => {
  const t = translations[currentLang];
  const [isListening, setIsListening] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleVoiceSearch = () => {
    const win = window as any;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = currentLang === 'te' ? 'te-IN' : currentLang === 'hi' ? 'hi-IN' : 'en-IN';
        setIsListening(true);
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          onSearchChange(transcript);
          // Try matching crop
          const matchedCrop = CROP_CHIPS.find(
            c =>
              c.name[currentLang].toLowerCase().includes(transcript.toLowerCase()) ||
              c.key.toLowerCase().includes(transcript.toLowerCase())
          );
          if (matchedCrop) {
            onSelectCrop(matchedCrop.key);
          }
          setIsListening(false);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognition.start();
      } catch (e) {
        console.warn('Voice recognition error', e);
        setIsListening(false);
      }
    } else {
      alert(currentLang === 'hi' ? 'बोलकर खोजने की सुविधा उपलब्ध नहीं है।' : 'Voice search is not supported in this browser.');
    }
  };

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const matchedCrop = CROP_CHIPS.find(
      c =>
        c.name[currentLang].toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.key.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (matchedCrop) {
      onSelectCrop(matchedCrop.key);
    }
    setShowSuggestions(false);
  };

  const filteredCrops = searchQuery.trim()
    ? CROP_CHIPS.filter(c =>
        c.name[currentLang].toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.key.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : CROP_CHIPS.slice(0, 5);

  const verifiedBadgeText =
    currentLang === 'hi' ? 'सत्यापित किसान' : currentLang === 'te' ? 'ధృవీకరించిన రైతు' : 'Verified Farmer';

  return (
    <header className="header-container">
      <div className="header-inner">
        {/* Brand Logo & Name */}
        <div className="brand-col">
          <div className="brand-logo-wrap">
            <span className="brand-icon">🌾</span>
            <div>
              <h1 className="brand-title">{t.appName}</h1>
              <span className="brand-tagline">{t.tagline}</span>
            </div>
          </div>
        </div>

        {/* Search Bar with Search Button & Voice Command */}
        <div className="search-bar-wrap">
          <form onSubmit={handleSearchSubmit} className="search-box">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onFocus={() => setShowSuggestions(true)}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setShowSuggestions(true);
              }}
              className="search-input"
            />
            <button
              type="button"
              onClick={handleVoiceSearch}
              className={`mic-btn ${isListening ? 'listening' : ''}`}
              title={t.voiceSearch}
            >
              <Mic size={18} />
              {isListening && <span className="mic-pulse" />}
            </button>
            <button type="submit" className="search-submit-btn">
              {t.searchBtn}
            </button>
          </form>

          {/* Autocomplete Suggestions Popup */}
          {showSuggestions && (
            <div className="search-suggestions-dropdown">
              <div className="suggestions-header">
                <span>{t.popularCropsLabel}</span>
                <button
                  type="button"
                  onClick={() => setShowSuggestions(false)}
                  className="close-suggestions"
                >
                  ✕
                </button>
              </div>
              <div className="suggestions-grid">
                {filteredCrops.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => {
                      onSelectCrop(c.key);
                      onSearchChange(c.name[currentLang]);
                      setShowSuggestions(false);
                    }}
                    className="suggestion-item"
                  >
                    <span className="sugg-icon">{c.icon}</span>
                    <span className="sugg-name">{c.name[currentLang]}</span>
                    <span className="sugg-count">{c.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions: Location Tab, Language, Viewport Switch, and Far-Right Login */}
        <div className="actions-wrap">
          {/* Location Selector Tab */}
          <button
            type="button"
            onClick={onOpenLocationModal}
            className="location-header-btn"
            title={t.selectLocationTitle}
          >
            <MapPin size={15} className="loc-pin-icon" />
            <span className="loc-text-name">{currentLocation.name[currentLang]}</span>
            <span className="loc-change-tag">{t.changeLocationBtn}</span>
          </button>

          <div className="lang-picker">
            <Globe size={16} />
            <select
              value={currentLang}
              onChange={(e) => onLanguageChange(e.target.value as Language)}
              className="lang-select"
              aria-label="Language"
            >
              <option value="hi">हिन्दी</option>
              <option value="te">తెలుగు</option>
              <option value="en">English</option>
            </select>
          </div>

          <button
            type="button"
            onClick={onToggleSimulator}
            className="simulator-btn"
            title="Toggle Desktop / Mobile Simulator Mode"
          >
            {isMobileSimulator ? (
              <>
                <Monitor size={16} />
                <span className="btn-label">{t.desktopMode}</span>
              </>
            ) : (
              <>
                <Smartphone size={16} />
                <span className="btn-label">{t.mobileMode}</span>
              </>
            )}
          </button>

          {/* Login Option on Far Right */}
          <button
            type="button"
            onClick={onOpenLogin}
            className={`auth-btn ${isLoggedIn ? 'logged-in' : ''}`}
            title={isLoggedIn ? verifiedBadgeText : t.loginBtn}
          >
            <User size={16} />
            <span className="auth-btn-label">
              {isLoggedIn ? (userName || (currentLang === 'hi' ? 'किसान प्रोफाइल' : currentLang === 'te' ? 'రైతు ప్రొఫైల్' : 'Farmer Profile')) : t.loginBtn}
            </span>
            {isLoggedIn && <span className="auth-status-dot" />}
          </button>
        </div>
      </div>
    </header>
  );
};
