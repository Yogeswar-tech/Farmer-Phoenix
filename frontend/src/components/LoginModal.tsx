import { useState, type FC, type FormEvent } from 'react';
import type { Language } from '../types';
import { KisanSethuApi } from '../services/api';
import { X, CheckCircle2, User, MapPin, Sprout, ArrowRight, Loader2, LogOut, AlertCircle, ShieldCheck } from 'lucide-react';
import { PhoneOtpSignIn } from './PhoneOtpSignIn';

export interface FarmerProfile {
  firebase_uid?: string;
  email: string;
  farmer_name: string;
  preferred_lang?: Language;
  phone_number?: string;
  first_name?: string;
  last_name?: string;
  mail_id?: string;
  crop_name?: string;
  location_id?: string;
  location_name?: string;
  district?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  pincode?: string;
  primary_crop?: string;
}

interface LoginModalProps {
  currentLang: Language;
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (profile: FarmerProfile) => void;
  onLogout?: () => void;
  currentUserProfile?: FarmerProfile | null;
  lockedFeatureName?: string;
  isMandatoryGate?: boolean;
}

export const LoginModal: FC<LoginModalProps> = ({
  currentLang,
  isOpen,
  onClose,
  onLoginSuccess,
  onLogout,
  currentUserProfile,
  lockedFeatureName,
  isMandatoryGate = false
}) => {
  const [modalView, setModalView] = useState<'auth' | 'farmer_details'>('auth');
  const [pendingPhone, setPendingPhone] = useState<string>('');
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [mailId, setMailId] = useState<string>('');
  const [cropName, setCropName] = useState<string>('Chilli');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    } catch (err) {
      console.warn('[Phone Login] User lookup error:', err);
    } finally {
      setLoading(false);
    }

    // 2. New user or missing profile details: ask farmer details
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
        cropName: cropName.trim() || 'Chilli',
        preferredLang: currentLang
      });

      if (res && res.status === 'success' && res.profile) {
        onLoginSuccess(res.profile);
        onClose();
      } else {
        throw new Error(res?.detail || 'Failed to save details');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not save farmer profile to database.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;


  const titleText = modalView === 'farmer_details'
    ? currentLang === 'hi'
      ? 'किसान विवरण दर्ज करें'
      : currentLang === 'te'
      ? 'రైతు వివరాలు నమోదు చేయండి'
      : 'Complete Farmer Details'
    : lockedFeatureName
    ? currentLang === 'hi'
      ? `🔒 ${lockedFeatureName} अनलॉक करें`
      : currentLang === 'te'
      ? `🔒 ${lockedFeatureName} కొరకు లాగిన్ అవ్వండి`
      : `🔒 Log in to access ${lockedFeatureName}`
    : currentLang === 'hi'
    ? 'किसान सेतु लॉगिन'
    : currentLang === 'te'
    ? 'కిసాన్ సేతు లాగిన్'
    : 'Kisan Setu Login';

  const subtitleText = modalView === 'farmer_details'
    ? currentLang === 'hi'
      ? 'अपनी जानकारी दर्ज करें। फ़ोन नंबर आपका प्राथमिक पहचानकर्ता (Primary Key) है।'
      : currentLang === 'te'
      ? 'మీ వివరాలు నమోదు చేయండి. ఫోన్ నంబర్ మీ ప్రాథమిక కీ (Primary Key).'
      : 'Enter your details below. Phone number serves as your unique primary identifier.'
    : currentLang === 'hi'
    ? 'अपने मोबाइल नंबर (OTP) से सुरक्षित लॉगिन करें'
    : currentLang === 'te'
    ? 'మీ మొబైల్ నంబర్ (OTP)తో సురక్షితంగా లాగిన్ అవ్వండి'
    : 'Sign in securely with Phone Number (OTP) to sync your farm profile and data';

  if (!isOpen) return null;

  return (
    <div
      className={isMandatoryGate ? "login-gate-card-container" : "modal-backdrop"}
      onClick={isMandatoryGate ? undefined : onClose}
      style={isMandatoryGate ? { width: '100%', display: 'flex', justifyContent: 'center' } : undefined}
    >
      <div
        className="modal-card login-modal-gmail"
        style={isMandatoryGate ? {
          position: 'static',
          margin: 0,
          maxWidth: '520px',
          width: '100%',
          boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.25)',
          borderRadius: '20px',
          border: '1px solid #E2E8F0'
        } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {!isMandatoryGate && (
          <button type="button" onClick={onClose} className="modal-close-btn" aria-label="Close">
            <X size={18} />
          </button>
        )}

        {/* Header */}
        <div className="gmail-login-header">
          <div
            className="login-icon-badge"
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              flexShrink: 0,
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)'
            }}
          >
            {modalView === 'farmer_details' ? '👨‍🌾' : '🌾'}
          </div>
          <div className="gmail-login-title-col">
            <h3 className="gmail-login-title">{titleText}</h3>
            <p className="gmail-login-subtitle">{subtitleText}</p>
          </div>
        </div>

        {/* If user is already authenticated */}
        {currentUserProfile && currentUserProfile.email && modalView !== 'farmer_details' ? (
          <div className="active-user-session-card">
            <div className="user-session-top">
              <div className="user-avatar-badge">
                <User size={20} color="#15803D" />
              </div>
              <div className="user-session-info">
                <span className="user-session-name">{currentUserProfile.farmer_name || 'Respected Farmer'}</span>
                <span className="user-session-email">
                  {currentUserProfile.phone_number ? `📱 ${currentUserProfile.phone_number}` : currentUserProfile.email}
                </span>
              </div>
              <span className="user-verified-pill">
                <CheckCircle2 size={12} />
                <span>{currentLang === 'hi' ? 'सक्रिय' : currentLang === 'te' ? 'యాక్టివ్' : 'Active'}</span>
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
                  {currentUserProfile.primary_crop || currentUserProfile.crop_name || 'Tomato'} Cultivator
                </span>
              </div>
            </div>

            <div className="user-session-actions">
              <button
                type="button"
                onClick={onClose}
                className="btn-continue-session"
              >
                <span>Continue to Dashboard</span>
                <ArrowRight size={16} />
              </button>

              {onLogout && (
                <button
                  type="button"
                  onClick={() => {
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
                padding: '4px 10px',
                borderRadius: '12px'
              }}>
                ✓ Verified
              </span>
            </div>

            {errorMessage && (
              <div className="auth-error-box">
                <AlertCircle size={16} color="#DC2626" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Row: First Name & Last Name */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ fontWeight: '700', fontSize: '12px', color: '#334155', marginBottom: '6px', display: 'block' }}>
                  {currentLang === 'hi' ? 'पहला नाम (First Name) *' : currentLang === 'te' ? 'మొదటి పేరు *' : 'First Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={currentLang === 'hi' ? 'उदा: रमेश' : currentLang === 'te' ? 'ఉదా: రమేష్' : 'e.g. Ramesh'}
                  className="form-input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ flex: 1 }}>
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

            <div style={{ textAlign: 'center', marginTop: '12px' }}>
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
            </div>
          </form>
        ) : (
          <PhoneOtpSignIn
            currentLang={currentLang}
            onLoginSuccess={handlePhoneLoginSuccess}
            onCancel={isMandatoryGate ? undefined : onClose}
          />
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
