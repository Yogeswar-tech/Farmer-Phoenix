import { useState, type FC } from 'react';
import type { Language } from '../types';
import { SOIL_DATA } from '../data/mockData';
import { translations } from '../data/i18n';
import { TestTube2, FileText, CheckCircle2, AlertCircle, UploadCloud, ShieldCheck } from 'lucide-react';

interface SoilDoctorViewProps {
  currentLang: Language;
  onOpenBookingGate: (featureName: string) => void;
}

export const SoilDoctorView: FC<SoilDoctorViewProps> = ({
  currentLang,
  onOpenBookingGate
}) => {
  const t = translations[currentLang];
  const [uploading, setUploading] = useState(false);
  const [reportUploaded, setReportUploaded] = useState(true);

  const handleSimulatePdfUpload = () => {
    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      setReportUploaded(true);
      alert(currentLang === 'hi' ? 'मृदा जांच पर्चा सफलतापूर्वक अपलोड हो गया!' : 'Soil test report uploaded successfully!');
    }, 1500);
  };

  return (
    <div className="soil-doctor-view-container">
      <div className="view-header-strip">
        <div className="title-row">
          <TestTube2 size={24} className="view-icon" />
          <h2 className="view-title">{t.soilDoctorTitle}</h2>
        </div>
        <p className="view-desc">{t.soilCardDesc}</p>
      </div>

      <div className="soil-layout-grid">
        {/* Soil Health Card Summary Card */}
        <div className="soil-card-profile">
          <div className="card-badge-row">
            <span className="shc-badge">
              <ShieldCheck size={14} />
              <span>सत्यापित मृदा स्वास्थ्य कार्ड (Verified SHC)</span>
            </span>
            <span className="sample-id">नमूना आईडी: {SOIL_DATA.sampleId}</span>
          </div>

          <div className="soil-meta-grid">
            <div className="meta-item">
              <span className="meta-lbl">{currentLang === 'hi' ? 'मिट्टी का प्रकार:' : 'Soil Classification:'}</span>
              <span className="meta-val">{SOIL_DATA.soilType[currentLang]}</span>
            </div>
            <div className="meta-item">
              <span className="meta-lbl">{t.phLabel}</span>
              <span className="meta-val ph">{SOIL_DATA.ph} ({SOIL_DATA.phStatus[currentLang]})</span>
            </div>
            <div className="meta-item">
              <span className="meta-lbl">{currentLang === 'hi' ? 'जैविक कार्बन:' : 'Organic Carbon:'}</span>
              <span className="meta-val">{SOIL_DATA.organicCarbon}% (संतोषजनक)</span>
            </div>
            <div className="meta-item">
              <span className="meta-lbl">{currentLang === 'hi' ? 'जांच दिनांक:' : 'Test Date:'}</span>
              <span className="meta-val">{SOIL_DATA.testDate}</span>
            </div>
          </div>

          {/* NPK Gauges */}
          <div className="npk-meters-section">
            <h4 className="npk-title">{t.npkOverview}</h4>
            <div className="npk-gauges-grid">
              {/* Nitrogen */}
              <div className="npk-meter-card">
                <div className="meter-head">
                  <span className="element-symbol">N</span>
                  <span className="element-name">{t.nitrogenLabel}</span>
                </div>
                <span className="nutrient-val">{SOIL_DATA.nitrogenKgPerHa} kg/ha</span>
                <span className="nutrient-status-tag low">
                  {currentLang === 'hi' ? 'कम (Low)' : 'Low'}
                </span>
                <div className="nutrient-bar">
                  <div className="bar-fill low" style={{ width: '40%' }} />
                </div>
              </div>

              {/* Phosphorus */}
              <div className="npk-meter-card">
                <div className="meter-head">
                  <span className="element-symbol">P</span>
                  <span className="element-name">{t.phosphorusLabel}</span>
                </div>
                <span className="nutrient-val">{SOIL_DATA.phosphorusKgPerHa} kg/ha</span>
                <span className="nutrient-status-tag medium">
                  {currentLang === 'hi' ? 'मध्यम (Medium)' : 'Medium'}
                </span>
                <div className="nutrient-bar">
                  <div className="bar-fill medium" style={{ width: '65%' }} />
                </div>
              </div>

              {/* Potassium */}
              <div className="npk-meter-card">
                <div className="meter-head">
                  <span className="element-symbol">K</span>
                  <span className="element-name">{t.potassiumLabel}</span>
                </div>
                <span className="nutrient-val">{SOIL_DATA.potassiumKgPerHa} kg/ha</span>
                <span className="nutrient-status-tag high">
                  {currentLang === 'hi' ? 'उच्च (High)' : 'High'}
                </span>
                <div className="nutrient-bar">
                  <div className="bar-fill high" style={{ width: '90%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Action: PDF Upload & Recommendations */}
        <div className="soil-action-panel">
          {/* Upload Box */}
          <div className="soil-upload-box">
            <UploadCloud size={32} className="upload-icon" />
            <h4>{currentLang === 'hi' ? 'मृदा जांच पर्चा (PDF/फोटो)' : 'Upload Soil Lab Report'}</h4>
            <p className="upload-hint">
              {currentLang === 'hi'
                ? 'कृषि विज्ञान केंद्र या निजी लैब की रिपोर्ट अपलोड करें'
                : 'Upload KVK or private lab report for precision AI prescription'}
            </p>
            <button
              type="button"
              onClick={handleSimulatePdfUpload}
              disabled={uploading}
              className="soil-upload-btn"
            >
              <FileText size={16} />
              <span>{uploading ? 'जांच हो रही है...' : t.uploadPdfBtn}</span>
            </button>
          </div>

          {/* AI Precision Fertilizer Recommendations */}
          {reportUploaded && (
            <div className="fertilizer-recommendations-card">
              <h4 className="rec-title">
                <CheckCircle2 size={18} />
                <span>{t.fertilizerRecommendationTitle}</span>
              </h4>
              <ul className="rec-list">
                {SOIL_DATA.recommendedFertilizers.map((rec, i) => (
                  <li key={i} className="rec-item">
                    <span className="rec-bullet">🌾</span>
                    <span className="rec-text">{rec[currentLang]}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Book Government Soil Test */}
          <div className="book-soil-test-strip">
            <AlertCircle size={20} className="soil-alert-icon" />
            <div className="strip-text">
              <strong>{currentLang === 'hi' ? 'निःशुल्क सरकारी मृदा जांच' : 'Free Government Soil Testing'}</strong>
              <p>
                {currentLang === 'hi'
                  ? 'अपने निकटतम कृषि विज्ञान केंद्र (KVK) से मिट्टी जांच करवाएं'
                  : 'Register sample pickup from nearest Krishi Vigyan Kendra'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenBookingGate('Free Government Soil Test')}
              className="book-soil-btn"
            >
              {t.bookSoilTestBtn}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
