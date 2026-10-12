import { useState, type FC } from 'react';
import type { Language } from '../types';
import { translations } from '../data/i18n';
import { Info, X, Check } from 'lucide-react';

interface GovtLagNoticeProps {
  currentLang: Language;
}

export const GovtLagNotice: FC<GovtLagNoticeProps> = ({ currentLang }) => {
  const [dismissed, setDismissed] = useState(false);
  const t = translations[currentLang];

  if (dismissed) return null;

  return (
    <div className="gov-notice-banner" role="alert">
      <div className="gov-notice-content">
        <Info className="gov-notice-icon" size={20} />
        <div className="gov-notice-text">
          <strong>{t.govLagTitle}:</strong> {t.govLagDesc}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="gov-notice-close"
        title={t.gotIt}
      >
        <Check size={14} />
        <span>{t.gotIt}</span>
        <X size={14} className="close-x" />
      </button>
    </div>
  );
};
