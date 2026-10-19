import { useState, type FC, type FormEvent } from 'react';
import type { Language } from '../types';
import { KisanSethuApi } from '../services/api';
import { X, ShieldCheck, CheckCircle2, User, MapPin, Sprout, ArrowRight, Loader2, LogOut, Phone, UserCheck } from 'lucide-react';
import { PhoneOtpSignIn } from './PhoneOtpSignIn';

export interface FarmerProfile {
  firebase_uid?: string;
  email?: string;
  phone_number?: string;
  farmer_name: string;
  preferred_lang?: Language;
  location_id?: string;
  location_name?: string;
  district?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  pincode?: string;
  primary_crop?: string;
  is_guest?: boolean;
  first_name?: string;
  last_name?: string;
  mail_id?: string;
  crop_name?: string;
}

interface LoginModalProps {
  currentLang: Language;
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (profile: FarmerProfile) => void;
  onLogout?: () => void;
  currentUserProfile?: FarmerProfile | null;
  lockedFeatureName?: string;
  currentDistrict?: string;
  currentState?: string;
  selectedCropKey?: string;
}

export const LoginModal: FC<LoginModalProps> = ({
  currentLang,
  isOpen,
  onClose,
  onLoginSuccess,
  onLogout,
  currentUserProfile,
  lockedFeatureName,
  currentDistrict,
  currentState,
  selectedCropKey
}) => {
  const [modalView, setModalView] = useState<'auth' | 'farmer_details'>('auth');
  const [pendingPhone, setPendingPhone] = useState<string>('');
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [mailId, setMailId] = useState<string>('');
  const [cropName, setCropName] = useState<string>('Chilli');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePhoneLoginSuccess = async (_userCredential: any, phone: string) => {
    setLoading(true);
    setErrorMessage(null);

    try {
      // 1. Check if user already exists in users DB table with phone_number as Primary Key
      const userLookup = await KisanSethuApi.getUserByPhone(phone);
      if (userLookup && userLookup.status === 'success' && userLookup.exists && userLookup.user) {
        const u = userLookup.user;
        if (u.first_name && u.first_name.trim()) {
          // Existing registered user with details in Users table
          const profile: FarmerProfile = userLookup.profile || {
            phone_number: u.phone_number,
            first_name: u.first_name,
            last_name: u.last_name,
            farmer_name: `${u.first_name} ${u.last_name}`.trim(),
            email: u.mail_id || `${phone.replace(/\D/g, '')}@kisan.farmer.in`,
            mail_id: u.mail_id,
            primary_crop: u.crop_name || 'tomato',
            crop_name: u.crop_name || 'tomato',
            preferred_lang: u.preferred_lang || currentLang,
            district: u.district || 'Local Farm',
            state: u.state || 'India'
          };
          onLoginSuccess(profile);
          onClose();
          return;
        }
      }
    } catch (e) {
      console.warn('[User Lookup Error] Transitioning to farmer registration details form:', e);
    } finally {
      setLoading(false);
    }

    // 2. New user or incomplete profile: Transition to Farmer Details form
    setPendingPhone(phone);
    setFirstName('');
    setLastName('');
    setMailId('');
    setCropName('Chilli');
    setModalView('farmer_details');
  };

  const handleSaveFarmerDetails = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!firstName.trim()) {
      setErrorMessage(
        currentLang === 'hi'
          ? 'कृपया किसान का पहला नाम दर्ज करें।'
          : currentLang === 'te'
          ? 'దయచేసి మొదటి పేరు నమోదు చేయండి.'
          : 'Please enter Farmer First Name.'
      );
      return;
    }

    if (!lastName.trim()) {
      setErrorMessage(
        currentLang === 'hi'
          ? 'कृपया किसान का उपनाम (अंतिम नाम) दर्ज करें।'
          : currentLang === 'te'
          ? 'దయచేసి చివరి పేరు నమోదు చేయండి.'
          : 'Please enter Farmer Last Name.'
      );
      return;
    }

    setLoading(true);
    try {
      const res = await KisanSethuApi.saveUserDetails({
        phoneNumber: pendingPhone,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        mailId: mailId.trim() || undefined,
        cropName: cropName.trim() || 'Tomato',
        district: currentDistrict || 'Local District',
        state: currentState || 'Local State',
        preferredLang: currentLang
      });

      if (res && res.status === 'success' && res.profile) {
        onLoginSuccess(res.profile);
        onClose();
      } else {
        throw new Error(res?.detail || 'Failed to save farmer details to database');
      }
    } catch (err: any) {
      console.error('[Save Farmer Details Error]:', err);
      setErrorMessage(
        err?.message ||
          (currentLang === 'hi'
            ? 'विवरण सहेजने में विफल। कृपया पुनः प्रयास करें।'
            : 'Failed to save details. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = () => {
    const guestName =
      currentLang === 'hi' ? 'अतिथि किसान' : currentLang === 'te' ? 'అతిథి రైతు' : 'Guest Farmer';
    const guestProfile: FarmerProfile = {
      firebase_uid: `guest_${Date.now()}`,
      farmer_name: guestName,
      preferred_lang: currentLang,
      district: currentDistrict || 'Guntur',
      state: currentState || 'Andhra Pradesh',
      primary_crop: selectedCropKey || 'chilli',
      is_guest: true,
    };
    onLoginSuccess(guestProfile);
    onClose();
  };

  const titleText = lockedFeatureName
    ? currentLang === 'hi'
      ? `🔒 ${lockedFeatureName} अनलॉक करें`
      : currentLang === 'te'
      ? `🔒 ${lockedFeatureName} కొరకు లాగిన్ అవ్వండి`
      : `🔒 Log in to access ${lockedFeatureName}`
    : modalView === 'farmer_details'
    ? currentLang === 'hi'
      ? '👨‍🌾 किसान विवरण (Users Data)'
      : currentLang === 'te'
      ? '👨‍🌾 రైతు వివరాలు (వినియోగదారుల సమాచారం)'
      : '👨‍🌾 Farmer Profile Registration'
    : currentLang === 'hi'
    ? '🌾 किसान सेतु — मोबाइल ओटीपी लॉगिन'
    : currentLang === 'te'
    ? '🌾 కిసాన్ సేతు — మొబైల్ ఓటీపీ లాగిన్'
    : '🌾 Kisan Sethu — Mobile OTP Sign In';

  const subtitleText = modalView === 'farmer_details'
    ? currentLang === 'hi'
      ? 'अपना विवरण दर्ज करें। फ़ोन नंबर आपकी प्राथमिक कुंजी (Primary Key) है।'
      : currentLang === 'te'
      ? 'మీ వివరాలు నమోదు చేయండి. ఫోన్ నంబర్ మీ ప్రాథమిక కీ (Primary Key).'
      : 'Enter your details below. Phone number serves as your unique primary identifier.'
    : currentLang === 'hi'
    ? 'अपने मोबाइल नंबर (OTP) से सुरक्षित लॉगिन करें'
    : currentLang === 'te'
    ? 'మీ మొబైల్ నంబర్ (OTP)తో సురక్షితంగా లాగిన్ అవ్వండి'
    : 'Sign in securely with Phone Number (OTP) to sync your farm profile and data';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card login-modal-gmail" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} className="modal-close-btn" aria-label="Close">
          <X size={18} />
        </button>

        {/* Header */}
        <div className="gmail-login-header">
          <div className="google-icon-circle" style={{ background: '#DCFCE7' }}>
            <Phone size={22} color="#15803D" />
          </div>
          <div className="gmail-login-title-col">
            <h3 className="gmail-login-title">{titleText}</h3>
            <p className="gmail-login-subtitle">{subtitleText}</p>
          </div>
        </div>

        {/* If user is already authenticated */}
        {currentUserProfile && (currentUserProfile.phone_number || currentUserProfile.firebase_uid || currentUserProfile.email) ? (
          <div className="active-user-session-card">
            <div className="user-session-top">
              <div className="user-avatar-badge">
                <User size={20} color="#15803D" />
              </div>
              <div className="user-session-info">
                <span className="user-session-name">{currentUserProfile.farmer_name || 'రైతు మిత్ర'}</span>
                <span className="user-session-email">
                  {currentUserProfile.phone_number
                    ? `+91 ${currentUserProfile.phone_number}`
                    : currentUserProfile.is_guest
                    ? 'Guest Mode Session'
                    : currentUserProfile.firebase_uid || 'Verified Farmer'}
                </span>
              </div>
              <span className="user-verified-pill" style={currentUserProfile.is_guest ? { background: '#FEF3C7', color: '#92400E' } : undefined}>
                <CheckCircle2 size={12} color={currentUserProfile.is_guest ? '#D97706' : '#16A34A'} />
                <span>{currentUserProfile.is_guest ? 'Guest Farmer' : 'Verified Farmer'}</span>
              </span>
            </div>

            <div className="user-session-meta-grid">
              <div className="session-meta-chip">
                <MapPin size={13} color="#2563EB" />
                <span>
                  {currentUserProfile.district || 'Chittoor'}, {currentUserProfile.state || 'Andhra Pradesh'}
                </span>
              </div>
              <div className="session-meta-chip">
                <Sprout size={13} color="#16A34A" />
                <span style={{ textTransform: 'capitalize' }}>
                  {currentUserProfile.primary_crop || 'Tomato'} Cultivator
                </span>
              </div>
            </div>

            <div className="user-session-actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={onClose}
                className="btn-continue-session"
              >
                <span>Continue to Dashboard</span>
                <ArrowRight size={16} />
              </button>

              {currentUserProfile.is_guest ? (
                <button
                  type="button"
                  onClick={() => {
                    KisanSethuApi.setAuthToken(null);
                    onLogout?.();
                    setModalView('auth');
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1.5px solid #15803D',
                    background: '#F0FDF4',
                    color: '#166534',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Phone size={15} color="#166534" />
                  <span>
                    {currentLang === 'hi'
                      ? 'फ़ोन नंबर से लॉगिन करें (डेटा सहेजें)'
                      : currentLang === 'te'
                      ? 'ఫోన్ నంబర్‌తో లాగిన్ అవ్వండి (డేటా సేవ్ చేయండి)'
                      : 'Sign In with Phone Number (Save Data)'}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    handleGuestLogin();
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1.5px solid #D97706',
                    background: '#FFFBEB',
                    color: '#92400E',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <UserCheck size={15} color="#92400E" />
                  <span>
                    {currentLang === 'hi'
                      ? 'अतिथि मोड में बदलें'
                      : currentLang === 'te'
                      ? 'అతిథి మోడ్‌కి మారండి'
                      : 'Switch to Guest Mode'}
                  </span>
                </button>
              )}

              {onLogout && (
                <button
                  type="button"
                  onClick={() => {
                    KisanSethuApi.setAuthToken(null);
                    onLogout();
                    setModalView('auth');
                  }}
                  className="btn-signout-session"
                >
                  <LogOut size={15} />
                  <span>Switch Account / Sign Out</span>
                </button>
              )}
            </div>
          </div>
        ) : modalView === 'farmer_details' ? (
          /* Step: Farmer Details Form (First Name, Last Name, Phone Number, optional Mail ID, Crop Name) */
          <form onSubmit={handleSaveFarmerDetails} className="farmer-details-form">
            {/* Verified Phone Banner (Primary Key) */}
            <div style={{
              background: '#ECFDF5',
              border: '1.5px solid #A7F3D0',
              borderRadius: '12px',
              padding: '12px 14px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>📱</span>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#065F46' }}>
                    {pendingPhone}
                  </div>
                  <div style={{ fontSize: '11px', color: '#047857', fontWeight: '700' }}>
                    {currentLang === 'hi'
                      ? 'प्राथमिक कुंजी (Primary Key): सत्यापित मोबाइल'
                      : currentLang === 'te'
                      ? 'ప్రైమరీ కీ (Primary Key): ధృవీకరించిన మొబైల్'
                      : 'Primary Key: Verified Mobile Number'}
                  </div>
                </div>
              </div>
              <span style={{
                background: '#10B981',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: '800',
                padding: '4px 8px',
                borderRadius: '6px'
              }}>
                ✓ {currentLang === 'hi' ? 'सत्यापित' : currentLang === 'te' ? 'ధృవీకరించబడింది' : 'Phone Verified'}
              </span>
            </div>

            {errorMessage && (
              <div className="auth-error-box" style={{ marginBottom: '14px' }}>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Name Fields Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: '700', fontSize: '12px', color: '#334155', marginBottom: '6px', display: 'block' }}>
                  {currentLang === 'hi' ? 'पहला नाम (First Name) *' : currentLang === 'te' ? 'మొదటి పేరు *' : 'First Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={currentLang === 'hi' ? 'उदा: राजेश' : currentLang === 'te' ? 'ఉదా: వెంకట్' : 'e.g. Rajesh'}
                  className="form-input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  autoFocus
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: '700', fontSize: '12px', color: '#334155', marginBottom: '6px', display: 'block' }}>
                  {currentLang === 'hi' ? 'उपनाम (Last Name) *' : currentLang === 'te' ? 'చివరి పేరు *' : 'Last Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={currentLang === 'hi' ? 'उदा: पटेल' : currentLang === 'te' ? 'ఉదా: రెడ్డి' : 'e.g. Patel'}
                  className="form-input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Mail ID (Optional) */}
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ fontWeight: '700', fontSize: '12px', color: '#334155', margin: 0 }}>
                  {currentLang === 'hi' ? 'ईमेल आईडी' : currentLang === 'te' ? 'ఇమెయిల్ ఐడీ' : 'Mail ID'}
                </label>
                <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '700', background: '#F1F5F9', padding: '2px 8px', borderRadius: '4px' }}>
                  {currentLang === 'hi' ? 'वैकल्पिक (Optional)' : currentLang === 'te' ? 'ఐచ్ఛికం (Optional)' : 'Optional'}
                </span>
              </div>
              <input
                type="email"
                value={mailId}
                onChange={(e) => setMailId(e.target.value)}
                placeholder={currentLang === 'hi' ? 'उदा: name@gmail.com (वैकल्पिक)' : 'e.g. name@gmail.com (Optional)'}
                className="form-input"
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            {/* Their Crop Name */}
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label className="form-label" style={{ fontWeight: '700', fontSize: '12px', color: '#334155', marginBottom: '6px', display: 'block' }}>
                {currentLang === 'hi' ? 'उनकी फसल का नाम (Crop Name) *' : currentLang === 'te' ? 'పంట పేరు (Crop Name) *' : 'Their Crop Name *'}
              </label>

              {/* Quick Select Crop Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                {[
                  { key: 'Chilli', icon: '🌶️', hi: 'मिर्च', te: 'మిరప' },
                  { key: 'Tomato', icon: '🍅', hi: 'टमाटर', te: 'టమోటా' },
                  { key: 'Cotton', icon: '🌱', hi: 'कपास', te: 'పత్తి' },
                  { key: 'Onion', icon: '🧅', hi: 'प्याज', te: 'ఉల్లిపాయ' },
                  { key: 'Wheat', icon: '🌾', hi: 'गेहूं', te: 'గోధుమ' },
                  { key: 'Paddy', icon: '🌾', hi: 'धान', te: 'వరి' },
                  { key: 'Potato', icon: '🥔', hi: 'आलू', te: 'బంగాళాదుంప' }
                ].map((c) => {
                  const isSelected = cropName.toLowerCase() === c.key.toLowerCase();
                  const label = currentLang === 'hi' ? c.hi : currentLang === 'te' ? c.te : c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setCropName(c.key)}
                      style={{
                        background: isSelected ? '#15803D' : '#F8FAFC',
                        color: isSelected ? '#FFFFFF' : '#334155',
                        border: isSelected ? '1px solid #15803D' : '1px solid #E2E8F0',
                        borderRadius: '8px',
                        padding: '6px 10px',
                        fontSize: '12px',
                        fontWeight: isSelected ? '800' : '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span>{c.icon}</span>
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>

              <input
                type="text"
                required
                value={cropName}
                onChange={(e) => setCropName(e.target.value)}
                placeholder={currentLang === 'hi' ? 'फसल का नाम (उदा: मिर्च, टमाटर, कपास)' : 'Crop name (e.g. Chilli, Tomato, Cotton)'}
                className="form-input"
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: '#15803D',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 18px',
                fontSize: '14px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(21, 128, 61, 0.25)'
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="spin-icon" />
                  <span>{currentLang === 'hi' ? 'डेटाबेस में सहेजा जा रहा है...' : 'Saving to Users DB Table...'}</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>
                    {currentLang === 'hi'
                      ? 'विवरण सहेजें और लॉगिन पूरा करें ✓'
                      : currentLang === 'te'
                      ? 'వివరాలు సేవ్ చేసి లాగిన్ పూర్తి చేయండి ✓'
                      : 'Save Details & Complete Login ✓'}
                  </span>
                </>
              )}
            </button>

            <div style={{ textAlign: 'center', marginTop: '12px', display: 'flex', justifyContent: 'center', gap: '16px' }}>
              <button
                type="button"
                onClick={() => setModalView('auth')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748B',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                {currentLang === 'hi' ? '← फ़ोन नंबर बदलें' : currentLang === 'te' ? '← ఫోన్ నంబర్ మార్చండి' : '← Change Phone Number'}
              </button>
              <button
                type="button"
                onClick={handleGuestLogin}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#D97706',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                {currentLang === 'hi' ? 'अतिथि के रूप में जारी रखें' : currentLang === 'te' ? 'అతిథిగా కొనసాగించండి' : 'Continue as Guest'}
              </button>
            </div>
          </form>
        ) : (
          <div>
            {/* Top Quick Guest Access Banner */}
            <div style={{
              background: '#FFFBEB',
              border: '1.5px solid #F59E0B',
              borderRadius: '12px',
              padding: '10px 14px',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>🌾</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#92400E' }}>
                    {currentLang === 'hi'
                      ? 'बिना ओटीपी सीधे शुरू करें'
                      : currentLang === 'te'
                      ? 'ఓటీపీ లేకుండా నేరుగా ప్రారంభించండి'
                      : 'Instant Access (No OTP Required)'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#B45309' }}>
                    {currentLang === 'hi'
                      ? 'सभी मंडी भाव और सुविधाएं मुफ्त'
                      : currentLang === 'te'
                      ? 'అన్ని మార్కెట్ ధరలు & ఫీచర్లు ఉచితం'
                      : 'All live prices & features available'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleGuestLogin}
                style={{
                  background: '#D97706',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '7px 14px',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 2px 4px rgba(217, 119, 6, 0.25)',
                  flexShrink: 0
                }}
              >
                <span>{currentLang === 'hi' ? 'अतिथि मोड →' : currentLang === 'te' ? 'అతిథి మోడ్ →' : 'Guest Mode →'}</span>
              </button>
            </div>

            <PhoneOtpSignIn
              currentLang={currentLang}
              onLoginSuccess={handlePhoneLoginSuccess}
              onCancel={onClose}
            />

            {/* Bottom Guest Login Button */}
            <div style={{ marginTop: '14px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                margin: '0 0 12px',
                color: '#94A3B8',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
                <span>
                  {currentLang === 'hi' ? 'या' : currentLang === 'te' ? 'లేదా' : 'OR'}
                </span>
                <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
              </div>
              <button
                type="button"
                onClick={handleGuestLogin}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px 18px',
                  background: '#FEF3C7',
                  border: '1.5px solid #F59E0B',
                  borderRadius: '12px',
                  color: '#92400E',
                  fontSize: '14px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 2px 6px rgba(245, 158, 11, 0.15)'
                }}
                onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#FDE68A'; }}
                onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#FEF3C7'; }}
              >
                <UserCheck size={18} color="#92400E" />
                <span>
                  {currentLang === 'hi'
                    ? 'अतिथि के रूप में जारी रखें (Guest Mode)'
                    : currentLang === 'te'
                    ? 'అతిథిగా కొనసాగించండి (Guest Mode)'
                    : 'Continue as Guest'}
                </span>
              </button>
              <p style={{ textAlign: 'center', fontSize: '11px', color: '#92400E', margin: '6px 0 0', fontWeight: '600' }}>
                {currentLang === 'hi'
                  ? '✓ 1-क्लिक एक्सेस • कोई फ़ोन नंबर या ओटीपी आवश्यक नहीं'
                  : currentLang === 'te'
                  ? '✓ 1-క్లిక్ యాక్సెస్ • ఫోన్ నంబర్ లేదా ఓటీపీ అవసరం లేదు'
                  : '✓ 1-Click Access • No phone number or OTP required'}
              </p>
            </div>
          </div>
        )}

        {/* Security & Farmer Privacy Guarantee Footer */}
        <div className="auth-db-security-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '11px', color: '#64748B', marginTop: '16px' }}>
          <ShieldCheck size={14} color="#059669" />
          <span>Firebase Phone Auth • Minimal Data Stored (Language, District, Crop)</span>
        </div>

        {/* Invisible reCAPTCHA mount point */}
        <div id="recaptcha-container" style={{ display: 'none' }} />
      </div>
    </div>
  );
};
