import { useState, useEffect, useMemo, useCallback, type FC } from 'react';
import type { Language, LocationOption } from '../types';
import { GOVT_SCHEMES } from '../data/mockData';
import { KisanSethuApi } from '../services/api';
import {
  Landmark,
  PhoneCall,
  ExternalLink,
  CheckCircle,
  Percent,
  ShieldCheck,
  Sun,
  Coins,
  Search,
  X,
  FileQuestion,
  Sparkles
} from 'lucide-react';

interface SchemesSectionProps {
  currentLang: Language;
  currentLocation?: LocationOption;
  onOpenHelpline: (num: string) => void;
  onLockedFeatureClick: (featureName: string) => void;
}

export const SchemesSection: FC<SchemesSectionProps> = ({
  currentLang,
  currentLocation: _currentLocation,
  onOpenHelpline,
  onLockedFeatureClick: _onLockedFeatureClick
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [schemesData, setSchemesData] = useState<any[]>(GOVT_SCHEMES);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isSampleSchemes, setIsSampleSchemes] = useState<boolean>(false);

  const fetchScrapedSchemes = useCallback(async () => {
    try {
      // Fetch all schemes from PostgreSQL backend (or fallback)
      const res = await KisanSethuApi.getGovtSchemes('ALL', currentLang);
      const data = Array.isArray(res) ? res : res?.data;
      const isSampleData = Array.isArray(res) ? false : (res?.isSample ?? false);
      if (data && data.length > 0) {
        setSchemesData(data);
        setIsSampleSchemes(isSampleData);
      }
    } catch (err) {
      console.info('Backend syncing offline or error:', err);
      setIsSampleSchemes(true);
    }
  }, [currentLang]);

  useEffect(() => {
    const run = async () => {
      await fetchScrapedSchemes();
    };
    run();
  }, [fetchScrapedSchemes]);

  const categories = [
    { id: 'ALL', label: { en: 'All Schemes', hi: 'सभी योजनाएं', te: 'అన్ని పథకాలు' }, icon: Landmark },
    { id: 'LOAN', label: { en: '4% Crop Loans', hi: '4% फसली ऋण', te: '4% పంట రుణాలు' }, icon: Percent },
    { id: 'SUBSIDY', label: { en: 'Subsidies & Grants', hi: 'कृषि अनुदान', te: 'రాయితీలు' }, icon: Coins },
    { id: 'INSURANCE', label: { en: 'Crop Insurance', hi: 'फसल बीमा', te: 'పంట బీమా' }, icon: ShieldCheck },
    { id: 'SOLAR', label: { en: 'PM-KUSUM Solar', hi: 'सौर पंप सब्सिडी', te: 'సోలార్ పంపులు' }, icon: Sun }
  ];

  // Dynamic count calculation for each pill
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: schemesData.length,
      LOAN: 0,
      SUBSIDY: 0,
      INSURANCE: 0,
      SOLAR: 0
    };
    schemesData.forEach((s: any) => {
      const cat = s.category?.toUpperCase();
      if (cat && counts[cat] !== undefined) {
        counts[cat] += 1;
      }
    });
    return counts;
  }, [schemesData]);

  // Combined category and search filter
  const filteredSchemes = useMemo(() => {
    return schemesData.filter((scheme: any) => {
      const matchesCategory =
        selectedCategory === 'ALL' ||
        scheme.category?.toUpperCase() === selectedCategory;

      if (!matchesCategory) return false;

      if (!searchTerm.trim()) return true;

      const term = searchTerm.toLowerCase().trim();
      const title = (
        typeof scheme.title === 'string'
          ? scheme.title
          : scheme.title?.[currentLang] || scheme.title?.en || ''
      ).toLowerCase();
      const desc = (
        typeof scheme.shortDesc === 'string'
          ? scheme.shortDesc
          : scheme.shortDesc?.[currentLang] || scheme.shortDesc?.en || ''
      ).toLowerCase();
      const benefit = (
        typeof scheme.benefitAmount === 'string'
          ? scheme.benefitAmount
          : scheme.benefitAmount?.[currentLang] || scheme.benefitAmount?.en || ''
      ).toLowerCase();
      const tag = (
        typeof scheme.tag === 'string'
          ? scheme.tag
          : scheme.tag?.[currentLang] || scheme.tag?.en || ''
      ).toLowerCase();

      return (
        title.includes(term) ||
        desc.includes(term) ||
        benefit.includes(term) ||
        tag.includes(term)
      );
    });
  }, [schemesData, selectedCategory, searchTerm, currentLang]);

  return (
    <div className="schemes-container">
      {/* Sample Data Warning Banner */}
      {isSampleSchemes && (
        <div style={{
          background: '#FEF3C7',
          border: '1.5px solid #F59E0B',
          borderLeft: '5px solid #D97706',
          borderRadius: '10px',
          padding: '10px 16px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          fontWeight: '600',
          color: '#92400E'
        }}>
          <Sparkles size={15} style={{ flexShrink: 0 }} />
          <span>
            {currentLang === 'te'
              ? '⚠ నమూనా ప్రభుత్వ పథకాలు చూపబడుతున్నాయి — లైవ్ డేటా అందుబాటులో లేదు'
              : currentLang === 'hi'
                ? '⚠ नमूना सरकारी योजनाएं दिखाई जा रही हैं — लाइव डेटा उपलब्ध नहीं'
                : '⚠ Sample government schemes shown — live data unavailable'}
          </span>
        </div>
      )}
      {/* Header Strip */}
      <div className="schemes-header-strip">
        <div className="schemes-title-row">
          <div className="schemes-title-group">
            <div className="schemes-icon-badge">
              <Landmark size={24} color="#1B5E20" />
            </div>
            <div>
              <h2 className="schemes-title">
                {currentLang === 'hi'
                  ? 'सरकारी योजनाएं, 4% रियायती ऋण व कृषि सब्सिडी'
                  : currentLang === 'te'
                  ? 'ప్రభుత్వ పథకాలు, 4% రాయితీ రుణాలు & సబ్సిడీలు'
                  : 'Government Schemes, 4% Crop Loans & Subsidies'}
              </h2>
              <p className="schemes-sub">
                {currentLang === 'hi'
                  ? '4% फसली ऋण (KCC), पीएम-किसान एवं सौर पंप सब्सिडी'
                  : currentLang === 'te'
                  ? '4% పంట రుణాలు (KCC), పీఎం-కిసాన్ & సోలార్ పంపు సబ్సిడీలు'
                  : '4% Concessional Crop Loans (KCC), PM-KISAN & Solar Pump Subsidies'}
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar & Filter Controls */}
        <div className="schemes-controls-row">
          {/* Category Pills Bar */}
          <div className="schemes-category-bar" role="tablist">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              const count = categoryCounts[cat.id] ?? 0;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`category-pill ${isSelected ? 'active' : ''}`}
                >
                  <Icon size={15} className="pill-icon" />
                  <span className="pill-label">{cat.label[currentLang]}</span>
                  <span className="pill-count-chip">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Search Input */}
          <div className="schemes-search-box">
            <Search size={15} className="schemes-search-icon" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={
                currentLang === 'hi'
                  ? 'योजना, सब्सिडी या 4% लोन खोजें...'
                  : currentLang === 'te'
                  ? 'పథకాలు, రాయితీలు లేదా 4% రుణాలు శోధించండి...'
                  : 'Search loans, subsidies, solar pumps...'
              }
              className="schemes-search-input"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="schemes-search-clear-btn"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Schemes Cards Grid or Resilient Empty State */}
      {filteredSchemes.length > 0 ? (
        <div className="schemes-grid">
          {filteredSchemes.map((scheme: any) => {
            const title =
              typeof scheme.title === 'string'
                ? scheme.title
                : scheme.title?.[currentLang] || scheme.title?.en || 'Scheme';
            const desc =
              typeof scheme.shortDesc === 'string'
                ? scheme.shortDesc
                : scheme.shortDesc?.[currentLang] || scheme.shortDesc?.en || '';
            const benefit =
              typeof scheme.benefitAmount === 'string'
                ? scheme.benefitAmount
                : scheme.benefitAmount?.[currentLang] || scheme.benefitAmount?.en || 'N/A';
            const eligibility =
              typeof scheme.eligibility === 'string'
                ? scheme.eligibility
                : scheme.eligibility?.[currentLang] || scheme.eligibility?.en || '';
            const tag =
              typeof scheme.tag === 'string'
                ? scheme.tag
                : scheme.tag?.[currentLang] || scheme.tag?.en || 'Official Scheme';

            return (
              <div key={scheme.id} className="scheme-card">
                <div className="scheme-card-top">
                  <span className="scheme-tag">{tag}</span>
                  {scheme.interestRate && (
                    <span className="scheme-interest-badge">
                      <Sparkles size={11} />
                      <span>{scheme.interestRate}</span>
                    </span>
                  )}
                </div>

                <h3 className="scheme-card-title">{title}</h3>
                <p className="scheme-card-desc">{desc}</p>

                {/* Benefit Highlight Strip */}
                <div className="scheme-benefit-box">
                  <div className="scheme-benefit-label">
                    {currentLang === 'hi'
                      ? 'वित्तीय लाभ / अनुदान'
                      : currentLang === 'te'
                      ? 'ఆర్థిక ప్రయోజనం / సబ్సిడీ'
                      : 'Financial Benefit / Coverage'}
                  </div>
                  <div className="scheme-benefit-val">💰 {benefit}</div>
                </div>

                {/* Eligibility Preview */}
                <div className="scheme-eligibility-row">
                  <CheckCircle
                    size={16}
                    color="#2E7D32"
                    className="scheme-check-icon"
                  />
                  <span className="scheme-eligibility-text">{eligibility}</span>
                </div>

                {/* Action Buttons Row with Equal Proportions */}
                <div className="scheme-actions-row">
                  {scheme.helpline ? (
                    <button
                      type="button"
                      onClick={() => onOpenHelpline(scheme.helpline)}
                      className="scheme-helpline-btn"
                      title={`Toll-Free Helpline: ${scheme.helpline}`}
                    >
                      <PhoneCall size={14} className="scheme-phone-icon" />
                      <span className="scheme-helpline-text">{scheme.helpline}</span>
                    </button>
                  ) : (
                    <div style={{ flex: 1 }} />
                  )}

                  {scheme.applyUrl && (
                    <a
                      href={scheme.applyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="scheme-apply-btn"
                      title="Open official government application portal"
                    >
                      <span>
                        {currentLang === 'hi'
                          ? 'आवेदन पोर्टल'
                          : currentLang === 'te'
                          ? 'దరఖాస్తు పోర్టల్'
                          : 'Apply Online'}
                      </span>
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Friendly Empty State - Eliminates Blank Screen Voids */
        <div className="schemes-empty-state">
          <div className="schemes-empty-icon-wrap">
            <FileQuestion size={40} color="#2D5A27" />
          </div>
          <h4 className="schemes-empty-title">
            {currentLang === 'hi'
              ? 'इस श्रेणी या खोज में कोई योजना नहीं मिली'
              : currentLang === 'te'
              ? 'ఈ విభాగంలో లేదా శోధనలో ఏ పథకాలు లేవు'
              : 'No Schemes Found in this Category'}
          </h4>
          <p className="schemes-empty-desc">
            {currentLang === 'hi'
              ? 'चयनित फिल्टर या खोज शब्द के लिए कोई योजना नहीं मिली। सभी योजनाएं देखने के लिए रीसेट करें।'
              : currentLang === 'te'
              ? 'ఎంచుకున్న ఫిల్టర్‌కు సరిపోయే పథకాలు లేవు. అన్ని పథకాలను చూడటానికి రీసెట్ చేయండి.'
              : 'No verified policies match your current filter. Clear your search or explore all active agricultural schemes.'}
          </p>
          <button
            type="button"
            className="schemes-reset-btn"
            onClick={() => {
              setSelectedCategory('ALL');
              setSearchTerm('');
            }}
          >
            <Landmark size={15} />
            <span>
              {currentLang === 'hi'
                ? `सभी ${categoryCounts.ALL || 10} योजनाएं देखें`
                : currentLang === 'te'
                ? `అన్ని ${categoryCounts.ALL || 10} పథకాలు చూడండి`
                : `View All ${categoryCounts.ALL || 10} Schemes`}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

