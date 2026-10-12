import { useState, type FC } from 'react';
import type { Language } from '../types';
import { translations } from '../data/i18n';
import { FlaskConical, ShieldAlert, CheckSquare, Droplets, AlertTriangle } from 'lucide-react';

interface PesticideDosageViewProps {
  currentLang: Language;
}

export const PesticideDosageView: FC<PesticideDosageViewProps> = ({ currentLang }) => {
  const t = translations[currentLang];
  const [tankLiters, setTankLiters] = useState<number>(15);
  const [acreArea, setAcreArea] = useState<number>(1);
  const [chemicalType, setChemicalType] = useState<'chemical' | 'organic'>('chemical');

  // Dosage math: 5g per 15L pump, 10 pumps per acre
  const pumpsRequired = Math.ceil((acreArea * 150) / tankLiters);
  const dosageGramsOrMl =
    chemicalType === 'chemical'
      ? Math.round((5 / 15) * tankLiters * 10) / 10
      : Math.round((40 / 15) * tankLiters * 10) / 10;
  const totalQuantity =
    chemicalType === 'chemical' ? `${Math.round(dosageGramsOrMl * pumpsRequired)} g` : `${Math.round(dosageGramsOrMl * pumpsRequired)} ml`;

  return (
    <div className="pesticide-dosage-container">
      <div className="view-header-strip">
        <div className="title-row">
          <FlaskConical size={24} className="view-icon" />
          <h2 className="view-title">{t.pesticideTitle}</h2>
        </div>
      </div>

      {/* Thursday Weather Risk Alert */}
      <div className="pesticide-weather-caution-ribbon">
        <AlertTriangle size={20} className="caution-icon" />
        <div className="caution-text">
          <strong>गुरुवार बारिश चेतावनी (Thursday Rain Spray Advisory):</strong>
          <span> गुरुवार को भारी बारिश संभावित है। बुधवार-गुरुवार को छिड़काव से बचें अन्यथा दवा बह जाएगी और आर्थिक नुकसान होगा।</span>
        </div>
      </div>

      <div className="pesticide-grid">
        {/* Configurator Card */}
        <div className="dosage-calc-card">
          <h3 className="card-subtitle">
            <Droplets size={18} />
            <span>
              {currentLang === 'hi' ? 'स्प्रे पंप एवं रकबा चुनें' : currentLang === 'te' ? 'పంప్ & విస్తీర్ణం' : 'Select Pump Size & Acreage'}
            </span>
          </h3>

          <div className="form-group">
            <label className="form-label">{t.pumpSizeLabel}</label>
            <div className="pump-size-pills">
              {[15, 16, 20, 25].map((liters) => (
                <button
                  key={liters}
                  type="button"
                  onClick={() => setTankLiters(liters)}
                  className={`pump-pill ${tankLiters === liters ? 'active' : ''}`}
                >
                  {liters} L {currentLang === 'hi' ? 'टंकी' : 'Tank'}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t.cropAreaLabel}</label>
            <div className="acre-counter-row">
              <input
                type="number"
                min={0.5}
                max={50}
                step={0.5}
                value={acreArea}
                onChange={(e) => setAcreArea(Math.max(0.5, Number(e.target.value)))}
                className="form-input"
              />
              <span className="unit-label">{currentLang === 'hi' ? 'एकड़' : 'Acres'}</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">दवा का प्रकार (Treatment Mode):</label>
            <div className="mode-toggle-row">
              <button
                type="button"
                onClick={() => setChemicalType('chemical')}
                className={`mode-btn ${chemicalType === 'chemical' ? 'active-chem' : ''}`}
              >
                💊 रासायनिक (Chemical)
              </button>
              <button
                type="button"
                onClick={() => setChemicalType('organic')}
                className={`mode-btn ${chemicalType === 'organic' ? 'active-org' : ''}`}
              >
                🌿 जैविक (Organic Neem)
              </button>
            </div>
          </div>
        </div>

        {/* Prescription Dosage Result Card */}
        <div className="dosage-result-card">
          <h3 className="card-subtitle">
            <CheckSquare size={18} />
            <span>{t.calcDosageTitle}</span>
          </h3>

          <div className="prescribed-numbers-box">
            <div className="p-num-item">
              <span className="p-lbl">प्रति पंप मात्रा (Per {tankLiters}L Tank):</span>
              <span className="p-val highlight">
                {dosageGramsOrMl} {chemicalType === 'chemical' ? 'ग्राम (g)' : 'मिली (ml)'}
              </span>
              <span className="p-sub">
                {chemicalType === 'chemical' ? 'Thiamethoxam 25% WG' : 'Neem Oil 10,000 PPM'}
              </span>
            </div>

            <div className="p-num-item">
              <span className="p-lbl">कुल पंप संख्या (Total Pumps):</span>
              <span className="p-val">{pumpsRequired} पंप</span>
              <span className="p-sub">{acreArea} एकड़ क्षेत्र हेतु (150L पानी/एकड़)</span>
            </div>

            <div className="p-num-item total">
              <span className="p-lbl">कुल आवश्यक दवा (Total Quantity):</span>
              <span className="p-val total-amt">{totalQuantity}</span>
              <span className="p-sub">अनुमानित खर्च: ~₹{chemicalType === 'chemical' ? '180/एकड़' : '120/एकड़'}</span>
            </div>
          </div>

          {/* Safety Checklist */}
          <div className="safety-checklist-box">
            <h4 className="safety-title">
              <ShieldAlert size={16} />
              <span>{t.safetyChecklistTitle}</span>
            </h4>
            <ul className="safety-list">
              <li>😷 छिड़काव के दौरान चेहरे पर मास्क व हाथों में दस्ताने पहनें।</li>
              <li>💨 हमेशा हवा की दिशा में छिड़काव करें (हवा के विपरीत कभी न जाएं)।</li>
              <li>☀️ सुबह 10 बजे से पहले या शाम 4 बजे के बाद ही छिड़काव करें।</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
