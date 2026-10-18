import { useState, useRef, useEffect, type FC } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView } from 'react-native';
import type { Language, LocationOption } from '../types';
import { translations } from '../data/i18n';
import { CROP_CHIPS } from '../data/mockData';
import { Search, Mic, Globe, User, MapPin, Sparkles, ChevronDown, Check } from 'lucide-react';

interface HeaderProps {
  currentLang: Language;
  onLanguageChange: (lang: Language) => void;
  onOpenLogin: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectCrop: (cropKey: string) => void;
  isLoggedIn: boolean;
  userName?: string;
  currentLocation: LocationOption;
  onOpenLocationModal: () => void;
  onSelectLocation?: (loc: LocationOption) => void;
  onOpenAiAssistant?: () => void;
  isAiModeEnabled?: boolean;
}

export const Header: FC<HeaderProps> = ({
  currentLang,
  onLanguageChange,
  onOpenLogin,
  searchQuery,
  onSearchChange,
  onSelectCrop,
  isLoggedIn,
  userName,
  currentLocation,
  onOpenLocationModal,
  onSelectLocation,
  onOpenAiAssistant,
  isAiModeEnabled
}) => {
  const t = translations[currentLang];
  const [isListening, setIsListening] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 768;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const langDropdownRef = useRef<any>(null);

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (langDropdownRef.current && !langDropdownRef.current.contains(target)) {
        setShowLanguageDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
    };
  }, []);

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

  const langDisplay = currentLang === 'hi' ? 'हिन्दी' : currentLang === 'te' ? 'తెలుగు' : 'EN';

  return (
    <View style={[styles.header, isMobile && styles.headerMobile]}>
      {/* Brand & Search Inner Wrapper */}
      <View style={[styles.headerInner, isMobile && styles.headerInnerMobile]}>
        <View style={[styles.brandRow, isMobile && styles.brandRowMobile]}>
          <Text style={styles.brandIcon}>🌾</Text>
          <View>
            <Text style={[styles.brandTitle, isMobile && styles.brandTitleMobile]}>{t.appName}</Text>
            {!isMobile && <Text style={styles.brandTagline}>{t.tagline}</Text>}
          </View>
        </View>

        {/* Search Bar Wrap */}
        <View style={[styles.searchBarWrap, isMobile && styles.searchBarWrapMobile]}>
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
        <View style={[styles.actionsWrap, isMobile && styles.actionsWrapMobile]}>
          {/* Location Dropdown */}
          {/* Location Trigger: Directly opens Auto GPS & Location Modal */}
          <TouchableOpacity
            onPress={onOpenLocationModal}
            style={styles.locationBtn}
            activeOpacity={0.7}
            accessibilityLabel={t.selectLocationTitle}
          >
            <MapPin size={14} color="#2D5A27" />
            <Text style={styles.locName}>{currentLocation.name[currentLang]}</Text>
          </TouchableOpacity>

          {/* Language Dropdown */}
          <View ref={langDropdownRef} style={styles.dropdownContainer}>
            <TouchableOpacity
              onPress={() => {
                setShowLanguageDropdown((prev) => !prev);
              }}
              style={[styles.langBtn, showLanguageDropdown && styles.dropdownBtnActive]}
              activeOpacity={0.7}
              accessibilityLabel="Select Language"
            >
              <Globe size={14} color="#334155" />
              <Text style={styles.langText}>{langDisplay}</Text>
              <ChevronDown
                size={13}
                color="#334155"
                style={{
                  transform: showLanguageDropdown ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s ease'
                }}
              />
            </TouchableOpacity>

            {showLanguageDropdown && (
              <View style={styles.langMenuDropdown}>
                <View style={styles.dropdownHeaderRow}>
                  <Text style={styles.dropdownHeaderTitle}>
                    {currentLang === 'hi' ? 'भाषा चुनें' : currentLang === 'te' ? 'భాషను ఎంచుకోండి' : 'Language'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowLanguageDropdown(false)}
                    style={styles.closeDropdownBtn}
                    accessibilityLabel="Close"
                  >
                    <Text style={styles.closeDropdownText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {[
                  { code: 'hi' as Language, label: 'हिन्दी', sub: 'Hindi', flag: '🇮🇳' },
                  { code: 'te' as Language, label: 'తెలుగు', sub: 'Telugu', flag: '🇮🇳' },
                  { code: 'en' as Language, label: 'English', sub: 'EN', flag: '🌐' }
                ].map((item) => {
                  const isSelected = item.code === currentLang;
                  const handleSelectThisLang = () => {
                    onLanguageChange(item.code);
                    setShowLanguageDropdown(false);
                  };
                  return (
                    <TouchableOpacity
                      key={item.code}
                      onPress={handleSelectThisLang}
                      {...({
                        onClick: (e: any) => {
                          e.stopPropagation();
                          handleSelectThisLang();
                        }
                      } as any)}
                      style={[styles.langMenuItem, isSelected && styles.langMenuItemActive]}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 14 }}>{item.flag}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.langItemLabel, isSelected && styles.langItemLabelActive]}>
                          {item.label}
                        </Text>
                        <Text style={styles.langItemSub}>{item.sub}</Text>
                      </View>
                      {isSelected && <Check size={14} color="#2D5A27" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* AI Voice Assistant Mode Quick Launcher (Desktop Only; on mobile floating FAB handles it) */}
          {!isMobile && onOpenAiAssistant && (
            <TouchableOpacity
              onPress={onOpenAiAssistant}
              style={[styles.aiModeBtn, isAiModeEnabled ? styles.aiModeActive : styles.aiModeDisabled]}
              activeOpacity={0.6}
            >
              <Sparkles size={14} color={isAiModeEnabled ? '#FFE600' : '#94A3B8'} />
              <Text style={[styles.aiModeText, isAiModeEnabled && styles.aiModeTextActive]}>
                {isAiModeEnabled
                  ? (currentLang === 'hi' ? 'एआई चालू' : currentLang === 'te' ? 'AI ఆన్' : 'AI Mode')
                  : (currentLang === 'hi' ? 'एआई बंद' : currentLang === 'te' ? 'AI ఆఫ్' : 'AI Off')}
              </Text>
              <View style={[styles.aiStatusDot, isAiModeEnabled ? styles.aiDotOn : styles.aiDotOff]} />
            </TouchableOpacity>
          )}

          {/* Profile / Login Button */}
          <TouchableOpacity
            onPress={onOpenLogin}
            style={[styles.authBtn, isLoggedIn && styles.authBtnLoggedIn]}
            activeOpacity={0.8}
            accessibilityLabel={isLoggedIn ? verifiedBadgeText : 'Login'}
          >
            {isLoggedIn && (
              <User size={15} color="#2D5A27" />
            )}
            <Text style={[styles.authBtnText, isLoggedIn && styles.authBtnTextLoggedIn]}>
              {isLoggedIn
                ? (isMobile ? (userName?.split(' ')[0] || 'User') : (userName || (currentLang === 'hi' ? 'किसान प्रोफाइल' : currentLang === 'te' ? 'రైతు ప్రొఫైల్' : 'Farmer Profile')))
                : (currentLang === 'hi' ? 'लॉगिन' : currentLang === 'te' ? 'లాగిన్' : 'Login')}
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
    flexShrink: 0,
    position: 'sticky' as any,
    top: 0,
    width: '100%',
  },
  headerMobile: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'nowrap' as any,
    width: '100%',
  },
  headerInnerMobile: {
    flexWrap: 'wrap' as any,
    gap: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  brandRowMobile: {
    gap: 6,
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
  brandTitleMobile: {
    fontSize: 15,
  },
  brandTagline: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  searchBarWrap: {
    flex: 1,
    minWidth: 260,
    maxWidth: 440,
    position: 'relative',
    marginHorizontal: 16,
  },
  searchBarWrapMobile: {
    width: '100%',
    minWidth: '100%' as any,
    maxWidth: '100%' as any,
    marginHorizontal: 0,
    marginTop: 6,
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
    flexShrink: 0,
  },
  actionsWrapMobile: {
    gap: 6,
    marginLeft: 'auto' as any,
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
    paddingVertical: 9,
    paddingHorizontal: 22,
    borderRadius: 22,
    minHeight: 38,
  },
  authBtnLoggedIn: {
    backgroundColor: '#EFF7EE',
    borderWidth: 1.5,
    borderColor: '#2D5A27',
  },
  authBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
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
  dropdownGpsActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#86EFAC',
    cursor: 'pointer' as any,
  },
  dropdownGpsActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  dropdownContainer: {
    position: 'relative',
    zIndex: 110,
  },
  dropdownBtnActive: {
    backgroundColor: '#E2E8F0',
  },
  locationMenuDropdown: {
    position: 'absolute' as any,
    top: 36,
    right: 0,
    width: 290,
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 8,
    zIndex: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 6,
  },
  dropdownTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dropdownHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  closeDropdownBtn: {
    padding: 3,
  },
  closeDropdownText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '700',
  },
  locSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 6,
    marginBottom: 6,
  },
  locSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#1E293B',
    padding: 0,
  },
  locClearFilterText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  locListScroll: {
    maxHeight: 220,
  },
  locMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 2,
  },
  locMenuItemActive: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  locTextColumn: {
    flex: 1,
    minWidth: 0,
  },
  locItemMandi: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  locItemMandiActive: {
    color: '#2D5A27',
  },
  locItemSub: {
    fontSize: 10,
    color: '#64748B',
  },
  noLocFoundText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 10,
  },
  locMenuFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 6,
    paddingTop: 6,
    paddingHorizontal: 6,
  },
  locMenuFooterText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2D5A27',
    textAlign: 'center',
  },
  langMenuDropdown: {
    position: 'absolute' as any,
    top: 36,
    right: 0,
    width: 170,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 6,
    zIndex: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  langMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 2,
  },
  langMenuItemActive: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  langItemLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  langItemLabelActive: {
    color: '#2D5A27',
  },
  langItemSub: {
    fontSize: 10,
    color: '#64748B',
  },
});
