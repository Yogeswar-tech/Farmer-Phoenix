import type { FC } from 'react';
import type { Language } from '../types';
import { WEATHER_FORECAST } from '../data/mockData';
import { translations } from '../data/i18n';
import { Sun, Cloud, CloudRain, AlertTriangle, ShieldCheck } from 'lucide-react';

interface WeatherWidgetProps {
  currentLang: Language;
}

export const WeatherWidget: FC<WeatherWidgetProps> = ({ currentLang }) => {
  const t = translations[currentLang];

  const locationText =
    currentLang === 'hi'
      ? '📍 लाइव उपग्रह एवं आईएमडी रडार (Live IMD Radar Sync)'
      : currentLang === 'te'
      ? '📍 లైవ్ శాటిలైట్ & IMD రాడార్'
      : '📍 Live Satellite & IMD Radar Sync';

  const rainUnit =
    currentLang === 'hi' ? 'बारिश' : currentLang === 'te' ? 'వర్షం' : 'Rain';

  const stopSprayText =
    currentLang === 'hi' ? '⛔ छिड़काव बंद' : currentLang === 'te' ? '⛔ స్ప్రే చేయవద్దు' : '⛔ Stop Spray';

  const cautionText =
    currentLang === 'hi' ? '⚠️ सावधानी' : currentLang === 'te' ? '⚠️ జాగ్రత్త' : '⚠️ Caution';

  const safeDayText =
    currentLang === 'hi' ? 'सुरक्षित दिन' : currentLang === 'te' ? 'సురక్షితం' : 'Safe to Spray';

  return (
    <div className="weather-widget-container">
      <div className="weather-widget-header">
        <h2 className="weather-title">
          <span>{t.weatherForecastTitle}</span>
        </h2>
        <span className="location-tag">{locationText}</span>
      </div>

      {/* Weather Alert Ribbon */}
      <div className="rain-risk-banner">
        <AlertTriangle size={20} className="banner-alert-icon" />
        <div className="banner-text">
          <strong>{t.thursdayRainAlertTitle}</strong>
          <span> {t.thursdayRainAlertDesc}</span>
        </div>
      </div>

      {/* 7-Day Grid */}
      <div className="weather-cards-grid">
        {WEATHER_FORECAST.map((day) => {
          const isDanger = day.riskLevel === 'danger';
          const isWarning = day.riskLevel === 'warning';

          return (
            <div
              key={day.date}
              className={`weather-day-card ${isDanger ? 'risk-danger' : isWarning ? 'risk-warning' : 'risk-safe'}`}
            >
              <div className="day-header">
                <span className="day-name">{day.dayName[currentLang] || day.dayName.en}</span>
                <span className="day-date">{day.date}</span>
              </div>

              <div className="day-icon-row">
                {day.condition === 'sunny' && <Sun size={30} className="sun-icon" />}
                {day.condition === 'cloudy' && <Cloud size={30} className="cloud-icon" />}
                {day.condition === 'rain' && <CloudRain size={30} className="rain-icon" />}
                <div className="temp-block">
                  <span className="temp-max">{day.tempMax}°C</span>
                  <span className="temp-min">/{day.tempMin}°C</span>
                </div>
              </div>

              <div className="condition-label">
                <span>{day.conditionText[currentLang] || day.conditionText.en}</span>
                <span className="rain-chance">💧 {day.rainChance}% {rainUnit}</span>
              </div>

              <div className="spraying-note">
                <div className="note-status-row">
                  {isDanger ? (
                    <span className="status-chip danger">{stopSprayText}</span>
                  ) : isWarning ? (
                    <span className="status-chip warning">{cautionText}</span>
                  ) : (
                    <span className="status-chip safe">
                      <ShieldCheck size={12} /> {safeDayText}
                    </span>
                  )}
                </div>
                <p className="advice-snippet">{day.sprayingAdvice[currentLang] || day.sprayingAdvice.en}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
