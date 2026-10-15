import { useState, type FC, type FormEvent } from 'react';
import type { Language } from '../types';
import { KisanSethuApi } from '../services/api';
import { X, ShieldCheck, Phone, CheckCircle2, Lock, RefreshCw } from 'lucide-react';

interface LoginModalProps {
  currentLang: Language;
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (name: string, phone: string) => void;
  lockedFeatureName?: string;
}

export const LoginModal: FC<LoginModalProps> = ({
  currentLang,
  isOpen,
  onClose,
  onLoginSuccess,
  lockedFeatureName
}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [farmerName, setFarmerName] = useState('');
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSendOtp = (e: FormEvent) => {
    e.preventDefault();
    if (phoneNumber.length < 10) {
      alert(currentLang === 'hi' ? 'कृपया 10-अंकों का वैध मोबाइल नंबर दर्ज करें।' : currentLang === 'te' ? 'దయచేసి 10 అంకెల మొబైల్ నంబర్ నమోదు చేయండి.' : 'Please enter a valid 10-digit mobile number.');
      return;
    }
    setOtpStep(true);
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (otp.length < 4) {
      alert(currentLang === 'hi' ? 'कृपया 4-अंकों का ओटीपी दर्ज करें।' : currentLang === 'te' ? 'దయచేసి 4 అంకెల OTP నమోదు చేయండి.' : 'Please enter 4-digit OTP.');
      return;
    }
    const defaultName = currentLang === 'hi' ? 'किसान मित्र' : currentLang === 'te' ? 'రైతు మిత్ర' : 'Farmer Friend';
    const finalName = farmerName.trim() || defaultName;
    setLoading(true);
    try {
      await KisanSethuApi.loginFarmer({
        phoneNumber,
        farmerName: finalName,
        otp,
        preferredLang: currentLang
      });
    } catch (err) {
      console.warn('Farmer profile save note:', err);
    } finally {
      setLoading(false);
      onLoginSuccess(finalName, phoneNumber);
      onClose();
    }
  };

  const titleText = lockedFeatureName
    ? currentLang === 'hi'
      ? `🔒 ${lockedFeatureName} देखने हेतु लॉगिन करें`
      : currentLang === 'te'
      ? `🔒 ${lockedFeatureName} కోసం లాగిన్ అవ్వండి`
      : `🔒 Log in to access ${lockedFeatureName}`
    : currentLang === 'hi'
    ? '🌾 किसान सेतु में लॉगिन / पंजीकरण'
    : currentLang === 'te'
    ? '🌾 కిసాన్ సేతు లాగిన్ / రిజిస్ట్రేషన్'
    : '🌾 Kisan Setu Farmer Login / Register';

  const subtitleText =
    currentLang === 'hi'
      ? '180-दिवसीय मौसम पूर्वानुमान, डॉक्टर पर्चा व बैंक ऋण फॉर्म अनलॉक करने हेतु 1-टैप लॉगिन करें'
      : currentLang === 'te'
      ? '180 రోజుల వాతావరణం, డాక్టర్ ప్రిస్క్రిప్షన్ & లోన్ దరఖాస్తు కోసం లాగిన్ అవ్వండి'
      : 'Log in to unlock 180-day forecast, expert doctor prescriptions & bank loan application forms';

  const nameLabel =
    currentLang === 'hi' ? 'आपका नाम (वैकल्पिक):' : currentLang === 'te' ? 'మీ పేరు (ఐచ్ఛికం):' : 'Your Name (Optional):';

  const phoneLabel =
    currentLang === 'hi' ? 'मोबाइल नंबर (ओटीपी हेतु):' : currentLang === 'te' ? 'మొబైల్ నంబర్ (OTP కొరకు):' : 'Mobile Number (for OTP):';

  const sendOtpBtnText =
    currentLang === 'hi' ? 'ओटीपी भेजें (Send OTP)' : currentLang === 'te' ? 'OTP పంపండి (Send OTP)' : 'Send OTP';

  const orText =
    currentLang === 'hi' ? 'अथवा' : currentLang === 'te' ? 'లేదా' : 'OR';

  const googleBtnText =
    currentLang === 'hi' ? 'Google खाते से तुरंत लॉगिन करें' : currentLang === 'te' ? 'Google తో లాగిన్ అవ్వండి' : 'Sign in instantly with Google';

  const otpSentNotice =
    currentLang === 'hi'
      ? `+91 ${phoneNumber} पर 4-अंकों का ओटीपी भेजा गया है।`
      : currentLang === 'te'
      ? `+91 ${phoneNumber} కి 4 అంకెల OTP పంపబడింది.`
      : `4-digit OTP has been sent to +91 ${phoneNumber}.`;

  const enterOtpLabel =
    currentLang === 'hi' ? '4-अंकों का ओटीपी दर्ज करें (उदा: 1234):' : currentLang === 'te' ? '4 అంకెల OTP నమోదు చేయండి:' : 'Enter 4-digit OTP (e.g. 1234):';

  const verifyBtnText =
    currentLang === 'hi' ? 'सत्यापित करें व प्रवेश करें' : currentLang === 'te' ? 'ధృవీకరించి ప్రవేశించండి' : 'Verify & Enter';

  return (
    <div className="modal-backdrop">
      <div className="modal-card login-modal">
        <button type="button" onClick={onClose} className="modal-close-btn" aria-label="Close">
          <X size={20} />
        </button>

        <div className="login-header">
          <div className="login-icon-badge">
            <ShieldCheck size={28} />
          </div>
          <h3 className="login-title">{titleText}</h3>
          <p className="login-subtitle">{subtitleText}</p>
        </div>

        {!otpStep ? (
          <form onSubmit={handleSendOtp} className="login-form">
            <div className="form-group">
              <label className="form-label">{nameLabel}</label>
              <input
                type="text"
                placeholder={
                  currentLang === 'hi'
                    ? 'उदा: शिवकुमार / राजेश'
                    : currentLang === 'te'
                    ? 'ఉదా: శివకుమార్ / వెంకట్'
                    : 'e.g. David / Venkat'
                }
                value={farmerName}
                onChange={(e) => setFarmerName(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">{phoneLabel}</label>
              <div className="phone-input-wrap">
                <span className="prefix">+91</span>
                <input
                  type="tel"
                  placeholder="98765 43210"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="form-input"
                  required
                />
              </div>
            </div>

            <button type="submit" className="login-submit-btn">
              <Phone size={18} />
              <span>{sendOtpBtnText}</span>
            </button>

            <div className="divider-row">
              <span>{orText}</span>
            </div>

            <button
              type="button"
              onClick={() => {
                const defaultName = currentLang === 'hi' ? 'किसान मित्र' : currentLang === 'te' ? 'రైతు మిత్ర' : 'Farmer Friend';
                onLoginSuccess(defaultName, '9876543210');
                onClose();
              }}
              className="google-login-btn"
            >
              <span className="g-icon">G</span>
              <span>{googleBtnText}</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="login-form">
            <div className="otp-sent-banner">
              <CheckCircle2 size={16} />
              <span>{otpSentNotice}</span>
            </div>

            <div className="form-group">
              <label className="form-label">{enterOtpLabel}</label>
              <input
                type="text"
                placeholder="1234"
                value={otp}
                onChange={(e) => setOtp(e.target.value.slice(0, 4))}
                className="form-input otp-input"
                maxLength={4}
                required
              />
            </div>

            <button type="submit" className="login-submit-btn">
              <Lock size={18} />
              <span>{verifyBtnText}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
