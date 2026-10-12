import type { FC } from 'react';
import type { Language, GovtScheme } from '../types';
import { GOVT_SCHEMES } from '../data/mockData';
import { translations } from '../data/i18n';
import { Landmark, PhoneCall, ExternalLink, CheckCircle } from 'lucide-react';

interface SchemesSectionProps {
  currentLang: Language;
  onOpenHelpline: (num: string) => void;
  onLockedFeatureClick: (featureName: string) => void;
}

export const SchemesSection: FC<SchemesSectionProps> = ({
  currentLang,
  onOpenHelpline,
  onLockedFeatureClick
}) => {
  const t = translations[currentLang];

  const eligibilityLabel =
    currentLang === 'hi' ? 'पात्रता:' : currentLang === 'te' ? 'అర్హత:' : 'Eligibility:';

  const helplineLabel =
    currentLang === 'hi' ? 'हेल्पलाइन' : currentLang === 'te' ? 'హెల్ప్‌లైన్' : 'Helpline';

  const applyDetailsLabel =
    currentLang === 'hi'
      ? 'आवेदन प्रक्रिया देखें'
      : currentLang === 'te'
      ? 'దరఖాస్తు విధానం'
      : 'View Application Process';

  return (
    <div className="schemes-container">
      <div className="schemes-header">
        <div className="header-title-row">
          <Landmark size={24} className="schemes-icon" />
          <h2 className="schemes-title">{t.schemesTitle}</h2>
        </div>
        <p className="schemes-sub">
          {currentLang === 'hi'
            ? 'सरकारी अनुदान, फसल बीमा दावा एवं रियायती कृषि ऋण की संपूर्ण जानकारी'
            : currentLang === 'te'
            ? 'ప్రభుత్వ రాయితీలు, పంట బీమా క్లెయిమ్‌లు & తక్కువ వడ్డీ రుణాల వివరాలు'
            : 'Government subsidies, crop insurance claims & low-interest credit schemes'}
        </p>
      </div>

      <div className="schemes-grid">
        {GOVT_SCHEMES.map((scheme: GovtScheme) => (
          <div key={scheme.id} className="scheme-card">
            <div className="scheme-top">
              <span className="scheme-tag">{scheme.tag[currentLang]}</span>
              <span className="benefit-badge">{scheme.benefitAmount}</span>
            </div>

            <h3 className="scheme-heading">{scheme.title[currentLang]}</h3>
            <p className="scheme-desc">{scheme.shortDesc[currentLang]}</p>

            <div className="eligibility-box">
              <span className="box-label">
                <CheckCircle size={14} /> {eligibilityLabel}
              </span>
              <p className="box-text">{scheme.eligibility[currentLang]}</p>
            </div>

            <div className="scheme-actions-row">
              <button
                type="button"
                onClick={() => onOpenHelpline(scheme.helpline)}
                className="scheme-call-btn"
                title="Call Helpline"
              >
                <PhoneCall size={16} />
                <span>{helplineLabel}: {scheme.helpline}</span>
              </button>

              <button
                type="button"
                onClick={() => onLockedFeatureClick(scheme.title[currentLang])}
                className="scheme-apply-btn"
              >
                <span>{applyDetailsLabel}</span>
                <ExternalLink size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
