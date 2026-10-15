import { useState, useEffect, type FC } from 'react';
import type { Language, LocationOption } from '../types';
import { SOIL_DATA } from '../data/mockData';
import { translations } from '../data/i18n';
import { KisanSethuApi } from '../services/api';
import { TestTube2, FileText, CheckCircle2, AlertCircle, UploadCloud, ShieldCheck, RefreshCw } from 'lucide-react';

interface SoilDoctorViewProps {
  currentLang: Language;
  currentLocation?: LocationOption;
  onOpenBookingGate: (featureName: string) => void;
}

export const SoilDoctorView: FC<SoilDoctorViewProps> = ({
  currentLang,
  currentLocation,
  onOpenBookingGate
}) => {
  const t = translations[currentLang];
  const [uploading, setUploading] = useState(false);
  const [reportUploaded, setReportUploaded] = useState(true);
  const [soilCard, setSoilCard] = useState<any | null>(null);
  const [soilRecs, setSoilRecs] = useState<any | null>(null);

  const locId = currentLocation?.id || 'guntur';

  useEffect(() => {
    let isMounted = true;
    async function loadSoilData() {
      try {
        const card = await KisanSethuApi.getSoilHealthCard(locId, currentLang);
        if (isMounted && card && card.status === 'success') {
          setSoilCard(card);
        }
        const recs = await KisanSethuApi.calculateSoilRecommendation({
          cropKey: 'chilli',
          acres: 1.0,
          locationId: locId,
          lang: currentLang
        });
        if (isMounted && recs && recs.status === 'success') {
          setSoilRecs(recs);
        }
      } catch (err) {
        console.warn('Soil Doctor API notice:', err);
      }
    }
    loadSoilData();
    return () => { isMounted = false; };
  }, [locId, currentLang]);

  const sampleId = soilCard?.sample_id || (currentLocation
    ? `SHC-${currentLocation.state.en.substring(0, 2).toUpperCase()}-${currentLocation.id.toUpperCase()}-2026-88`
    : SOIL_DATA.sampleId);

  const handleSimulatePdfUpload = async () => {
    setUploading(true);
    try {
      const recs = await KisanSethuApi.calculateSoilRecommendation({
        cropKey: 'chilli',
        acres: 1.0,
        locationId: locId,
        lang: currentLang
      });
      if (recs && recs.status === 'success') {
        setSoilRecs(recs);
      }
      setReportUploaded(true);
      alert(currentLang === 'hi' ? 'मृदा जांच पर्चा सफलतापूर्वक संसाधित हुआ!' : currentLang === 'te' ? 'భూసార నివేదిక విజయవంతంగా విశ్లేషించబడింది!' : 'Soil test report analyzed successfully!');
    } catch (err) {
      console.warn('Soil upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="soil-doctor-view-container">
      <div className="view-header-strip">
        <div className="title-row">
          <TestTube2 size={24} className="view-icon" />
          <h2 className="view-title">{t.soilDoctorTitle}</h2>
        </div>
        <p className="view-desc">
          {currentLocation
            ? `📍 ${currentLocation.name[currentLang]} (${currentLocation.district[currentLang]}) - ${t.soilCardDesc}`
            : t.soilCardDesc}
        </p>
      </div>

      <div className="soil-layout-grid">
        {/* Soil Health Card Summary Card */}
        <div className="soil-card-profile">
          <div className="card-badge-row">
            <span className="shc-badge">
              <ShieldCheck size={14} />
              <span>
                {currentLang === 'hi'
                  ? 'सत्यापित मृदा स्वास्थ्य कार्ड (Verified SHC)'
                  : currentLang === 'te'
                  ? 'ధృవీకరించబడిన భూసార కార్డు (Verified SHC)'
                  : 'Verified Soil Health Card (SHC)'}
              </span>
            </span>
            <span className="sample-id">
              {currentLang === 'hi'
                ? `नमूना आईडी: ${sampleId}`
                : currentLang === 'te'
                ? `నమూనా ID: ${sampleId}`
                : `Sample ID: ${sampleId}`}
            </span>
          </div>

          <div className="soil-meta-grid">
            {currentLocation && (
              <div className="meta-item">
                <span className="meta-lbl">
                  {currentLang === 'hi' ? 'खेत का स्थान:' : currentLang === 'te' ? 'పొలం ప్రాంతం:' : 'Field Location:'}
                </span>
                <span className="meta-val">📍 {currentLocation.name[currentLang]} ({currentLocation.district[currentLang]})</span>
              </div>
            )}
            <div className="meta-item">
              <span className="meta-lbl">
                {currentLang === 'hi' ? 'मिट्टी का प्रकार:' : currentLang === 'te' ? 'నేల రకం:' : 'Soil Classification:'}
              </span>
              <span className="meta-val">{soilCard?.soil_type || SOIL_DATA.soilType[currentLang]}</span>
            </div>
            <div className="meta-item">
              <span className="meta-lbl">{t.phLabel}</span>
              <span className="meta-val ph">{soilCard?.ph ?? SOIL_DATA.ph} ({soilCard?.ph_status || SOIL_DATA.phStatus[currentLang]})</span>
            </div>
            <div className="meta-item">
              <span className="meta-lbl">
                {currentLang === 'hi' ? 'जैविक कार्बन:' : currentLang === 'te' ? 'సేంద్రీయ కర్బనం:' : 'Organic Carbon:'}
              </span>
              <span className="meta-val">
                {soilCard?.organic_carbon_pct ?? SOIL_DATA.organicCarbon}% ({currentLang === 'hi' ? 'संतोषजनक' : currentLang === 'te' ? 'సంతృప్తికరం' : 'Optimal'})
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-lbl">
                {currentLang === 'hi' ? 'जांच दिनांक:' : currentLang === 'te' ? 'పరీక్షించిన తేదీ:' : 'Test Date:'}
              </span>
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
                <span className="nutrient-val">{soilCard?.nitrogen_kg_ha ?? SOIL_DATA.nitrogenKgPerHa} kg/ha</span>
                <span className="nutrient-status-tag low">
                  {soilCard?.nitrogen_status?.toUpperCase() || (currentLang === 'hi' ? 'कम (Low)' : 'Low')}
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
                <span className="nutrient-val">{soilCard?.phosphorus_kg_ha ?? SOIL_DATA.phosphorusKgPerHa} kg/ha</span>
                <span className="nutrient-status-tag medium">
                  {soilCard?.phosphorus_status?.toUpperCase() || (currentLang === 'hi' ? 'मध्यम (Medium)' : 'Medium')}
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
                <span className="nutrient-val">{soilCard?.potassium_kg_ha ?? SOIL_DATA.potassiumKgPerHa} kg/ha</span>
                <span className="nutrient-status-tag high">
                  {soilCard?.potassium_status?.toUpperCase() || (currentLang === 'hi' ? 'उच्च (High)' : 'High')}
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
              <span>
                {uploading
                  ? (currentLang === 'hi' ? 'जांच हो रही है...' : currentLang === 'te' ? 'విశ్లేషిస్తోంది...' : 'Analyzing Report...')
                  : t.uploadPdfBtn}
              </span>
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
                {(soilRecs?.recommendations && soilRecs.recommendations.length > 0
                  ? soilRecs.recommendations
                  : SOIL_DATA.recommendedFertilizers.map((rec) => rec[currentLang])
                ).map((recText: string, i: number) => (
                  <li key={i} className="rec-item">
                    <span className="rec-bullet">🌾</span>
                    <span className="rec-text">{recText}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Book Government Soil Test */}
          <div className="book-soil-test-strip">
            <AlertCircle size={20} className="soil-alert-icon" />
            <div className="strip-text">
              <strong>
                {currentLocation
                  ? (currentLang === 'hi'
                      ? `निःशुल्क सरकारी मृदा जांच (${currentLocation.name[currentLang]})`
                      : currentLang === 'te'
                      ? `ఉచిత ప్రభుత్వ నేల పరీక్ష (${currentLocation.name[currentLang]})`
                      : `Free Government Soil Testing (${currentLocation.name[currentLang]})`)
                  : (currentLang === 'hi' ? 'निःशुल्क सरकारी मृदा जांच' : 'Free Government Soil Testing')}
              </strong>
              <p>
                {currentLocation
                  ? (currentLang === 'hi'
                      ? `निकटतम ${currentLocation.district[currentLang]} कृषि विज्ञान केंद्र (KVK) लैब से नमूना जांच करवाएं`
                      : currentLang === 'te'
                      ? `సమీప ${currentLocation.district[currentLang]} కృషి విజ్ఞాన కేంద్రం (KVK) ల్యాబ్‌కు శాంపిల్ పంపండి`
                      : `Register sample testing at nearest ${currentLocation.district[currentLang]} Krishi Vigyan Kendra (KVK Lab)`)
                  : (currentLang === 'hi'
                      ? 'अपने निकटतम कृषि विज्ञान केंद्र (KVK) से मिट्टी जांच करवाएं'
                      : 'Register sample pickup from nearest Krishi Vigyan Kendra')}
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
