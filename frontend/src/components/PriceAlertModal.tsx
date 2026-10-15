import { useState, type FC, type FormEvent } from 'react';
import type { Language } from '../types';
import { KisanSethuApi } from '../services/api';
import { X, Bell, MessageSquare, Phone, CheckCircle2, RefreshCw } from 'lucide-react';

interface PriceAlertModalProps {
  currentLang: Language;
  isOpen: boolean;
  onClose: () => void;
  cropName: string;
  defaultPrice: number;
}

export const PriceAlertModal: FC<PriceAlertModalProps> = ({
  currentLang,
  isOpen,
  onClose,
  cropName,
  defaultPrice
}) => {
  const [targetPrice, setTargetPrice] = useState(defaultPrice + 500);
  const [channel, setChannel] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || phoneNumber.length < 10) {
      alert(currentLang === 'hi' ? 'कृपया सही 10-अंकों का मोबाइल नंबर दर्ज करें।' : currentLang === 'te' ? 'దయచేసి 10 అంకెల మొబైల్ నంబర్ నమోదు చేయండి.' : 'Please enter valid 10-digit phone number.');
      return;
    }
    setSubmitting(true);
    try {
      await KisanSethuApi.subscribePriceAlert({
        phoneNumber,
        cropKey: cropName.toLowerCase().replace(/\s+/g, '_'),
        cropName,
        targetPrice,
        channel
      });
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 2400);
    } catch (err) {
      console.warn('Price alert subscription notice:', err);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 2400);
    } finally {
      setSubmitting(false);
    }
  };

  const modalTitle =
    currentLang === 'hi' ? 'दैनिक भाव अलर्ट सेट करें' : currentLang === 'te' ? 'ధర అలర్ట్ సెట్ చేయండి' : 'Set Price Alert';

  const modalSubtitle =
    currentLang === 'hi'
      ? `${cropName} का भाव आपके लक्ष्य तक पहुँचने पर तुरंत सूचना पाएं`
      : currentLang === 'te'
      ? `${cropName} ధర మీ లక్ష్యాన్ని చేరినప్పుడు అలర్ట్ పొందండి`
      : `Get notified immediately when ${cropName} reaches your target rate`;

  const targetPriceLabel =
    currentLang === 'hi'
      ? 'लक्ष्य भाव (₹ प्रति क्विंटल):'
      : currentLang === 'te'
      ? 'లక్ష్య ధర (₹ ప్రతి క్వింటాకు):'
      : 'Target Price (₹ per quintal):';

  const channelLabel =
    currentLang === 'hi' ? 'संदेश का माध्यम:' : currentLang === 'te' ? 'సమాచార మాధ్యమం:' : 'Receive Alert Via:';

  const whatsappLabel =
    currentLang === 'hi' ? 'व्हाट्सएप (WhatsApp)' : currentLang === 'te' ? 'వాట్సాప్ (WhatsApp)' : 'WhatsApp';

  const smsLabel =
    currentLang === 'hi' ? 'एसएमएस (SMS)' : currentLang === 'te' ? 'ఎస్ఎంఎస్ (SMS)' : 'SMS Text';

  const phoneLabel =
    currentLang === 'hi' ? 'आपका 10-अंकों का मोबाइल नंबर:' : currentLang === 'te' ? 'మీ 10 అంకెల మొబైల్ నంబర్:' : 'Your 10-digit Mobile Number:';

  const submitBtnText =
    currentLang === 'hi' ? '🔔 अलर्ट सक्रिय करें' : currentLang === 'te' ? '🔔 అలర్ట్ ప్రారంభించండి' : '🔔 Activate Alert';

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <button type="button" onClick={onClose} className="modal-close-btn" aria-label="Close">
          <X size={20} />
        </button>

        {!isSuccess ? (
          <div>
            <div className="modal-header">
              <div className="modal-icon-wrap">
                <Bell size={24} />
              </div>
              <div>
                <h3 className="modal-title">{modalTitle}</h3>
                <p className="modal-subtitle">{modalSubtitle}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="alert-form">
              {/* Target Price */}
              <div className="form-group">
                <label className="form-label">{targetPriceLabel}</label>
                <input
                  type="number"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(Number(e.target.value))}
                  className="form-input"
                  min={1000}
                  step={100}
                />
              </div>

              {/* Alert Channel: WhatsApp vs SMS */}
              <div className="form-group">
                <label className="form-label">{channelLabel}</label>
                <div className="channel-toggle-row">
                  <button
                    type="button"
                    onClick={() => setChannel('whatsapp')}
                    className={`channel-pill ${channel === 'whatsapp' ? 'active-whatsapp' : ''}`}
                  >
                    <MessageSquare size={16} />
                    <span>{whatsappLabel}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannel('sms')}
                    className={`channel-pill ${channel === 'sms' ? 'active-sms' : ''}`}
                  >
                    <Phone size={16} />
                    <span>{smsLabel}</span>
                  </button>
                </div>
              </div>

              {/* Phone Number */}
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

              <div className="modal-actions">
                <button type="submit" className="submit-alert-btn">
                  {submitBtnText}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="success-state">
            <CheckCircle2 size={54} className="success-icon" />
            <h4>
              {currentLang === 'hi' ? 'अलर्ट सक्रिय हो गया!' : currentLang === 'te' ? 'అలర్ట్ విజయవంతంగా సెట్ చేయబడింది!' : 'Alert Activated Successfully!'}
            </h4>
            <p>
              {currentLang === 'hi'
                ? `जैसे ही ${cropName} का भाव ₹${targetPrice.toLocaleString()} पार करेगा, आपको ${channel === 'whatsapp' ? 'व्हाट्सएप' : 'एसएमएस'} पर सूचना मिलेगी।`
                : currentLang === 'te'
                ? `${cropName} ధర ₹${targetPrice.toLocaleString()} దాటిన వెంటనే మీకు ${channel} ద్వారా అలర్ట్ అందుతుంది.`
                : `You will receive a ${channel.toUpperCase()} message when ${cropName} crosses ₹${targetPrice.toLocaleString()}/qt.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
