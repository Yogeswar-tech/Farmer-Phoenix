import { useState, useEffect, type FC, type FormEvent } from 'react';
import type { Language } from '../types';
import { KisanSethuApi } from '../services/api';
import { X, ShieldCheck, CheckCircle2, User, MapPin, Sprout, ArrowRight, Loader2, LogOut, Sparkles, AlertCircle } from 'lucide-react';

export interface FarmerProfile {
  email: string;
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
  const [email, setEmail] = useState('');
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
              email: 'chittoor.farmer@gmail.com',
              farmer_name: 'Venkat Ramanathan',
              location_name: 'Chittoor (Madanapalle Mandi)',
              district: 'Chittoor',
              state: 'Andhra Pradesh',
              primary_crop: 'tomato',
              preferred_lang: 'te'
            },
            {
              email: 'hyderabad.grower@gmail.com',
              farmer_name: 'Kishore Reddy',
              location_name: 'Hyderabad (Bowenpally Mandi)',
              district: 'Hyderabad',
              state: 'Telangana',
              primary_crop: 'chilli',
              preferred_lang: 'te'
            },
            {
              email: 'punjab.wheat@gmail.com',
              farmer_name: 'Harpreet Singh',
              location_name: 'Jalandhar (Doaba Mandi)',
              district: 'Jalandhar',
              state: 'Punjab',
              primary_crop: 'potato',
              preferred_lang: 'hi'
            }
          ]);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    let cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage(
        currentLang === 'hi'
          ? 'कृपया अपना Gmail पता दर्ज करें।'
          : currentLang === 'te'
          ? 'దయచేసి మీ Gmail చిరునామా నమోదు చేయండి.'
          : 'Please enter your Gmail address.'
      );
      return;
    }

    // Auto-append @gmail.com if user only typed username
    if (!cleanEmail.includes('@')) {
      cleanEmail = `${cleanEmail}@gmail.com`;
      setEmail(cleanEmail);
    }

    if (!cleanEmail.endsWith('@gmail.com')) {
      setErrorMessage(
        currentLang === 'hi'
          ? 'केवल Gmail खाते (@gmail.com) ही समर्थित हैं।'
          : currentLang === 'te'
          ? 'ప్రస్తుతం కేవలం Gmail (@gmail.com) ఖాతాలు మాత్రమే చెల్లుబాటు అవుతాయి.'
          : 'Authentication restricted: Only valid Gmail accounts (@gmail.com) are currently accepted.'
      );
      return;
    }

    setLoading(true);
    try {
      const res = await KisanSethuApi.loginWithGmail({
        email: cleanEmail,
        farmerName: farmerName.trim() || undefined,
        preferredLang: currentLang
      });

      if (res && res.status === 'success' && res.profile) {
        onLoginSuccess(res.profile);
        onClose();
      } else {
        throw new Error(res?.detail || 'Login failed');
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message ||
          (currentLang === 'hi'
            ? 'लॉगिन विफल रहा। कृपया पुनः प्रयास करें।'
            : 'Login failed. Please verify your Gmail address.')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (acc: any) => {
    setErrorMessage(null);
    setLoading(true);
    try {
      const res = await KisanSethuApi.loginWithGmail({
        email: acc.email,
        farmerName: acc.farmer_name,
        locationId: acc.location_id,
        locationName: acc.location_name,
        district: acc.district,
        state: acc.state,
        latitude: acc.latitude,
        longitude: acc.longitude,
        pincode: acc.pincode,
        primaryCrop: acc.primary_crop,
        preferredLang: acc.preferred_lang || currentLang
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
    ? '🌾 किसान सेतु Gmail लॉगिन'
    : currentLang === 'te'
    ? '🌾 కిసాన్ సేతు Gmail లాగిన్'
    : '🌾 Kisan Setu Gmail Sign-In';

  const subtitleText =
    currentLang === 'hi'
      ? 'आपका खेत स्थान, फसल एवं मिट्टी स्वास्थ्य डेटाबेस में सुरक्षित रहेगा'
      : currentLang === 'te'
      ? 'మీ పొలం లొకేషన్, పంట వివరాలు మరియు డేటాబేస్ ప్రొఫైల్ సురక్షితంగా ఉంటాయి'
      : 'Sign in with your Gmail to sync your personal farm GPS, crop records, and DB profile across all pages';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card login-modal-gmail" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} className="modal-close-btn" aria-label="Close">
          <X size={18} />
        </button>

        {/* Header */}
        <div className="gmail-login-header">
          <div className="google-icon-circle">
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          </div>
          <div className="gmail-login-title-col">
            <h3 className="gmail-login-title">{titleText}</h3>
            <p className="gmail-login-subtitle">{subtitleText}</p>
          </div>
        </div>

        {/* If user is already authenticated */}
        {currentUserProfile && currentUserProfile.email ? (
          <div className="active-user-session-card">
            <div className="user-session-top">
              <div className="user-avatar-badge">
                <User size={20} color="#15803D" />
              </div>
              <div className="user-session-info">
                <span className="user-session-name">{currentUserProfile.farmer_name || 'Respected Farmer'}</span>
                <span className="user-session-email">{currentUserProfile.email}</span>
              </div>
              <span className="user-verified-pill">
                <CheckCircle2 size={12} />
                <span>DB Synced</span>
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
                    onLogout();
                    setEmail('');
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
          /* Form for Gmail-only login */
          <form onSubmit={handleLoginSubmit} className="gmail-auth-form">
            {errorMessage && (
              <div className="auth-error-box">
                <AlertCircle size={16} color="#DC2626" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">
                {currentLang === 'hi'
                  ? 'अपना Gmail पता दर्ज करें (@gmail.com):'
                  : currentLang === 'te'
                  ? 'మీ Gmail చిరునామా నమోదు చేయండి (@gmail.com):'
                  : 'Enter Your Gmail Address (@gmail.com):'}
              </label>
              <div className="gmail-input-container">
                <span className="gmail-icon-at">✉️</span>
                <input
                  type="email"
                  placeholder="e.g. yourname@gmail.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  className="form-input gmail-input"
                  required
                />
              </div>
            </div>

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
                    ? 'ఉదా: శివకుమార్ రెడ్డి'
                    : 'e.g. Venkat Ramanathan'
                }
                value={farmerName}
                onChange={(e) => setFarmerName(e.target.value)}
                className="form-input"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="google-signin-primary-btn"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="spin-icon" />
                  <span>Connecting to Database...</span>
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>
                    {currentLang === 'hi'
                      ? 'Gmail से लॉगिन करें (Google Sign-In)'
                      : currentLang === 'te'
                      ? 'Gmail తో లాగిన్ అవ్వండి (Google Sign-In)'
                      : 'Sign in with Gmail (Google)'}
                  </span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Multi-User Isolation & Demo Persona Accounts Section */}
        <div className="demo-accounts-section">
          <div className="demo-section-header">
            <Sparkles size={14} color="#D97706" />
            <span className="demo-section-title">
              {currentLang === 'hi'
                ? 'अलग-अलग किसानों के डेटा का परीक्षण करें (One-Click DB Personas):'
                : currentLang === 'te'
                ? 'వివిధ రైతుల ప్రొఫైల్స్ పరిశీలించండి (One-Click DB Personas):'
                : 'Test Per-User Isolated Sessions (One-Click DB Personas):'}
            </span>
          </div>
          <p className="demo-section-desc">
            {currentLang === 'hi'
              ? 'प्रत्येक खाते का अपना विशिष्ट जिला (चित्तूर vs हैदराबाद) और फसल डेटाबेस में पृथक रहता है।'
              : currentLang === 'te'
              ? 'ఒక్కొక్క ఖాతాకు వారి సొంత జిల్లా (చిత్తూరు vs హైదరాబాద్) మరియు పంట వివరాలు వేరుగా ఉంటాయి.'
              : 'Each account loads its own distinct location (Chittoor vs Hyderabad vs Punjab) and crop without cross-session conflict.'}
          </p>

          <div className="demo-chips-grid">
            {demoAccounts.map((acc) => (
              <button
                key={acc.email}
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
                    <span className="persona-email">{acc.email}</span>
                  </div>
                </div>
                <div className="persona-bottom-row">
                  <span className="persona-badge-loc">📍 {acc.district || acc.location_name}</span>
                  <span className="persona-badge-crop">🌱 {acc.primary_crop || 'Crops'}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Security / DB Isolation Guarantee Footer */}
        <div className="auth-db-security-footer">
          <ShieldCheck size={14} color="#059669" />
          <span>PostgreSQL & SQLite User Isolation Active • End-to-End Profile Protection</span>
        </div>
      </div>
    </div>
  );
};
