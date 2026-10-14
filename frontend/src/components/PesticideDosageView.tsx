import { useState, type FC } from 'react';
import type { Language, LocationOption } from '../types';
import { translations } from '../data/i18n';
import { FlaskConical, ShieldAlert, CheckSquare, Droplets, AlertTriangle } from 'lucide-react';

interface PesticideDosageViewProps {
  currentLang: Language;
  currentLocation?: LocationOption;
}

export const PesticideDosageView: FC<PesticideDosageViewProps> = ({ currentLang, currentLocation }) => {
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
          <h2 className="view-title">
            {t.pesticideTitle} {currentLocation ? `(${currentLocation.name[currentLang]})` : ''}
          </h2>
        </div>
        {currentLocation && (
          <p style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>
            📍 {currentLocation.name[currentLang]} ({currentLocation.district[currentLang]}, {currentLocation.state[currentLang]})
          </p>
        )}
      </div>

      {/* Thursday Weather Risk Alert */}
      <div className="pesticide-weather-caution-ribbon">
        <AlertTriangle size={20} className="caution-icon" />
        <div className="caution-text">
          <strong>
            {currentLang === 'hi'
              ? `गुरुवार ${currentLocation?.name[currentLang] || ''} बारिश चेतावनी (Thursday Rain Spray Advisory):`
              : currentLang === 'te'
              ? `గురువారం ${currentLocation?.name[currentLang] || ''} వర్షం హెచ్చరిక (Thursday Rain Spray Advisory):`
              : `Thursday ${currentLocation?.name[currentLang] || ''} Rain Spray Advisory:`}
          </strong>
          <span>
            {currentLocation
              ? (currentLang === 'hi'
                  ? ` गुरुवार को ${currentLocation.name[currentLang]} में भारी बारिश संभावित है। बुधवार-गुरुवार को छिड़काव से बचें अन्यथा दवा बह जाएगी और आर्थिक नुकसान होगा।`
                  : currentLang === 'te'
                  ? ` గురువారం ${currentLocation.name[currentLang]}లో భారీ వర్షం కురిసే అవకాశం ఉంది. బుధ-గురువారాల్లో పిచికారీ నివారించండి.`
                  : ` Heavy rain expected in ${currentLocation.name[currentLang]} on Thursday. Avoid spraying on Wed/Thu as chemicals will wash away.`)
              : (currentLang === 'hi'
                  ? ' गुरुवार को भारी बारिश संभावित है। बुधवार-गुरुवार को छिड़काव से बचें अन्यथा दवा बह जाएगी और आर्थिक नुकसान होगा।'
                  : currentLang === 'te'
                  ? ' గురువారం భారీ వర్షం కురిసే అవకాశం ఉంది. బుధ-గురువారాల్లో పిచికారీ నివారించండి.'
                  : ' Heavy rain expected on Thursday. Avoid spraying on Wed/Thu as chemicals will wash away.')}
          </span>
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
            <label className="form-label">
              {currentLang === 'hi'
                ? 'दवा का प्रकार (Treatment Mode):'
                : currentLang === 'te'
                ? 'చికిత్స రకం (Treatment Mode):'
                : 'Treatment Mode:'}
            </label>
            <div className="mode-toggle-row">
              <button
                type="button"
                onClick={() => setChemicalType('chemical')}
                className={`mode-btn ${chemicalType === 'chemical' ? 'active-chem' : ''}`}
              >
                {currentLang === 'hi' ? '💊 रासायनिक (Chemical)' : currentLang === 'te' ? '💊 రసాయన మందు (Chemical)' : '💊 Chemical'}
              </button>
              <button
                type="button"
                onClick={() => setChemicalType('organic')}
                className={`mode-btn ${chemicalType === 'organic' ? 'active-org' : ''}`}
              >
                {currentLang === 'hi' ? '🌿 जैविक (Organic Neem)' : currentLang === 'te' ? '🌿 సేంద్రీయ వేప (Organic Neem)' : '🌿 Organic (Neem)'}
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
              <span className="p-lbl">
                {currentLang === 'hi'
                  ? `प्रति पंप मात्रा (Per ${tankLiters}L Tank):`
                  : currentLang === 'te'
                  ? `ప్రతి పంపుకు మోతాదు (Per ${tankLiters}L Tank):`
                  : `Dosage Per ${tankLiters}L Tank:`}
              </span>
              <span className="p-val highlight">
                {dosageGramsOrMl} {chemicalType === 'chemical' ? (currentLang === 'hi' ? 'ग्राम (g)' : currentLang === 'te' ? 'గ్రాములు (g)' : 'g') : (currentLang === 'hi' ? 'मिली (ml)' : currentLang === 'te' ? 'మి.లీ (ml)' : 'ml')}
              </span>
              <span className="p-sub">
                {chemicalType === 'chemical' ? 'Thiamethoxam 25% WG' : 'Neem Oil 10,000 PPM'}
              </span>
            </div>

            <div className="p-num-item">
              <span className="p-lbl">
                {currentLang === 'hi' ? 'कुल पंप संख्या (Total Pumps):' : currentLang === 'te' ? 'మొత్తం పంపులు:' : 'Total Sprayer Tanks:'}
              </span>
              <span className="p-val">
                {pumpsRequired} {currentLang === 'hi' ? 'पंप' : currentLang === 'te' ? 'ట్యాంకులు' : 'Tanks'}
              </span>
              <span className="p-sub">
                {currentLang === 'hi'
                  ? `${acreArea} एकड़ क्षेत्र हेतु (150L पानी/एकड़)`
                  : currentLang === 'te'
                  ? `${acreArea} ఎకరాల కోసం (150L నీరు/ఎకరా)`
                  : `For ${acreArea} Acres (150L water/acre)`}
              </span>
            </div>

            <div className="p-num-item total">
              <span className="p-lbl">
                {currentLang === 'hi' ? 'कुल आवश्यक दवा (Total Quantity):' : currentLang === 'te' ? 'మొత్తం మందు పరిమాణం:' : 'Total Required Quantity:'}
              </span>
              <span className="p-val total-amt">{totalQuantity}</span>
              <span className="p-sub">
                {currentLang === 'hi'
                  ? `अनुमानित खर्च: ~₹${chemicalType === 'chemical' ? '180/एकड़' : '120/एकड़'}`
                  : currentLang === 'te'
                  ? `అంచనా వ్యయం: ~₹${chemicalType === 'chemical' ? '180/ఎకరా' : '120/ఎకరా'}`
                  : `Est. Cost: ~₹${chemicalType === 'chemical' ? '180/acre' : '120/acre'}`}
              </span>
            </div>
          </div>

          {/* Safety Checklist */}
          <div className="safety-checklist-box">
            <h4 className="safety-title">
              <ShieldAlert size={16} />
              <span>{t.safetyChecklistTitle}</span>
            </h4>
            <ul className="safety-list">
              <li>
                {currentLang === 'hi'
                  ? '😷 छिड़काव के दौरान चेहरे पर मास्क व हाथों में दस्ताने पहनें।'
                  : currentLang === 'te'
                  ? '😷 స్ప్రే చేసే సమయంలో ముఖానికి మాస్క్ మరియు చేతులకు గ్లౌజులు ధరించండి.'
                  : '😷 Wear safety face mask and protective gloves during chemical spraying.'}
              </li>
              <li>
                {currentLang === 'hi'
                  ? '💨 हमेशा हवा की दिशा में छिड़काव करें (हवा के विपरीत कभी न जाएं)।'
                  : currentLang === 'te'
                  ? '💨 ఎల్లప్పుడూ గాలి వీచే దిశలోనే స్ప్రే చేయండి (ఎదురుగాలిలో చేయవద్దు).'
                  : '💨 Always spray along the direction of the wind (never spray against the wind).'}
              </li>
              <li>
                {currentLang === 'hi'
                  ? '☀️ सुबह 10 बजे से पहले या शाम 4 बजे के बाद ही छिड़काव करें।'
                  : currentLang === 'te'
                  ? '☀️ ఉదయం 10 గంటల లోపు లేదా సాయంత్రం 4 గంటల తర్వాత మాత్రమే స్ప్రే చేయండి.'
                  : '☀️ Spray strictly before 10:00 AM or after 4:00 PM to avoid leaf scorch.'}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
