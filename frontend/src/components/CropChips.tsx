import type { FC } from 'react';
import type { Language } from '../types';
import { CROP_CHIPS } from '../data/mockData';

interface CropChipsProps {
  currentLang: Language;
  selectedCropKey: string;
  onSelectCrop: (cropKey: string) => void;
}

export const CropChips: FC<CropChipsProps> = ({
  currentLang,
  selectedCropKey,
  onSelectCrop
}) => {
  return (
    <div className="crop-chips-container">
      <div className="crop-chips-label">
        <span>🌾 {currentLang === 'hi' ? 'प्रमुख फसलें चुनें' : currentLang === 'te' ? 'పంటలను ఎంచుకోండి' : 'Select Crop'}:</span>
      </div>
      <div className="crop-chips-scroll">
        {CROP_CHIPS.map((crop) => {
          const isSelected = selectedCropKey === crop.key;
          return (
            <button
              key={crop.key}
              type="button"
              onClick={() => onSelectCrop(crop.key)}
              className={`crop-chip-btn ${isSelected ? 'active' : ''}`}
            >
              <span className="crop-chip-icon">{crop.icon}</span>
              <div className="crop-chip-details">
                <span className="crop-chip-name">{crop.name[currentLang]}</span>
                <span className="crop-chip-count">{crop.count}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
