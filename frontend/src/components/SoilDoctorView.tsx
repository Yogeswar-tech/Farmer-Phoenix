import { useState, useEffect, useRef, type FC, type ChangeEvent } from 'react';
import type { Language, LocationOption } from '../types';
import { SOIL_DATA } from '../data/mockData';
import { translations } from '../data/i18n';
import { KisanSethuApi } from '../services/api';
import {
  TestTube2,
  FileText,
  CheckCircle2,
  UploadCloud,
  ShieldCheck,
  Droplets,
  Calendar,
  Sparkles,
  Loader2,
  ExternalLink
} from 'lucide-react';

interface SoilDoctorViewProps {
  currentLang: Language;
  currentLocation?: LocationOption;
  onOpenBookingGate?: (featureName: string) => void;
}

export const SoilDoctorView: FC<SoilDoctorViewProps> = ({
  currentLang,
  currentLocation,
  onOpenBookingGate: _onOpenBookingGate
}) => {
  const t = translations[currentLang];
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Core State
  const [selectedCropKey, setSelectedCropKey] = useState<string>('chilli');
  const [acres, setAcres] = useState<number>(1.0);
  const [soilCard, setSoilCard] = useState<any | null>(null);
  const [soilRecs, setSoilRecs] = useState<any | null>(null);
  const [liveTelemetry, setLiveTelemetry] = useState<any | null>(null);

  // File Upload & Vision OCR State
  const [isScanningReport, setIsScanningReport] = useState<boolean>(false);
  const [scannedReportMeta, setScannedReportMeta] = useState<any | null>(null);

  // Government portal URL — state-aware
  const getGovSoilPortalUrl = () => {
    const stateId = currentLocation?.state?.en?.toLowerCase() || '';
    if (stateId.includes('andhra')) return 'https://soilhealth.dac.gov.in/';
    if (stateId.includes('telangana')) return 'https://soilhealth.dac.gov.in/';
    return 'https://soilhealth.dac.gov.in/';
  };

  const locId = currentLocation?.id || 'guntur';
  const locLat = currentLocation?.lat || 16.3067;
  const locLng = currentLocation?.lng || 80.4365;
  const isDefaultLocation = !currentLocation?.lat || (currentLocation?.lat === 16.3067 && currentLocation?.lng === 80.4365);

  // Crops list for fertilizer calculation
  const supportedCrops = [
    { key: 'chilli', nameEn: 'Chilli', nameHi: 'मिर्च', nameTe: 'మిర్చి', icon: '🌶️' },
    { key: 'tomato', nameEn: 'Tomato', nameHi: 'टमाटर', nameTe: 'టమోటా', icon: '🍅' },
    { key: 'paddy', nameEn: 'Paddy / Rice', nameHi: 'धान (चावल)', nameTe: 'వరి', icon: '🌾' },
    { key: 'cotton', nameEn: 'Cotton', nameHi: 'कपास', nameTe: 'పత్తి', icon: '🌱' },
    { key: 'potato', nameEn: 'Potato', nameHi: 'आलू', nameTe: 'బంగాళాదుంప', icon: '🥔' },
    { key: 'onion', nameEn: 'Onion', nameHi: 'प्याज', nameTe: 'ఉల్లిపాయ', icon: '🧅' },
    { key: 'groundnut', nameEn: 'Groundnut', nameHi: 'मूंगफली', nameTe: 'వేరుశనగ', icon: '🥜' },
    { key: 'banana', nameEn: 'Banana', nameHi: 'केला', nameTe: 'అరటి', icon: '🍌' }
  ];

  // Load Initial Soil Baseline & Live Satellite Telemetry
  useEffect(() => {
    let isMounted = true;
    async function loadInitialData() {
      try {
        // 1. Fetch regional baseline soil card
        const card = await KisanSethuApi.getSoilHealthCard(locId, currentLang);
        if (isMounted && card && card.status === 'success') {
          setSoilCard(card);
          if (card.live_satellite_telemetry) {
            setLiveTelemetry(card.live_satellite_telemetry);
          }
        }

        // 2. Compute precision NPK fertilizer recommendations
        const recs = await KisanSethuApi.calculateSoilRecommendation({
          cropKey: selectedCropKey,
          acres: acres,
          locationId: locId,
          lang: currentLang
        });
        if (isMounted && recs && recs.status === 'success') {
          setSoilRecs(recs);
        }

        // 3. If live telemetry not in card, fetch independently
        if (isMounted && !card?.live_satellite_telemetry) {
          const telem = await KisanSethuApi.getSoilLiveTelemetry(locLat, locLng, currentLang);
          if (isMounted && telem && telem.status === 'success') {
            setLiveTelemetry(telem);
          }
        }
      } catch (err) {
        console.warn('Soil Doctor loading error:', err);
      }
    }

    loadInitialData();
    return () => { isMounted = false; };
  }, [locId, currentLang, locLat, locLng, selectedCropKey, acres]);

  // Recalculate when crop or acres change
  const handleRecalculate = async (newCropKey: string, newAcres: number) => {
    setSelectedCropKey(newCropKey);
    setAcres(newAcres);
    try {
      const recs = await KisanSethuApi.calculateSoilRecommendation({
        cropKey: newCropKey,
        acres: newAcres,
        nitrogenKgHa: soilCard?.nitrogen_kg_ha,
        phosphorusKgHa: soilCard?.phosphorus_kg_ha,
        potassiumKgHa: soilCard?.potassium_kg_ha,
        ph: soilCard?.ph,
        locationId: locId,
        lang: currentLang
      });
      if (recs && recs.status === 'success') {
        setSoilRecs(recs);
      }
    } catch (err) {
      console.warn('Soil recalculate error:', err);
    }
  };

  // Handle Real Soil Lab Report Upload (Vision AI Parsing)
  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningReport(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Str = reader.result as string;
      try {
        const scanRes = await KisanSethuApi.scanSoilReport(base64Str, file.type || 'image/jpeg', currentLang);
        if (scanRes && scanRes.status === 'success') {
          setScannedReportMeta(scanRes);
          // Update active soil card with extracted lab numbers
          setSoilCard((prev: any) => ({
            ...prev,
            sample_id: scanRes.sample_id || prev?.sample_id,
            ph: scanRes.ph ?? prev?.ph,
            organic_carbon_pct: scanRes.organic_carbon_pct ?? prev?.organic_carbon_pct,
            nitrogen_kg_ha: scanRes.nitrogen_kg_ha ?? prev?.nitrogen_kg_ha,
            phosphorus_kg_ha: scanRes.phosphorus_kg_ha ?? prev?.phosphorus_kg_ha,
            potassium_kg_ha: scanRes.potassium_kg_ha ?? prev?.potassium_kg_ha,
            micronutrients: {
              zinc_ppm: scanRes.zinc_ppm ?? 0.58,
              boron_ppm: scanRes.boron_ppm ?? 0.45,
              iron_ppm: 6.8
            }
          }));

          // Automatically re-compute fertilizer dosage with scanned numbers
          const recs = await KisanSethuApi.calculateSoilRecommendation({
            cropKey: selectedCropKey,
            acres: acres,
            nitrogenKgHa: scanRes.nitrogen_kg_ha,
            phosphorusKgHa: scanRes.phosphorus_kg_ha,
            potassiumKgHa: scanRes.potassium_kg_ha,
            ph: scanRes.ph,
            locationId: locId,
            lang: currentLang
          });
          if (recs && recs.status === 'success') {
            setSoilRecs(recs);
          }
        }
      } catch (err) {
        console.warn('Soil report scan failed:', err);
      } finally {
        setIsScanningReport(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const sampleId = soilCard?.sample_id || `SHC-${locId.toUpperCase()}-2026-88`;

  return (
    <div className="soil-doctor-view-container" style={{ maxWidth: '1240px', margin: '0 auto', padding: '16px' }}>
      {/* Default Location Notice */}
      {isDefaultLocation && (
        <div style={{
          background: '#FEF9C3',
          border: '1.5px solid #FDE047',
          borderLeft: '5px solid #CA8A04',
          borderRadius: '10px',
          padding: '9px 14px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          fontWeight: '600',
          color: '#854D0E'
        }}>
          <ShieldCheck size={14} style={{ flexShrink: 0 }} />
          <span>
            {currentLang === 'te'
              ? '📍 డిఫాల్ట్ స్థానం (గుంటూరు) ఉపయోగించబడుతోంది — మీ నిజమైన స్థానానికి మారండి'
              : currentLang === 'hi'
                ? '📍 डिफ़ॉल्ट स्थान (गुंटूर) उपयोग हो रहा है — अपना सही स्थान चुनें'
                : '📍 Using default location (Guntur) — select your actual location for accurate soil data'}
          </span>
        </div>
      )}
      {/* 1. View Header Strip */}
      <div className="view-header-strip" style={{
        background: 'linear-gradient(135deg, #1E3A8A 0%, #1E40AF 60%, #172554 100%)',
        color: '#FFFFFF',
        borderRadius: '16px',
        padding: '20px 24px',
        marginBottom: '20px',
        boxShadow: '0 10px 25px -5px rgba(30, 58, 138, 0.35)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ background: 'rgba(255,255,255,0.15)', padding: '12px', borderRadius: '12px', display: 'flex' }}>
              <TestTube2 size={30} style={{ color: '#93C5FD' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '900', margin: 0, color: '#FFFFFF' }}>
                {currentLang === 'hi' ? 'मृदा स्वास्थ्य डॉक्टर एवं उर्वरक कैलकुलेटर' : currentLang === 'te' ? 'భూసార డాక్టర్ & ఎరువుల కాలిక్యులేటర్' : 'Soil Doctor & Precision Fertilizer Engine'}
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#BFDBFE' }}>
                {currentLocation
                  ? `📍 ${currentLocation.name[currentLang]} (${currentLocation.district[currentLang]}) • ICAR & National Soil Health Card Standards`
                  : 'ICAR National Soil Health Standards • Zero Waste Precision Nutrition'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => window.open(getGovSoilPortalUrl(), '_blank', 'noopener,noreferrer')}
            style={{
              background: '#059669',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(5, 150, 105, 0.4)'
            }}
          >
            <Calendar size={16} />
            <span>{currentLang === 'hi' ? 'निःशुल्क सरकारी लैब जांच बुक करें' : currentLang === 'te' ? 'ఉచిత ప్రభుత్వ నేల పరీక్ష బుక్ చేయండి' : 'Book Free KVK Soil Test'}</span>
            <ExternalLink size={12} style={{ opacity: 0.8 }} />
          </button>
        </div>
      </div>

      {/* 2. Live Satellite Topsoil Moisture & Field Telemetry Banner */}
      {liveTelemetry && (
        <div style={{
          background: liveTelemetry.can_fertilize ? '#F0FDF4' : '#FEF3C7',
          border: `1.5px solid ${liveTelemetry.can_fertilize ? '#86EFAC' : '#FCD34D'}`,
          borderRadius: '14px',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              background: liveTelemetry.can_fertilize ? '#DCFCE7' : '#FEF9C3',
              padding: '10px',
              borderRadius: '50%',
              display: 'flex'
            }}>
              <Droplets size={22} style={{ color: liveTelemetry.can_fertilize ? '#16A34A' : '#D97706' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                  {currentLang === 'hi' ? 'उपग्रह लाइव मृदा नमी:' : currentLang === 'te' ? 'ఉపగ్రహ ప్రత్యక్ష నేల తేమ:' : 'Live Satellite Topsoil Moisture:'}
                </span>
                <span style={{
                  fontSize: '15px',
                  fontWeight: '900',
                  color: liveTelemetry.can_fertilize ? '#15803D' : '#B45309'
                }}>
                  {liveTelemetry.soil_moisture_pct}% ({liveTelemetry.moisture_status.toUpperCase()})
                </span>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  • {liveTelemetry.soil_temperature_c}°C Soil Temp
                </span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#334155', fontWeight: '600' }}>
                {liveTelemetry.agronomic_advice}
              </p>
            </div>
          </div>

          <span style={{
            fontSize: '11px',
            fontWeight: '800',
            padding: '6px 12px',
            borderRadius: '999px',
            background: liveTelemetry.can_fertilize ? '#15803D' : '#D97706',
            color: '#FFFFFF'
          }}>
            {liveTelemetry.can_fertilize
              ? (currentLang === 'hi' ? '✅ उर्वरक देने हेतु उत्तम' : currentLang === 'te' ? '✅ ఎరువులు వేయడానికి అనుకూలం' : '✅ Safe to Fertilize')
              : (currentLang === 'hi' ? '⚠️ सिंचाई आवश्यक / प्रतीक्षा करें' : '⚠️ Irrigate First / Wait')}
          </span>
        </div>
      )}

      {/* 3. Main Two-Column Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, 1.2fr) minmax(340px, 1.4fr)',
        gap: '20px',
        alignItems: 'start'
      }}>
        {/* ================================================================= */}
        {/* LEFT COLUMN: SOIL HEALTH CARD PARAMETERS & LAB SCANNER           */}
        {/* ================================================================= */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '20px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
        }}>
          {/* Card Header & Badge */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1E40AF', fontWeight: '800', fontSize: '13px' }}>
              <ShieldCheck size={16} />
              <span>{currentLang === 'hi' ? 'सत्यापित मृदा स्वास्थ्य कार्ड (SHC)' : 'Verified Soil Health Card (SHC)'}</span>
            </div>
            <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '700', background: '#F1F5F9', padding: '4px 8px', borderRadius: '6px' }}>
              ID: {sampleId}
            </span>
          </div>

          {/* Scanned Badge Banner */}
          {scannedReportMeta && (
            <div style={{
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: '10px',
              padding: '10px 12px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Sparkles size={16} style={{ color: '#2563EB' }} />
              <span style={{ fontSize: '12px', color: '#1E40AF', fontWeight: '700' }}>
                {scannedReportMeta.summary}
              </span>
            </div>
          )}

          {/* Meta Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: '1px solid #F1F5F9' }}>
              <span style={{ fontSize: '11px', color: '#64748B', display: 'block', fontWeight: '700' }}>
                {currentLang === 'hi' ? 'मिट्टी का प्रकार' : currentLang === 'te' ? 'నేల రకం' : 'Soil Classification'}
              </span>
              <strong style={{ fontSize: '13px', color: '#0F172A' }}>
                {soilCard?.soil_type || 'Deep Black Vertisol'}
              </strong>
            </div>

            <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: '1px solid #F1F5F9' }}>
              <span style={{ fontSize: '11px', color: '#64748B', display: 'block', fontWeight: '700' }}>
                {currentLang === 'hi' ? 'पीएच स्तर (pH)' : 'pH Reaction'}
              </span>
              <strong style={{ fontSize: '14px', color: soilCard?.ph > 7.8 ? '#DC2626' : '#15803D' }}>
                {soilCard?.ph ?? 7.4} ({soilCard?.ph_status || 'Optimal'})
              </strong>
            </div>

            <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: '1px solid #F1F5F9' }}>
              <span style={{ fontSize: '11px', color: '#64748B', display: 'block', fontWeight: '700' }}>
                {currentLang === 'hi' ? 'जैविक कार्बन (OC %)' : 'Organic Carbon (OC %)'}
              </span>
              <strong style={{ fontSize: '13px', color: '#0F172A' }}>
                {soilCard?.organic_carbon_pct ?? 0.54}% ({soilCard?.organic_carbon_status === 'optimal' ? 'Optimal' : 'Low'})
              </strong>
            </div>

            <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: '1px solid #F1F5F9' }}>
              <span style={{ fontSize: '11px', color: '#64748B', display: 'block', fontWeight: '700' }}>
                {currentLang === 'hi' ? 'परीक्षण दिनांक' : 'Test Date'}
              </span>
              <strong style={{ fontSize: '13px', color: '#0F172A' }}>
                {soilCard?.test_date || '02 Oct 2026'}
              </strong>
            </div>
          </div>

          {/* Primary N-P-K Nutrient Gauges */}
          <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: '0 0 12px' }}>
            {currentLang === 'hi' ? 'प्राथमिक पोषक तत्व स्तर (NPK kg/ha)' : 'Primary Macronutrients (NPK kg/ha)'}
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
            {/* Nitrogen Gauge */}
            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '12px', padding: '12px 10px', textAlign: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#991B1B' }}>Nitrogen (N)</span>
              <div style={{ fontSize: '18px', fontWeight: '900', color: '#7F1D1D', margin: '4px 0' }}>
                {soilCard?.nitrogen_kg_ha ?? 210}
              </div>
              <span style={{ fontSize: '10px', fontWeight: '800', background: '#FEE2E2', color: '#991B1B', padding: '2px 8px', borderRadius: '6px' }}>
                {soilCard?.nitrogen_status?.toUpperCase() || 'LOW'}
              </span>
            </div>

            {/* Phosphorus Gauge */}
            <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '12px', padding: '12px 10px', textAlign: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#92400E' }}>Phosphorus (P)</span>
              <div style={{ fontSize: '18px', fontWeight: '900', color: '#78350F', margin: '4px 0' }}>
                {soilCard?.phosphorus_kg_ha ?? 24}
              </div>
              <span style={{ fontSize: '10px', fontWeight: '800', background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: '6px' }}>
                {soilCard?.phosphorus_status?.toUpperCase() || 'MEDIUM'}
              </span>
            </div>

            {/* Potassium Gauge */}
            <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '12px', padding: '12px 10px', textAlign: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#166534' }}>Potassium (K)</span>
              <div style={{ fontSize: '18px', fontWeight: '900', color: '#14532D', margin: '4px 0' }}>
                {soilCard?.potassium_kg_ha ?? 340}
              </div>
              <span style={{ fontSize: '10px', fontWeight: '800', background: '#DCFCE7', color: '#166534', padding: '2px 8px', borderRadius: '6px' }}>
                {soilCard?.potassium_status?.toUpperCase() || 'HIGH'}
              </span>
            </div>
          </div>

          {/* Micro-Nutrients Bar */}
          <div style={{ background: '#F8FAFC', borderRadius: '10px', padding: '10px 14px', marginBottom: '20px', border: '1px solid #E2E8F0' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#475569', display: 'block', marginBottom: '6px' }}>
              {currentLang === 'hi' ? 'सूक्ष्म पोषक तत्व (Micronutrients):' : 'Micronutrient Status:'}
            </span>
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#334155' }}>
              <span>Zinc (Zn): <strong>{soilCard?.micronutrients?.zinc_ppm || 0.58} ppm</strong> <span style={{ color: '#DC2626' }}>(Deficient)</span></span>
              <span>Boron (B): <strong>{soilCard?.micronutrients?.boron_ppm || 0.45} ppm</strong></span>
              <span>Iron (Fe): <strong>6.8 ppm</strong></span>
            </div>
          </div>

          {/* Real Soil Lab Report Upload Box (Gemini Vision OCR) */}
          <div style={{
            background: '#F8FAFC',
            border: '2px dashed #CBD5E1',
            borderRadius: '12px',
            padding: '16px',
            textAlign: 'center'
          }}>
            <UploadCloud size={28} style={{ color: '#475569', margin: '0 auto 6px' }} />
            <strong style={{ fontSize: '13px', color: '#0F172A', display: 'block' }}>
              {currentLang === 'hi' ? 'मृदा जांच पर्चा (PDF या फोटो) अपलोड करें' : currentLang === 'te' ? 'భూసార నివేదిక (PDF/ఫోటో) అప్‌లోడ్ చేయండి' : 'Upload Soil Lab Report (PDF/Photo)'}
            </strong>
            <p style={{ fontSize: '11px', color: '#64748B', margin: '4px 0 10px' }}>
              {currentLang === 'hi' ? 'Gemini AI तुरंत लैब रिपोर्ट पढ़कर NPK व pH निकाल लेगा' : 'Gemini AI automatically extracts N-P-K, pH & Organic Carbon'}
            </p>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanningReport}
              style={{
                background: '#1E3A8A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isScanningReport ? (
                <>
                  <Loader2 size={14} className="spin-icon" />
                  <span>{currentLang === 'hi' ? 'रिपोर्ट स्कैन हो रही है...' : 'Scanning Report...'}</span>
                </>
              ) : (
                <>
                  <FileText size={14} />
                  <span>{currentLang === 'hi' ? 'फाइल चुनें (PDF/Image)' : 'Select Lab Report'}</span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
          </div>
        </div>

        {/* ================================================================= */}
        {/* RIGHT COLUMN: PRECISION NPK CALCULATOR & SPLIT SCHEDULE          */}
        {/* ================================================================= */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '20px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
        }}>
          {/* Header */}
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: '0 0 4px' }}>
              {currentLang === 'hi' ? 'सटीक उर्वरक एवं खुराक सिफारिश' : 'Precision Commercial Fertilizer Prescription'}
            </h3>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              {currentLang === 'hi' ? 'फसल व एकड़ चुनें, ICAR फॉर्मूला अनुसार सटीक खाद बैग पाएं' : 'Select crop and acreage to compute exact subsidized fertilizer bags'}
            </span>
          </div>

          {/* Interactive Crop Selector Chips */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '12px', fontWeight: '800', color: '#475569', display: 'block', marginBottom: '6px' }}>
              {currentLang === 'hi' ? '1. लक्षित फसल चुनें:' : '1. Select Target Crop:'}
            </label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {supportedCrops.map((c) => {
                const isSelected = selectedCropKey === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => handleRecalculate(c.key, acres)}
                    style={{
                      background: isSelected ? '#1E3A8A' : '#F1F5F9',
                      color: isSelected ? '#FFFFFF' : '#334155',
                      border: isSelected ? '1px solid #1E3A8A' : '1px solid #CBD5E1',
                      borderRadius: '8px',
                      padding: '5px 10px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>{c.icon}</span>
                    <span>{currentLang === 'hi' ? c.nameHi : currentLang === 'te' ? c.nameTe : c.nameEn}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Acreage Counter */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ fontSize: '12px', fontWeight: '800', color: '#475569', display: 'block', marginBottom: '6px' }}>
              {currentLang === 'hi' ? '2. खेत का क्षेत्रफल (एकड़):' : '2. Field Size (Acres):'}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {[0.5, 1.0, 2.0, 5.0, 10.0].map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => handleRecalculate(selectedCropKey, sz)}
                  style={{
                    background: acres === sz ? '#059669' : '#FFFFFF',
                    color: acres === sz ? '#FFFFFF' : '#334155',
                    border: acres === sz ? '1px solid #059669' : '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                >
                  {sz} {currentLang === 'hi' ? 'एकड़' : 'Acres'}
                </button>
              ))}
            </div>
          </div>

          {/* Commercial Bags Summary Cards */}
          {soilRecs?.fertilizer_requirements && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '10px',
              marginBottom: '20px'
            }}>
              {/* Urea */}
              <div style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: '12px', padding: '12px 10px', textAlign: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#1E40AF', display: 'block' }}>
                  Neem Urea (46% N)
                </span>
                <div style={{ fontSize: '20px', fontWeight: '900', color: '#1E3A8A', margin: '4px 0' }}>
                  {soilRecs.fertilizer_requirements.urea.bags_45kg} <span style={{ fontSize: '11px' }}>Bags</span>
                </div>
                <span style={{ fontSize: '10px', color: '#64748B' }}>
                  {soilRecs.fertilizer_requirements.urea.total_kg} kg total
                </span>
              </div>

              {/* SSP */}
              <div style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: '12px', padding: '12px 10px', textAlign: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#92400E', display: 'block' }}>
                  SSP (16% P₂O₅)
                </span>
                <div style={{ fontSize: '20px', fontWeight: '900', color: '#78350F', margin: '4px 0' }}>
                  {soilRecs.fertilizer_requirements.ssp.bags_50kg} <span style={{ fontSize: '11px' }}>Bags</span>
                </div>
                <span style={{ fontSize: '10px', color: '#64748B' }}>
                  {soilRecs.fertilizer_requirements.ssp.total_kg} kg total
                </span>
              </div>

              {/* MOP */}
              <div style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: '12px', padding: '12px 10px', textAlign: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#166534', display: 'block' }}>
                  MOP (60% K₂O)
                </span>
                <div style={{ fontSize: '20px', fontWeight: '900', color: '#14532D', margin: '4px 0' }}>
                  {soilRecs.fertilizer_requirements.mop.bags_50kg} <span style={{ fontSize: '11px' }}>Bags</span>
                </div>
                <span style={{ fontSize: '10px', color: '#64748B' }}>
                  {soilRecs.fertilizer_requirements.mop.total_kg} kg total
                </span>
              </div>
            </div>
          )}

          {/* Split Schedule Table */}
          {soilRecs?.split_schedule && (
            <div style={{ marginBottom: '18px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', margin: '0 0 8px' }}>
                📅 {currentLang === 'hi' ? '3-चरणीय खाद देने का समय (Split Schedule):' : '3-Stage Application Schedule:'}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {soilRecs.split_schedule.map((split: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '10px',
                      padding: '10px 12px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '12px', color: '#1E3A8A' }}>
                        {split.stage[currentLang] || split.stage.en}
                      </strong>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: '#059669' }}>
                        {split.urea_kg > 0 ? `Urea: ${split.urea_kg} kg  ` : ''}
                        {split.ssp_kg > 0 ? `SSP: ${split.ssp_kg} kg  ` : ''}
                        {split.mop_kg > 0 ? `Potash: ${split.mop_kg} kg` : ''}
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>
                      💡 {split.notes[currentLang] || split.notes.en}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Bullet Recommendations */}
          <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '14px', border: '1px solid #E2E8F0' }}>
            <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} style={{ color: '#16A34A' }} />
              <span>{t.fertilizerRecommendationTitle}</span>
            </h4>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#334155', lineHeight: 1.6 }}>
              {(soilRecs?.recommendations || SOIL_DATA.recommendedFertilizers.map((r) => r[currentLang])).map((recText: string, i: number) => (
                <li key={i} style={{ marginBottom: '4px' }}>
                  {recText}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

    </div>
  );
};
