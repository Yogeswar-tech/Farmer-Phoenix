import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  type UserCredential
} from 'firebase/auth';
import { firebaseAuth, isFirebaseConfigured } from '../services/firebase';

export interface PhoneOtpSignInProps {
  currentLang?: 'en' | 'hi' | 'te';
  onLoginSuccess?: (userCredential: UserCredential, phoneNumber: string) => void;
  onCancel?: () => void;
}

export const PhoneOtpSignIn: React.FC<PhoneOtpSignInProps> = ({
  currentLang = 'en',
  onLoginSuccess,
  onCancel
}) => {
  // Step State: 'phone' (enter phone) -> 'otp' (verify 6-digit code)
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [countryCode, setCountryCode] = useState<string>('+91');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [isOtpMasked, setIsOtpMasked] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  // Cooldown countdown timer for OTP resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Step 1: Send OTP directly and instantly without any captcha
  const handleSendOtp = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanDigits = phoneNumber.replace(/\D/g, '');
    if (!cleanDigits || cleanDigits.length < 10) {
      setErrorMessage(
        currentLang === 'hi'
          ? 'कृपया एक वैध 10-अंकीय मोबाइल नंबर दर्ज करें।'
          : currentLang === 'te'
          ? 'దయచేసి సరైన 10 అంకెల మొబైల్ నంబర్ నమోదు చేయండి.'
          : 'Please enter a valid 10-digit mobile phone number.'
      );
      return;
    }

    const fullPhoneNumber = `${countryCode.trim()}${cleanDigits.slice(-10)}`;
    setLoading(true);

    // 1. Production Mode: Send real SMS OTP to phone via Firebase Auth
    if (isFirebaseConfigured && typeof window !== 'undefined') {
      try {
        let appVerifier = (window as any).recaptchaVerifier;
        if (!appVerifier) {
          appVerifier = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', {
            size: 'invisible'
          });
          (window as any).recaptchaVerifier = appVerifier;
        }

        const confirmation = await signInWithPhoneNumber(firebaseAuth, fullPhoneNumber, appVerifier);
        setConfirmationResult(confirmation);
        setStep('otp');
        setResendCooldown(60);
        setSuccessMessage(
          currentLang === 'hi'
            ? `वास्तविक एसएमएस ओटीपी आपके मोबाइल (${fullPhoneNumber}) पर भेजा गया है।`
            : currentLang === 'te'
            ? `రియల్ ఎస్ఎంఎస్ ఓటీపీ మీ మొబైల్ కు (${fullPhoneNumber}) పంపబడింది.`
            : `Real-time SMS verification code sent to ${fullPhoneNumber}`
        );
        setLoading(false);
        return;
      } catch (realSmsError: any) {
        console.warn('[Firebase Real SMS OTP Notice]:', realSmsError);
        try {
          if ((window as any).recaptchaVerifier) {
            (window as any).recaptchaVerifier.clear?.();
            (window as any).recaptchaVerifier = null;
          }
        } catch {}
        // In production, show the error — do NOT fall through to dev mock flow
        const firebaseMsg = (realSmsError?.message || '').toLowerCase();
        const userMsg = firebaseMsg.includes('quota')
          ? 'SMS quota reached. Please try again in a few minutes.'
          : firebaseMsg.includes('invalid-phone')
          ? 'Invalid phone number format. Please check and retry.'
          : 'SMS verification failed. Please try again.';
        setErrorMessage(userMsg);
        setLoading(false);
        return;
      }
    }

    // 2. Local Development Fallback (only reached when Firebase is NOT configured)
    setTimeout(() => {
      const sessionOtp = Math.floor(100000 + Math.random() * 900000).toString();

      setConfirmationResult({
        confirm: async (enteredOtp: string) => {
          const clean = enteredOtp.replace(/\D/g, '');
          if (clean === sessionOtp) {
            return {
              user: {
                phoneNumber: fullPhoneNumber,
                uid: `farmer_${cleanDigits.slice(-10)}`
              }
            } as any;
          }
          const err: any = new Error(
            currentLang === 'hi'
              ? 'गलत OTP कोड। कृपया सही 6-अंकीय कोड दर्ज करें।'
              : currentLang === 'te'
              ? 'తప్పు ధృవీకరణ కోడ్. దయచేసి సరైన కోడ్ నమోదు చేయండి.'
              : 'Incorrect verification code. Please enter the valid 6-digit code.'
          );
          err.code = 'auth/invalid-verification-code';
          throw err;
        }
      } as any);
      setStep('otp');
      setResendCooldown(30);
      setSuccessMessage(
        currentLang === 'hi'
          ? `[DEV] सत्यापन कोड भेजा गया: ${fullPhoneNumber}`
          : currentLang === 'te'
          ? `[DEV] ధృవీకరణ కోడ్ పంపబడింది: ${fullPhoneNumber}`
          : `[DEV] Verification code sent to ${fullPhoneNumber}`
      );
      setLoading(false);
    }, 300);
  };

  // Step 2: Confirm 6-Digit Real SMS Code
  const handleVerifyOtp = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanOtp = otpCode.replace(/\D/g, '');
    if (cleanOtp.length !== 6) {
      setErrorMessage(
        currentLang === 'hi'
          ? 'कृपया अपने फ़ोन पर प्राप्त पूरा 6-अंकीय ओटीपी दर्ज करें।'
          : currentLang === 'te'
          ? 'దయచేసి మీ ఫోన్‌కు వచ్చిన పూర్తి 6 అంకెల ఓటీపీ నమోదు చేయండి.'
          : 'Please enter the complete 6-digit OTP code received on your phone.'
      );
      return;
    }

    if (!confirmationResult) {
      setErrorMessage(
        currentLang === 'hi'
          ? 'ओटीपी सत्र समाप्त हो गया। कृपया नया कोड भेजें।'
          : 'OTP session expired. Please request a new verification code.'
      );
      setStep('phone');
      return;
    }

    setLoading(true);

    try {
      const userCredential = await confirmationResult.confirm(cleanOtp);
      const fullPhoneNumber = `${countryCode.trim()}${phoneNumber.replace(/\D/g, '').slice(-10)}`;

      setSuccessMessage(
        currentLang === 'hi'
          ? 'फ़ोन नंबर सफलतापूर्वक सत्यापित! लॉगिन हो रहा है...'
          : currentLang === 'te'
          ? 'ఫోన్ నంబర్ ధృవీకరించబడింది! లాగిన్ అవుతోంది...'
          : 'Phone verified successfully! Signing you in...'
      );

      if (onLoginSuccess) {
        onLoginSuccess(userCredential, fullPhoneNumber);
      }
    } catch (err: any) {
      console.error('[Firebase OTP Verify Error]:', err);
      const code = err?.code || '';

      if (code === 'auth/invalid-verification-code') {
        setErrorMessage(
          currentLang === 'hi'
            ? 'अमान्य ओटीपी कोड। कृपया अपने फ़ोन पर प्राप्त एसएमएस कोड जांचें।'
            : currentLang === 'te'
            ? 'తప్పు ఓటీపీ కోడ్. దయచేసి మీ ఫోన్‌కు వచ్చిన ఎస్ఎంఎస్ కోడ్ సరిచూసుకోండి.'
            : 'Incorrect verification code. Please check the SMS on your phone and retry.'
        );
      } else if (code === 'auth/code-expired') {
        setErrorMessage(
          currentLang === 'hi'
            ? 'यह कोड समाप्त हो चुका है। कृपया "पुनः कोड भेजें" दबाएं।'
            : 'Verification code has expired. Please tap "Resend Code".'
        );
      } else {
        setErrorMessage(
          err?.message ||
            (currentLang === 'hi'
              ? 'ओटीपी सत्यापन विफल रहा।'
              : 'Failed to verify OTP. Please try again.')
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.cardContainer}>
      {/* Invisible Recaptcha Container for Real SMS Delivery */}
      <div id="recaptcha-container" />

      {/* Card Header */}
      <View style={styles.headerRow}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>📱</Text>
        </View>
        <View style={styles.headerTextCol}>
          <Text style={styles.titleText}>
            {step === 'phone'
              ? currentLang === 'hi'
                ? 'मोबाइल नंबर द्वारा ओटीपी लॉगिन'
                : currentLang === 'te'
                ? 'మొబైల్ ఓటీపీ లాగిన్'
                : 'Phone Number OTP Sign-In'
              : currentLang === 'hi'
              ? 'ओटीपी कोड दर्ज करें'
              : currentLang === 'te'
              ? 'ఓటీపీ కోడ్ నమోదు చేయండి'
              : 'Verify Phone OTP'}
          </Text>
          <Text style={styles.subtitleText}>
            {step === 'phone'
              ? currentLang === 'hi'
                ? 'किसान सेतु पर सुरक्षित रूप से लॉगिन करने के लिए अपना फ़ोन नंबर दर्ज करें'
                : currentLang === 'te'
                ? 'కిసాన్ సేతులోకి ప్రవేశించడానికి మీ మొబైల్ నంబర్ నమోదు చేయండి'
                : 'Enter your mobile number to receive a 6-digit SMS verification code'
              : currentLang === 'hi'
              ? `सत्यापन कोड: ${countryCode} ${phoneNumber.replace(/\D/g, '').slice(-10)}`
              : currentLang === 'te'
              ? `ధృవీకరణ కోడ్: ${countryCode} ${phoneNumber.replace(/\D/g, '').slice(-10)}`
              : `Verification for ${countryCode} ${phoneNumber.replace(/\D/g, '').slice(-10)}`}
          </Text>
        </View>
      </View>

      {/* Error Message Banner */}
      {errorMessage && (
        <View style={styles.errorBox}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {/* Success Message Banner */}
      {successMessage && (
        <View style={styles.successBox}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      )}

      {/* STEP 1: Phone Number Input */}
      {step === 'phone' ? (
        <View style={styles.formSection}>
          <Text style={styles.inputLabel}>
            {currentLang === 'hi'
              ? 'मोबाइल नंबर दर्ज करें:'
              : currentLang === 'te'
              ? 'మొబైల్ నంబర్:'
              : 'Mobile Phone Number:'}
          </Text>

          <View style={styles.phoneInputRow}>
            {/* Country Code Field */}
            <TextInput
              style={styles.countryCodeInput}
              value={countryCode}
              onChangeText={setCountryCode}
              placeholder="+91"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              maxLength={4}
            />

            {/* Main Phone Digits Field */}
            <TextInput
              style={styles.phoneDigitsInput}
              value={phoneNumber}
              onChangeText={(val) => {
                setPhoneNumber(val);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="98765 43210"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              maxLength={14}
              autoFocus
            />
          </View>

          <Text style={styles.helperText}>
            {currentLang === 'hi'
              ? '⚡ त्वरित सुरक्षित मोबाइल ओटीपी सत्यापन।'
              : currentLang === 'te'
              ? '⚡ శీఘ్ర సురక్షిత మొబైల్ ఓటీపీ ధృవీకరణ.'
              : '⚡ Fast and secure mobile OTP verification.'}
          </Text>

          {/* Action Button: Get Verification Code */}
          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleSendOtp}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <View style={styles.buttonContentRow}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.primaryButtonText}>
                  {currentLang === 'hi' ? 'ओटीपी तैयार हो रहा है...' : 'Generating OTP...'}
                </Text>
              </View>
            ) : (
              <View style={styles.buttonContentRow}>
                <Text style={styles.primaryButtonText}>
                  {currentLang === 'hi'
                    ? 'सत्यापन कोड प्राप्त करें (Get OTP)'
                    : currentLang === 'te'
                    ? 'ఓటీపీ కోడ్ పొందండి (Get OTP)'
                    : 'Get Verification Code'}
                </Text>
                <Text style={styles.buttonArrow}>➔</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        /* STEP 2: 6-Digit Real SMS Code Verification */
        <View style={styles.formSection}>
          <Text style={styles.inputLabel}>
            {currentLang === 'hi'
              ? 'मोबाइल पर प्राप्त 6-अंकीय एसएमएस कोड दर्ज करें:'
              : currentLang === 'te'
              ? 'మొబైల్ SMS ద్వారా వచ్చిన 6 అంకెల కోడ్ నమోదు చేయండి:'
              : 'Enter 6-Digit SMS Verification Code:'}
          </Text>

          <View style={styles.otpInputWrapper}>
            <TextInput
              style={styles.otpInput}
              value={otpCode}
              onChangeText={(val) => {
                setOtpCode(val.replace(/\D/g, '').slice(0, 6));
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder={isOtpMasked ? "• • • • • •" : "— — — — — —"}
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry={isOtpMasked}
              autoFocus
            />

            <TouchableOpacity
              style={styles.otpMaskToggleBtn}
              onPress={() => setIsOtpMasked((prev) => !prev)}
              activeOpacity={0.7}
              accessibilityLabel={isOtpMasked ? 'Show OTP' : 'Hide OTP'}
            >
              <Text style={styles.otpMaskToggleIcon}>
                {isOtpMasked ? '👁️' : '🔒'}
              </Text>
              <Text style={styles.otpMaskToggleText}>
                {isOtpMasked
                  ? (currentLang === 'hi' ? 'दिखाएं' : currentLang === 'te' ? 'చూపించు' : 'Show')
                  : (currentLang === 'hi' ? 'छिपाएं' : currentLang === 'te' ? 'దాచు' : 'Hide')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Confirm Code Button */}
          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleVerifyOtp}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <View style={styles.buttonContentRow}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.primaryButtonText}>
                  {currentLang === 'hi' ? 'सत्यापित हो रहा है...' : 'Verifying Code...'}
                </Text>
              </View>
            ) : (
              <View style={styles.buttonContentRow}>
                <Text style={styles.primaryButtonText}>
                  {currentLang === 'hi'
                    ? 'कोड सत्यापित करें (Confirm Code)'
                    : currentLang === 'te'
                    ? 'కోడ్ ధృవీకరించండి (Confirm Code)'
                    : 'Confirm Code'}
                </Text>
                <Text style={styles.buttonArrow}>✓</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Resend & Change Number Actions */}
          <View style={styles.otpFooterRow}>
            <TouchableOpacity
              onPress={() => {
                setStep('phone');
                setOtpCode('');
                setErrorMessage(null);
              }}
              disabled={loading}
            >
              <Text style={styles.linkText}>
                {currentLang === 'hi' ? '✏️ नंबर बदलें' : '✏️ Change Number'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSendOtp}
              disabled={loading || resendCooldown > 0}
            >
              <Text
                style={[
                  styles.linkText,
                  resendCooldown > 0 && styles.linkDisabled
                ]}
              >
                {resendCooldown > 0
                  ? currentLang === 'hi'
                    ? `पुनः भेजें (${resendCooldown}s)`
                    : `Resend in ${resendCooldown}s`
                  : currentLang === 'hi'
                  ? '🔄 पुनः कोड भेजें'
                  : '🔄 Resend Code'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Cancel Option */}
      {onCancel && (
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>
            {currentLang === 'hi' ? 'रद्द करें' : currentLang === 'te' ? 'రద్దు చేయి' : 'Cancel'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    marginVertical: 12
  },
  recaptchaContainer: {
    height: 0,
    width: 0,
    overflow: 'hidden'
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14
  },
  iconText: {
    fontSize: 22
  },
  headerTextCol: {
    flex: 1
  },
  titleText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2
  },
  subtitleText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16
  },
  formSection: {
    marginTop: 4
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8
  },
  countryCodeInput: {
    width: 68,
    height: 48,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center'
  },
  phoneDigitsInput: {
    flex: 1,
    height: 48,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 0.5
  },
  otpInputWrapper: {
    position: 'relative',
    marginBottom: 16,
    justifyContent: 'center'
  },
  otpInput: {
    height: 52,
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#059669',
    borderRadius: 12,
    paddingLeft: 24,
    paddingRight: 84,
    fontSize: 22,
    fontWeight: '800',
    color: '#064E3B',
    textAlign: 'center',
    letterSpacing: 6
  },
  otpMaskToggleBtn: {
    position: 'absolute',
    right: 8,
    top: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    zIndex: 10
  },
  otpMaskToggleIcon: {
    fontSize: 13
  },
  otpMaskToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155'
  },
  helperText: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 18
  },
  primaryButton: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3
  },
  buttonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0
  },
  buttonContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2
  },
  buttonArrow: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800'
  },
  otpFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 4
  },
  linkText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#059669'
  },
  linkDisabled: {
    color: '#94A3B8'
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    gap: 8
  },
  errorIcon: {
    fontSize: 14,
    marginTop: 1
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#B91C1C',
    lineHeight: 16
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    gap: 8
  },
  successIcon: {
    fontSize: 14,
    fontWeight: '800',
    color: '#059669'
  },
  successText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46'
  },
  demoOptionBtn: {
    marginTop: 8,
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    alignSelf: 'flex-start'
  },
  demoOptionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800'
  },
  demoModeLink: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 6
  },
  demoModeLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
    textAlign: 'center'
  },
  cancelButton: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 6
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B'
  }
});


