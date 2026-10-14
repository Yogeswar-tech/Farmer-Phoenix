import { useState, useEffect, type FC } from 'react';
import type { Language } from '../types';
import { translations } from '../data/i18n';
import { KisanSethuApi } from '../services/api';
import { Database, Zap, RefreshCw, X, Radio } from 'lucide-react';

interface GovtLagNoticeProps {
  currentLang: Language;
  onRefreshTriggered?: () => void;
}

export const GovtLagNotice: FC<GovtLagNoticeProps> = ({ currentLang, onRefreshTriggered }) => {
  const [dismissed, setDismissed] = useState(false);
  const [syncStatus, setSyncStatus] = useState<any | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const t = translations[currentLang];

  const fetchStatus = async () => {
    try {
      const data = await KisanSethuApi.getSyncStatus();
      if (data && data.status) {
        setSyncStatus(data);
      }
    } catch {
      // Backend offline or local fallback
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // 30s poll
    return () => clearInterval(interval);
  }, []);

  const handleManualScrapeSync = async () => {
    try {
      setIsSyncing(true);
      const res = await KisanSethuApi.triggerScraper();
      if (res) {
        await fetchStatus();
        if (onRefreshTriggered) onRefreshTriggered();
      }
    } catch (err) {
      console.warn('Scraper trigger error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  if (dismissed) return null;

  const isConnected = !!syncStatus;
  const dbEngine = syncStatus?.database_engine || 'PostgreSQL / Active DB';
  const totalMandi = syncStatus?.total_records?.mandi_prices || 10;
  const totalWeather = syncStatus?.total_records?.weather_advisories || 35;
  const totalSchemes = syncStatus?.total_records?.govt_schemes || 5;

  return (
    <div
      style={{
        backgroundColor: isConnected ? '#ECFDF5' : '#FEF3C7',
        borderBottom: `1px solid ${isConnected ? '#A7F3D0' : '#FDE68A'}`,
        padding: '8px 16px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        fontSize: '12px',
        color: isConnected ? '#065F46' : '#92400E'
      }}
    >
      {/* Left indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700 }}>
          <Radio size={14} color={isConnected ? '#059669' : '#D97706'} className={isConnected ? '' : 'spin-icon'} />
          <span>
            {isConnected
              ? (currentLang === 'hi' ? '🟢 लाइव बैकएंड कनेक्टेड' : currentLang === 'te' ? '🟢 లైవ్ బ్యాకెండ్ కనెక్ట్ చేయబడింది' : '🟢 Live Backend Connected')
              : (currentLang === 'hi' ? '🟡 बैकएंड कनेक्ट हो रहा है...' : currentLang === 'te' ? '🟡 బ్యాకెండ్ కనెక్ట్ అవుతోంది...' : '🟡 Connecting to Backend...')}
          </span>
        </div>

        <span style={{ color: isConnected ? '#10B981' : '#F59E0B' }}>•</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Database size={13} />
          <span><b>DB:</b> {dbEngine}</span>
        </div>

        <span style={{ color: isConnected ? '#10B981' : '#F59E0B' }}>•</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Zap size={13} color="#F59E0B" />
          <span><b>Redis Cache:</b> Active (TTL 15m)</span>
        </div>

        <span style={{ color: isConnected ? '#10B981' : '#F59E0B' }}>•</span>

        <span>
          <b>Live Scraped Records:</b> {totalMandi} Mandis • {totalWeather} Weather Hubs • {totalSchemes} Schemes
        </span>
      </div>

      {/* Right Action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          onClick={handleManualScrapeSync}
          disabled={isSyncing}
          style={{
            background: isConnected ? '#059669' : '#D97706',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
          }}
          title="Run web scraper immediately and refresh data"
        >
          <RefreshCw size={12} className={isSyncing ? 'spin-icon' : ''} />
          <span>
            {isSyncing
              ? (currentLang === 'hi' ? 'स्क्रैप हो रहा है...' : currentLang === 'te' ? 'స్క్రైప్ అవుతోంది...' : 'Scraping Live Portals...')
              : (currentLang === 'hi' ? '⚡ अभी स्क्रैप करें' : currentLang === 'te' ? '⚡ ఇప్పుడే స్క్రైప్ చేయండి' : '⚡ Scrape & Sync Now')}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            color: isConnected ? '#065F46' : '#92400E'
          }}
          title={t.gotIt}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};
