import { useState, type FC } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import type { Language, LocationOption } from '../types';
import { translations } from '../data/i18n';
import { CROP_CHIPS } from '../data/mockData';
import { Search, Mic, Globe, User, MapPin, Sparkles } from 'lucide-react';

interface HeaderProps {
  currentLang: Language;
  onLanguageChange: (lang: Language) => void;
  isAiModeEnabled: boolean;
  onToggleAiMode: (enabled: boolean) => void;
  onOpenAiAssistant: () => void;
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
  isAiModeEnabled,
  onToggleAiMode: _onToggleAiMode,
  onOpenAiAssistant,
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
          const matchedCrop = CROP_CHIPS.find(
            (c) =>
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

  const handleSearchSubmit = () => {
    if (!searchQuery.trim()) return;
    const matchedCrop = CROP_CHIPS.find(
      (c) =>
        c.name[currentLang].toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.key.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (matchedCrop) {
      onSelectCrop(matchedCrop.key);
    }
    setShowSuggestions(false);
  };

  const filteredCrops = searchQuery.trim()
    ? CROP_CHIPS.filter(
        (c) =>
          c.name[currentLang].toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.key.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : CROP_CHIPS.slice(0, 5);

  const verifiedBadgeText =
    currentLang === 'hi' ? 'सत्यापित किसान' : currentLang === 'te' ? 'ధృవీకరించిన రైతు' : 'Verified Farmer';

  const nextLang = currentLang === 'hi' ? 'te' : currentLang === 'te' ? 'en' : 'hi';
  const langDisplay = currentLang === 'hi' ? 'हिन्दी' : currentLang === 'te' ? 'తెలుగు' : 'EN';

  return (
    <View style={styles.header}>
      {/* Brand Row */}
      <View style={styles.headerInner}>
        <View style={styles.brandRow}>
          <Text style={styles.brandIcon}>🌾</Text>
          <View>
            <Text style={styles.brandTitle}>{t.appName}</Text>
            <Text style={styles.brandTagline}>{t.tagline}</Text>
          </View>
        </View>

        {/* Search Bar Wrap */}
        <View style={styles.searchBarWrap}>
          <View style={styles.searchBox}>
            <Search size={18} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              placeholder={t.searchPlaceholder}
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onFocus={() => setShowSuggestions(true)}
              onChangeText={(txt) => {
                onSearchChange(txt);
                setShowSuggestions(true);
              }}
              onSubmitEditing={handleSearchSubmit}
            />
            <TouchableOpacity
              onPress={handleVoiceSearch}
              style={[styles.micBtn, isListening && styles.micBtnListening]}
              activeOpacity={0.7}
            >
              <Mic size={16} color={isListening ? '#DC2626' : '#2D5A27'} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSearchSubmit}
              style={styles.searchSubmitBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.searchSubmitText}>{t.searchBtn}</Text>
            </TouchableOpacity>
          </View>

          {/* Autocomplete Suggestions Popup */}
          {showSuggestions && (
            <View style={styles.suggestionsDropdown}>
              <View style={styles.suggestionsHeader}>
                <Text style={styles.suggestionsHeaderText}>{t.popularCropsLabel}</Text>
                <TouchableOpacity onPress={() => setShowSuggestions(false)} style={styles.closeSuggBtn}>
                  <Text style={styles.closeSuggText}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.suggestionsGrid}>
                {filteredCrops.map((c) => (
                  <TouchableOpacity
                    key={c.key}
                    onPress={() => {
                      onSelectCrop(c.key);
                      onSearchChange(c.name[currentLang]);
                      setShowSuggestions(false);
                    }}
                    style={styles.suggestionItem}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.suggIcon}>{c.icon}</Text>
                    <Text style={styles.suggName}>{c.name[currentLang]}</Text>
                    <Text style={styles.suggCount}>{c.count}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Actions Wrap: Location, Language, AI Mode, and Login */}
        <View style={styles.actionsWrap}>
          {/* Location Selector */}
          <TouchableOpacity
            onPress={onOpenLocationModal}
            style={styles.locationBtn}
            activeOpacity={0.7}
          >
            <MapPin size={14} color="#2D5A27" />
            <Text style={styles.locName}>{currentLocation.name[currentLang]}</Text>
            <Text style={styles.locChange}>{t.changeLocationBtn}</Text>
          </TouchableOpacity>

          {/* Quick Language Toggle */}
          <TouchableOpacity
            onPress={() => onLanguageChange(nextLang)}
            style={styles.langBtn}
            activeOpacity={0.7}
          >
            <Globe size={14} color="#334155" />
            <Text style={styles.langText}>{langDisplay}</Text>
          </TouchableOpacity>

          {/* AI Voice Assistant Mode Quick Launcher */}
          <TouchableOpacity
            onPress={onOpenAiAssistant}
            style={[styles.aiModeBtn, isAiModeEnabled ? styles.aiModeActive : styles.aiModeDisabled]}
            activeOpacity={0.8}
          >
            <Sparkles size={14} color={isAiModeEnabled ? '#FFE600' : '#94A3B8'} />
            <Text style={[styles.aiModeText, isAiModeEnabled && styles.aiModeTextActive]}>
              {isAiModeEnabled
                ? (currentLang === 'hi' ? 'एआई चालू' : currentLang === 'te' ? 'AI ఆన్' : 'AI Mode')
                : (currentLang === 'hi' ? 'एआई बंद' : currentLang === 'te' ? 'AI ఆఫ్' : 'AI Off')}
            </Text>
            <View style={[styles.aiStatusDot, isAiModeEnabled ? styles.aiDotOn : styles.aiDotOff]} />
          </TouchableOpacity>

          {/* Profile / Login Button */}
          <TouchableOpacity
            onPress={onOpenLogin}
            style={[styles.authBtn, isLoggedIn && styles.authBtnLoggedIn]}
            activeOpacity={0.8}
            accessibilityLabel={isLoggedIn ? verifiedBadgeText : t.loginBtn}
          >
            <User size={15} color={isLoggedIn ? '#2D5A27' : '#FFFFFF'} />
            <Text style={[styles.authBtnText, isLoggedIn && styles.authBtnTextLoggedIn]}>
              {isLoggedIn
                ? (userName || (currentLang === 'hi' ? 'किसान प्रोफाइल' : currentLang === 'te' ? 'రైతు ప్రొఫైల్' : 'Farmer Profile'))
                : t.loginBtn}
            </Text>
            {isLoggedIn && <View style={styles.authDot} />}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 10,
    paddingHorizontal: 16,
    zIndex: 100,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandIcon: {
    fontSize: 26,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E3F1A',
    letterSpacing: -0.3,
  },
  brandTagline: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  searchBarWrap: {
    flex: 1,
    minWidth: 260,
    position: 'relative',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
    paddingVertical: 4,
  },
  micBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: '#EFF7EE',
  },
  micBtnListening: {
    backgroundColor: '#FEE2E2',
  },
  searchSubmitBtn: {
    backgroundColor: '#2D5A27',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  searchSubmitText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  suggestionsDropdown: {
    position: 'absolute',
    top: 46,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    zIndex: 200,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  suggestionsHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  closeSuggBtn: {
    padding: 2,
  },
  closeSuggText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  suggIcon: {
    fontSize: 14,
  },
  suggName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  suggCount: {
    fontSize: 10,
    color: '#94A3B8',
  },
  actionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  locName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  locChange: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2D5A27',
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  langText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  aiModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  aiModeActive: {
    backgroundColor: '#2D5A27',
    borderColor: '#2D5A27',
  },
  aiModeDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  aiModeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  aiModeTextActive: {
    color: '#FFFFFF',
  },
  aiStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  aiDotOn: {
    backgroundColor: '#00E676',
  },
  aiDotOff: {
    backgroundColor: '#94A3B8',
  },
  authBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2D5A27',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  authBtnLoggedIn: {
    backgroundColor: '#EFF7EE',
    borderWidth: 1,
    borderColor: '#2D5A27',
  },
  authBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  authBtnTextLoggedIn: {
    color: '#2D5A27',
  },
  authDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
});
