import { useState, type FC } from 'react';
import type { Language, MandiItem } from '../types';
import { CROP_CHIPS, CHILLI_7DAY_TREND } from '../data/mockData';
import { translations } from '../data/i18n';
import { Menu, Bell, Volume2, Share2, ArrowUpRight } from 'lucide-react';

interface MobileMockupViewProps {
  currentLang: Language;
  activeMandi: MandiItem;
  selectedCropKey: string;
  onSelectCrop: (cropKey: string) => void;
  onViewAllRates: () => void;
  onShareWhatsApp: () => void;
}

export const MobileMockupView: FC<MobileMockupViewProps> = ({
  currentLang,
  activeMandi,
  selectedCropKey,
  onSelectCrop,
  onViewAllRates,
  onShareWhatsApp
}) => {
  const t = translations[currentLang];
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const modalGrade = activeMandi.grades.find((g) => g.gradeCode === 'MODAL') || activeMandi.grades[0];

  const handleReadAloud = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const readText =
        currentLang === 'hi'
          ? `${activeMandi.cropName.hi}, ${activeMandi.mandiName.hi} में मुख्य भाव ₹${modalGrade.modalPrice} प्रति क्विंटल है। पिछले सप्ताह से ₹${activeMandi.priceTrend.diffLastWeek} की तेजी है। बेचने का उत्तम समय है।`
          : currentLang === 'te'
          ? `${activeMandi.cropName.te}, ${activeMandi.mandiName.te}లో ప్రధాన ధర ₹${modalGrade.modalPrice} క్వింటాకు. గత వారం కంటే ₹${activeMandi.priceTrend.diffLastWeek} పెరిగింది. అమ్మడానికి మంచి సమయం.`
          : `${activeMandi.cropName.en} at ${activeMandi.mandiName.en}. Today modal price is ₹${modalGrade.modalPrice} per quintal, up ₹${activeMandi.priceTrend.diffLastWeek} above last week. Good time to sell.`;

      const utterance = new SpeechSynthesisUtterance(readText);
      utterance.lang = currentLang === 'te' ? 'te-IN' : currentLang === 'hi' ? 'hi-IN' : 'en-IN';
      utterance.onstart = () => setIsPlayingAudio(true);
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Speech audio is not supported in this browser.');
    }
  };

  return (
    <div className="mobile-app-mockup-screen">
      {/* Mobile App Header (From Mockup Image) */}
      <div className="mobile-mockup-header">
        <button type="button" className="mob-header-icon-btn" aria-label="Menu">
          <Menu size={20} />
        </button>
        <span className="mob-header-title">{t.appName}</span>
        <button type="button" className="mob-header-icon-btn" aria-label="Notifications">
          <Bell size={18} />
        </button>
      </div>

      {/* Live Prices Header Row */}
      <div className="mobile-section-header">
        <h3 className="mob-section-title">{t.tabRates}</h3>
        <button type="button" onClick={onViewAllRates} className="mob-view-all-link">
          {currentLang === 'hi' ? 'सभी देखें' : currentLang === 'te' ? 'అన్నీ చూడండి' : 'View all'}
        </button>
      </div>

      {/* Horizontal Scrollable Crop Cards */}
      <div className="mobile-crop-cards-scroll">
        {CROP_CHIPS.map((chip) => {
          const isSelected = chip.key === selectedCropKey;
          const displayPrice = chip.key === 'chilli' ? '₹14,200/qt' : chip.key === 'tomato' ? '₹3,250/qt' : chip.key === 'groundnut' ? '₹7,850/qt' : chip.key === 'cotton' ? '₹7,650/qt' : chip.key === 'turmeric' ? '₹16,500/qt' : '₹2,450/qt';
          const mandiLocation = chip.key === 'chilli' ? 'Guntur' : chip.key === 'tomato' ? 'Madanapalle' : chip.key === 'groundnut' ? 'Anantapur' : chip.key === 'cotton' ? 'Adoni' : chip.key === 'turmeric' ? 'Kadapa' : 'Kurnool';

          return (
            <div
              key={chip.key}
              onClick={() => onSelectCrop(chip.key)}
              className={`mob-crop-card ${isSelected ? 'active' : ''}`}
            >
              <div className="mob-crop-name">{chip.name[currentLang]}</div>
              <div className="mob-crop-price">{displayPrice}</div>
              <div className="mob-crop-mandi">{mandiLocation}</div>
            </div>
          );
        })}
      </div>

      {/* 7-Day Trend Chart Card */}
      <div className="mobile-trend-chart-card">
        <div className="mob-chart-title">
          {activeMandi.cropName[currentLang]} Prices - {activeMandi.mandiName[currentLang].split(' ')[0]} Mandi
        </div>
        <div className="mob-chart-subtitle">{t.sevenDayPriceTrend}</div>

        <div className="mob-chart-body">
          {/* Y-Axis Reference Markers */}
          <div className="mob-y-axis">
            <span>300</span>
            <span>200</span>
            <span>100</span>
            <span>0</span>
          </div>

          {/* Bar Chart Visual */}
          <div className="mob-bars-container">
            {CHILLI_7DAY_TREND.map((item, idx) => {
              // Exact normalized heights based on mockup
              const barHeights = [45, 55, 62, 70, 78, 74, 72];
              const heightPct = barHeights[idx] || 60;

              return (
                <div key={item.day} className="mob-bar-col">
                  <div className="mob-bar-track">
                    <div
                      className="mob-bar-fill"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="mob-bar-day">{item.day}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Other Mandis Section */}
      <div className="mobile-other-mandis-card">
        <div className="mob-other-title">{t.otherMandisLabel}</div>
        <div className="mob-other-list">
          <div className="mob-other-row">
            <span className="mob-mandi-tag">Adoni</span>
            <span className="mob-mandi-price">₹14,200/qt</span>
          </div>
          <div className="mob-other-row">
            <span className="mob-mandi-tag">Warangal</span>
            <span className="mob-mandi-price">₹14,200/qt</span>
          </div>
          <div className="mob-other-row">
            <span className="mob-mandi-tag">Khammam</span>
            <span className="mob-mandi-price">₹14,550/qt</span>
          </div>
        </div>
      </div>

      {/* Action Buttons: Read Aloud & WhatsApp Share (Exact mockup styling) */}
      <div className="mobile-bottom-actions">
        <button
          type="button"
          onClick={handleReadAloud}
          className={`mob-btn-read-aloud ${isPlayingAudio ? 'playing' : ''}`}
        >
          <Volume2 size={18} />
          <span>{isPlayingAudio ? '...' : t.readAloudBtn}</span>
        </button>

        <button
          type="button"
          onClick={onShareWhatsApp}
          className="mob-btn-share-whatsapp"
        >
          <Share2 size={18} />
          <span>{t.shareWhatsapp}</span>
          <ArrowUpRight size={16} />
        </button>
      </div>
    </div>
  );
};
