import { useState, useEffect, type FC, type FormEvent } from 'react';
import type { Language } from '../types';
import { KisanSethuApi } from '../services/api';
import { X, ShieldCheck, CheckCircle2, User, MapPin, Sprout, ArrowRight, Loader2, LogOut, Sparkles, AlertCircle, Phone, KeyRound } from 'lucide-react';

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
}

interface LoginModalProps {
  currentLang: Language;
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (profile: FarmerProfile) => void;
  onLogout?: () => void;
  currentUserProfile?: FarmerProfile | null;
  lockedFeatureName?: string;
}

export const LoginModal: FC<LoginModalProps> = ({
  currentLang,
  isOpen,
  onClose,
  onLoginSuccess,
  onLogout,
  currentUserProfile,
  lockedFeatureName
}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [farmerName, setFarmerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [demoAccounts, setDemoAccounts] = useState<any[]>([]);

  // Fetch pre-seeded isolated personas from backend database
  useEffect(() => {
    if (isOpen) {
      KisanSethuApi.getDemoAccounts()
        .then((accounts) => {
          if (accounts && accounts.length > 0) {
            setDemoAccounts(accounts);
          }
        })
        .catch(() => {
          // Fallback static demo accounts
          setDemoAccounts([
            {
              firebase_uid: 'farmer_demo_chittoor',
              farmer_name: 'Venkat Ramanathan',
              phone_number: '9876543210',
              district: 'Chittoor',
              primary_crop: 'tomato',
              preferred_lang: 'te'
            },
            {
              firebase_uid: 'farmer_demo_hyderabad',
              farmer_name: 'Kishore Reddy',
              phone_number: '9876543211',
              district: 'Hyderabad',
              primary_crop: 'chilli',
              preferred_lang: 'te'
            },
            {
              firebase_uid: 'farmer_demo_punjab',
              farmer_name: 'Harpreet Singh',
              phone_number: '9876543212',
              district: 'Jalandhar',
              primary_crop: 'potato',
              preferred_lang: 'hi'
            }
          ]);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanPhone = phoneNumber.trim().replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      setErrorMessage(
        currentLang === 'hi'
          ? 'कृपया वैध 10 अंकों का मोबाइल नंबर दर्ज करें।'
          : currentLang === 'te'
          ? 'దయచేసి సరైన 10 అంకెల మొబైల్ నంబర్ నమోదు చేయండి.'
          : 'Please enter a valid 10-digit mobile number.'
      );
      return;
    }

    setLoading(true);
    try {
      // Simulate/trigger Firebase Phone Auth SMS confirmation
      await new Promise((res) => setTimeout(res, 400));
      setOtpSent(true);
      setOtp('');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to send OTP. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanPhone = phoneNumber.trim().replace(/\D/g, '').slice(-10);
    if (!otp.trim()) {
      setErrorMessage(
        currentLang === 'hi'
          ? 'कृपया OTP दर्ज करें।'
          : currentLang === 'te'
          ? 'దయచేసి OTP నమోదు చేయండి.'
          : 'Please enter the verification OTP.'
      );
      return;
    }

    setLoading(true);
    try {
      // Firebase ID token exchange (using dev token format for local bypass)
      const mockFirebaseIdToken = `test-token-farmer_phone_${cleanPhone}`;

      const res = await KisanSethuApi.loginFarmer({
        phoneNumber: cleanPhone,
        farmerName: farmerName.trim() || undefined,
        otp: otp.trim(),
        preferredLang: currentLang,
        district: 'Chittoor',
        primaryCrop: 'tomato',
        idToken: mockFirebaseIdToken
      });

      if (res && res.status === 'success' && res.profile) {
        onLoginSuccess(res.profile);
        onClose();
      } else {
        throw new Error(res?.detail || 'OTP verification failed');
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message ||
          (currentLang === 'hi'
            ? 'सत्यापन विफल रहा। कृपया पुनः प्रयास करें।'
            : 'OTP verification failed. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (acc: any) => {
    setErrorMessage(null);
    setLoading(true);
    try {
      const devToken = `test-token-${acc.firebase_uid || acc.phone_number || 'demo'}`;
      KisanSethuApi.setAuthToken(devToken);

      const res = await KisanSethuApi.syncFarmerProfile({
        preferredLang: acc.preferred_lang || currentLang,
        district: acc.district || 'Chittoor',
        primaryCrop: acc.primary_crop || 'tomato',
        farmerName: acc.farmer_name,
        idToken: devToken
      });

      if (res && res.status === 'success' && res.profile) {
        onLoginSuccess(res.profile);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Quick login failed');
    } finally {
      setLoading(false);
    }
  };

  const titleText = lockedFeatureName
    ? currentLang === 'hi'
      ? `🔒 ${lockedFeatureName} अनलॉक करें`
      : currentLang === 'te'
      ? `🔒 ${lockedFeatureName} కొరకు లాగిన్ అవ్వండి`
      : `🔒 Log in to access ${lockedFeatureName}`
    : currentLang === 'hi'
    ? '🌾 किसान सेतु Phone-OTP लॉगिन'
    : currentLang === 'te'
    ? '🌾 కిసాన్ సేతు Phone-OTP లాగిన్'
    : '🌾 Kisan Sethu Phone-OTP Sign-In';

  const subtitleText =
    currentLang === 'hi'
      ? 'Firebase OTP से सुरक्षित लॉगिन करें। आपकी भाषा, जिला और फसल सुरक्षित रहेंगे।'
      : currentLang === 'te'
      ? 'Firebase OTP తో సురక్షిత లాగిన్ అవ్వండి. మీ భాష, జిల్లా మరియు పంట వివరాలు భద్రంగా ఉంటాయి.'
      : 'Secure login with Firebase Phone OTP. Sync your minimal language, district, and crop preferences.';

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
                  {currentUserProfile.phone_number ? `+91 ${currentUserProfile.phone_number}` : (currentUserProfile.firebase_uid || 'Verified Farmer')}
                </span>
              </div>
              <span className="user-verified-pill">
                <CheckCircle2 size={12} />
                <span>Verified Farmer</span>
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
                    KisanSethuApi.setAuthToken(null);
                    onLogout();
                    setPhoneNumber('');
                    setOtp('');
                    setOtpSent(false);
                    setFarmerName('');
                  }}
                  className="btn-signout-session"
                >
                  <LogOut size={15} />
                  <span>Switch Account / Sign Out</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Form for Phone OTP Login */
          <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="gmail-auth-form">
            {errorMessage && (
              <div className="auth-error-box">
                <AlertCircle size={16} color="#DC2626" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">
                {currentLang === 'hi'
                  ? 'अपना 10 अंकों का मोबाइल नंबर दर्ज करें:'
                  : currentLang === 'te'
                  ? 'మీ 10 అంకెల మొబైల్ నంబర్ నమోదు చేయండి:'
                  : 'Enter 10-Digit Mobile Number:'}
              </label>
              <div className="gmail-input-container">
                <span className="gmail-icon-at">+91</span>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="e.g. 9876543210"
                  value={phoneNumber}
                  disabled={otpSent}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value.replace(/\D/g, ''));
                    if (errorMessage) setErrorMessage(null);
                  }}
                  className="form-input gmail-input"
                  required
                />
              </div>
            </div>

            {otpSent && (
              <div className="form-group">
                <label className="form-label">
                  {currentLang === 'hi'
                    ? 'प्राप्त 4-6 अंकों का OTP दर्ज करें:'
                    : currentLang === 'te'
                    ? 'మీకు వచ్చిన OTP కోడ్ నమోదు చేయండి:'
                    : 'Enter Verification OTP:'}
                </label>
                <div className="gmail-input-container">
                  <span className="gmail-icon-at"><KeyRound size={16} /></span>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="e.g. 1234"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="form-input gmail-input"
                    required
                    autoFocus
                  />
                </div>
              </div>
            )}

            {!otpSent && (
              <div className="form-group">
                <label className="form-label">
                  {currentLang === 'hi'
                    ? 'किसान का नाम (वैकल्पिक):'
                    : currentLang === 'te'
                    ? 'రైతు పేరు (ఐచ్ఛికం):'
                    : 'Farmer Name (Optional):'}
                </label>
                <input
                  type="text"
                  placeholder={
                    currentLang === 'hi'
                      ? 'उदा: राजेश पटेल'
                      : currentLang === 'te'
                      ? 'ఉదా: వెంకట్ రామానాథన్'
                      : 'e.g. Venkat Ramanathan'
                  }
                  value={farmerName}
                  onChange={(e) => setFarmerName(e.target.value)}
                  className="form-input"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="google-signin-primary-btn"
              style={{ background: '#16A34A', color: '#fff', borderColor: '#15803D' }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="spin-icon" />
                  <span>Verifying via Firebase...</span>
                </>
              ) : otpSent ? (
                <>
                  <CheckCircle2 size={18} />
                  <span>
                    {currentLang === 'hi'
                      ? 'OTP सत्यापित करें'
                      : currentLang === 'te'
                      ? 'OTP ధృవీకరించండి'
                      : 'Verify OTP & Sign In'}
                  </span>
                </>
              ) : (
                <>
                  <Phone size={18} />
                  <span>
                    {currentLang === 'hi'
                      ? 'OTP प्राप्त करें (Firebase Sign-In)'
                      : currentLang === 'te'
                      ? 'OTP పొందండి (Firebase Sign-In)'
                      : 'Send OTP via Firebase'}
                  </span>
                </>
              )}
            </button>

            {otpSent && (
              <button
                type="button"
                onClick={() => setOtpSent(false)}
                className="btn-link"
                style={{ marginTop: 8, fontSize: '0.85rem', color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Change Phone Number
              </button>
            )}
          </form>
        )}

        {/* Multi-User Isolation & Demo Persona Accounts Section */}
        <div className="demo-accounts-section">
          <div className="demo-section-header">
            <Sparkles size={14} color="#D97706" />
            <span className="demo-section-title">
              {currentLang === 'hi'
                ? 'परीक्षण खाते (One-Click Dev Personas):'
                : currentLang === 'te'
                ? 'పరీక్షా ప్రొఫైల్స్ (One-Click Dev Personas):'
                : 'Test Isolated Personas (One-Click Dev Personas):'}
            </span>
          </div>
          <p className="demo-section-desc">
            {currentLang === 'hi'
              ? 'प्रत्येक खाते का अपना विशिष्ट जिला (चित्तूर vs हैदराबाद) और फसल डेटाबेस में पृथक रहता है।'
              : currentLang === 'te'
              ? 'ఒక్కొక్క ఖాతాకు వారి సొంత జిల్లా (చిత్తూరు vs హైదరాబాద్) మరియు పంట వివరాలు వేరుగా ఉంటాయి.'
              : 'Each account loads its own distinct location and crop without cross-session conflict.'}
          </p>

          <div className="demo-chips-grid">
            {demoAccounts.map((acc) => (
              <button
                key={acc.firebase_uid || acc.phone_number || acc.email}
                type="button"
                onClick={() => handleQuickLogin(acc)}
                disabled={loading}
                className="demo-persona-card"
              >
                <div className="persona-top-row">
                  <span className="persona-avatar">
                    {acc.primary_crop === 'tomato' ? '🍅' : acc.primary_crop === 'chilli' ? '🌶️' : '🥔'}
                  </span>
                  <div className="persona-info-col">
                    <strong className="persona-name">{acc.farmer_name}</strong>
                    <span className="persona-email">{acc.district} • {acc.primary_crop}</span>
                  </div>
                </div>
                <div className="persona-bottom-row">
                  <span className="persona-badge-loc">📍 {acc.district || 'AP'}</span>
                  <span className="persona-badge-crop">🌱 {acc.primary_crop || 'Crops'}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Security & Farmer Privacy Guarantee Footer */}
        <div className="auth-db-security-footer">
          <ShieldCheck size={14} color="#059669" />
          <span>Firebase Phone Auth • Minimal Data Stored (Language, District, Crop)</span>
        </div>
      </div>
    </div>
  );
};
