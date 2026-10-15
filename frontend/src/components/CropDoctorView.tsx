import { useState, useEffect, type FC } from 'react';
import type { Language, CropDisease, LocationOption } from '../types';
import { translations } from '../data/i18n';
import { CROP_CHIPS, CROP_DISEASES } from '../data/mockData';
import { KisanSethuApi } from '../services/api';
import { Camera, AlertCircle, ShieldAlert, Sparkles, RefreshCw, CheckCircle2 } from 'lucide-react';

interface CropDoctorViewProps {
  currentLang: Language;
  selectedCropKey: string;
  currentLocation?: LocationOption;
  onOpenHelpline: (number: string) => void;
}

export const CropDoctorView: FC<CropDoctorViewProps> = ({
  currentLang,
  selectedCropKey,
  currentLocation,
  onOpenHelpline
}) => {
  const t = translations[currentLang];
  const [analyzing, setAnalyzing] = useState(false);
  const [hasScanned, setHasScanned] = useState(true);
  const [backendDiagnosis, setBackendDiagnosis] = useState<any | null>(null);

  const matchedCrop = CROP_CHIPS.find(c => c.key === selectedCropKey);
  const fallbackDisease: CropDisease =
    CROP_DISEASES[selectedCropKey] || CROP_DISEASES['chilli'];

  // Load disease intelligence when crop or location changes
  useEffect(() => {
    let isMounted = true;
    async function loadDisease() {
      try {
        const diag = await KisanSethuApi.diagnoseCropDisease(
          selectedCropKey,
          undefined,
          currentLocation?.id || 'guntur',
          undefined,
          currentLang
        );
        if (isMounted && diag && diag.status === 'success') {
          setBackendDiagnosis(diag);
        }
      } catch (err) {
        console.warn('Crop Doctor API notice:', err);
      }
    }
    loadDisease();
    return () => { isMounted = false; };
  }, [selectedCropKey, currentLocation?.id, currentLang]);

  const handleSimulateScan = async () => {
    setAnalyzing(true);
    try {
      const diag = await KisanSethuApi.diagnoseCropDisease(
        selectedCropKey,
        undefined,
        currentLocation?.id || 'guntur',
        undefined,
        currentLang
      );
      if (diag && diag.status === 'success') {
        setBackendDiagnosis(diag);
      }
    } catch (err) {
      console.warn('Diagnosis call error:', err);
    } finally {
      setAnalyzing(false);
      setHasScanned(true);
    }
  };

  const confidenceText = backendDiagnosis
    ? (currentLang === 'hi'
        ? `AI विश्वसनीयता: ${backendDiagnosis.confidence_pct}%`
        : currentLang === 'te'
        ? `AI ఖచ్చితత్వం: ${backendDiagnosis.confidence_pct}%`
        : `AI Accuracy: ${backendDiagnosis.confidence_pct}%`)
    : (currentLang === 'hi'
        ? 'AI विश्वसनीयता: 98%'
        : currentLang === 'te'
        ? 'AI ఖచ్చితత్వం: 98%'
        : 'AI Accuracy: 98%');

  const actionRequiredText =
    currentLang === 'hi'
      ? 'उच्च गंभीरता (तत्काल ध्यान दें)'
      : currentLang === 'te'
      ? 'తీవ్రమైన ప్రమాదం (చర్య అవసరం)'
      : 'High Severity (Action Required)';

  const displayDiseaseName = backendDiagnosis?.disease_name || fallbackDisease.diseaseName[currentLang];
  const displaySymptoms = backendDiagnosis?.symptoms || fallbackDisease.symptoms[currentLang];
  const displayChemical = backendDiagnosis?.chemical_treatment || fallbackDisease.chemicalTreatment[currentLang];
  const displayOrganic = backendDiagnosis?.organic_treatment || fallbackDisease.organicTreatment[currentLang];
  const displayWarning = backendDiagnosis?.weather_spray_risk?.warning || backendDiagnosis?.spraying_warning || fallbackDisease.sprayingWarning[currentLang];

  return (
    <div className="crop-doctor-container">
      {/* Selected Crop Banner */}
      <div className="doctor-crop-indicator-banner">
        <div className="crop-avatar-wrap">
          <span className="crop-avatar-icon">{matchedCrop?.icon || '🌱'}</span>
        </div>
        <div>
          <h3 className="doc-crop-title">
            {t.doctorTitle} - {matchedCrop?.name[currentLang] || selectedCropKey}
            {currentLocation ? ` (${currentLocation.name[currentLang]})` : ''}
          </h3>
          <p className="doc-crop-desc">
            {currentLocation
              ? (currentLang === 'hi'
                  ? `📍 ${currentLocation.name[currentLang]} (${currentLocation.district[currentLang]}) के लिए रोग पहचान एवं कृषि विज्ञान केंद्र अनुशंसा`
                  : currentLang === 'te'
                  ? `📍 ${currentLocation.name[currentLang]} (${currentLocation.district[currentLang]}) కోసం వ్యాధి గుర్తింపు & KVK సలహాలు`
                  : `📍 Disease diagnosis & KVK advisory tailored for ${currentLocation.name[currentLang]} (${currentLocation.district[currentLang]})`)
              : (currentLang === 'hi'
                  ? 'एआई द्वारा रोग पहचान एवं मौसम-सुरक्षित उपचार अनुशंसा'
                  : currentLang === 'te'
                  ? 'AI ద్వారా పంట తెగుళ్ల గుర్తింపు & వాతావరణ అనుకూల నివారణ'
                  : 'AI Leaf Diagnostic & Weather-Aware Treatment Plan')}
          </p>
        </div>
      </div>

      {/* Step: Camera Capture / Upload */}
      <div className="camera-upload-box">
        <div className="camera-preview-frame">
          <div className="leaf-overlay-graphic">
            <span className="leaf-icon">🍃</span>
            <div className="scan-line" />
          </div>
          <div className="camera-instruction">
            <h4>{t.takePhotoTitle}</h4>
            <p>
              {currentLang === 'hi'
                ? 'रोगग्रस्त पत्ते को सूर्य की रोशनी में रखकर सामने से फोटो लें'
                : currentLang === 'te'
                ? 'తెగులు సోకిన ఆకును వెలుతురులో ఉంచి స్పష్టంగా ఫోటో తీయండి'
                : 'Place the affected leaf under natural daylight and capture a clear close-up'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSimulateScan}
          disabled={analyzing}
          className="snap-photo-btn"
        >
          {analyzing ? (
            <>
              <RefreshCw size={20} className="spinning" />
              <span>
                {currentLang === 'hi'
                  ? 'एआई विश्लेषण जारी है...'
                  : currentLang === 'te'
                  ? 'AI విశ్లేషిస్తోంది...'
                  : 'AI Analyzing Symptoms...'}
              </span>
            </>
          ) : (
            <>
              <Camera size={20} />
              <span>{t.clickCamera}</span>
            </>
          )}
        </button>
      </div>

      {/* Diagnostic Report & Spraying Caution */}
      {hasScanned && (
        <div className="diagnosis-result-card">
          <div className="diagnosis-header">
            <div className="status-badge-wrap">
              <span className="confidence-pill">
                <Sparkles size={14} />
                <span>{confidenceText}</span>
              </span>
              <span className="severity-pill danger">
                <ShieldAlert size={14} />
                <span>{actionRequiredText}</span>
              </span>
            </div>
            <h3 className="disease-title">{displayDiseaseName}</h3>
          </div>

          {/* Symptoms */}
          <div className="diagnosis-section">
            <h4 className="diag-subheading">{t.symptomsLabel}</h4>
            <p className="diag-text">{displaySymptoms}</p>
          </div>

          {/* Weather & Spraying Warning */}
          <div className="spraying-caution-box">
            <div className="caution-header">
              <AlertCircle size={20} className="caution-icon" />
              <strong>{t.weatherRiskLabel} {currentLocation ? `(${currentLocation.name[currentLang]})` : ''}</strong>
            </div>
            <p className="caution-text">{displayWarning}</p>
          </div>

          {/* Treatments: Chemical + Organic */}
          <div className="treatment-grid">
            <div className="treatment-card chemical">
              <h5 className="treatment-title">{t.chemicalTreatmentLabel}</h5>
              <p>{displayChemical}</p>
            </div>
            <div className="treatment-card organic">
              <h5 className="treatment-title">{t.organicTreatmentLabel}</h5>
              <p>{displayOrganic}</p>
            </div>
          </div>

          {/* Talk to Scientist */}

          <div className="doctor-helpline-bar">
            <span>
              {currentLocation
                ? (currentLang === 'hi'
                    ? `📞 ${currentLocation.district[currentLang]} कृषि विज्ञान केंद्र (KVK) वैज्ञानिक से बात करें:`
                    : currentLang === 'te'
                    ? `📞 ${currentLocation.district[currentLang]} కృషి విజ్ఞాన కేంద్రం (KVK) శాస్త్రవేత్తతో మాట్లాడండి:`
                    : `📞 Connect with ${currentLocation.district[currentLang]} Krishi Vigyan Kendra (KVK) Scientist:`)
                : t.talkToScientist}
            </span>
            <button
              type="button"
              onClick={() => onOpenHelpline('1551')}
              className="doc-call-btn"
            >
              📞 {t.freeCallBtn}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
