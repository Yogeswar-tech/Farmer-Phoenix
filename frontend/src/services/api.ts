/**
 * Kisan Sethu Production API Client Service
 * 
 * Provides:
 * 1. Typed asynchronous calls to FastAPI backend with configurable baseUrl
 * 2. Automatic fallback to local mock data if the backend server is unreachable
 * 3. Centralized error handling and latency tracking
 */

import type { Language, GovtScheme } from '../types';
import { MANDI_DATABASE, COLD_STORAGES, GOVT_SCHEMES, WEATHER_FORECAST } from '../data/mockData';

const API_BASE_URL = 'http://127.0.0.1:8000/v1';

export class KisanSethuApi {
  /**
   * Helper to perform fetch with timeout and json parsing
   */
  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  /**
   * 1. Live APMC Mandi Rates & Arrivals (Cached in Redis)
   */
  static async getMandiRates(commodity?: string, state?: string): Promise<any[]> {
    try {
      const queryParams = new URLSearchParams();
      if (commodity) queryParams.append('commodity', commodity);
      if (state) queryParams.append('state', state);

      const res = await this.request<any>(`/db/mandi-rates?${queryParams.toString()}`);
      if (res && res.data && res.data.length > 0) {
        return res.data;
      }
      return MANDI_DATABASE;
    } catch (err) {
      console.warn('[API Client] Backend unreachable for mandi rates. Using resilient fallback.', err);
      return MANDI_DATABASE;
    }
  }

  /**
   * 2. Unified Climate & Crop Suitability Prediction Engine
   * Returns 7-day spray windows, drying windows, risk alerts, and crop suitability in one call.
   */
  static async getClimatePrediction(
    locationId: string = 'guntur',
    district?: string,
    lat?: number,
    lng?: number,
    lang: Language = 'en'
  ): Promise<any> {
    try {
      const params = new URLSearchParams();
      params.append('location_id', locationId);
      if (district) params.append('district', district);
      if (lat !== undefined) params.append('lat', String(lat));
      if (lng !== undefined) params.append('lng', String(lng));
      params.append('lang', lang);

      const res = await this.request<any>(`/db/climate-prediction?${params.toString()}`);
      if (res && res.status === 'success') {
        return res;
      }
      return null;
    } catch (err) {
      console.warn('[API Client] Climate prediction backend offline. Using calibrated resilience fallback.', err);
      return null;
    }
  }

  /**
   * 2b. 7-Day Operational Weather & Spray Advisories (Cached in Redis)
   */
  static async getWeatherAdvisories(locationId: string = 'guntur'): Promise<any[]> {
    try {
      const res = await this.request<any>(`/db/weather-advisories?location_id=${encodeURIComponent(locationId)}`);
      if (res && res.data && res.data.length > 0) {
        return res.data;
      }
      return WEATHER_FORECAST;
    } catch (err) {
      console.warn('[API Client] Weather backend offline. Falling back to local forecast.', err);
      return WEATHER_FORECAST;
    }
  }

  /**
   * 3. Government Policies, Concessional 4% Loans & Subsidies
   */
  static async getGovtSchemes(category?: string, lang: Language = 'en'): Promise<GovtScheme[]> {
    try {
      const catParam = category && category !== 'ALL' ? `category=${encodeURIComponent(category)}&` : '';
      const res = await this.request<any>(`/db/govt-schemes?${catParam}lang=${lang}`);
      if (res && res.schemes && res.schemes.length > 0) {
        return res.schemes;
      }
      return GOVT_SCHEMES;
    } catch (err) {
      console.warn('[API Client] Government schemes backend offline. Using fallback schemes.', err);
      return GOVT_SCHEMES;
    }
  }

  /**
   * 4. Cold Storage Directory & Freight Rates
   */
  static async getColdStorages(district?: string, state?: string): Promise<any[]> {
    try {
      const queryParams = new URLSearchParams();
      if (district) queryParams.append('district', district);
      if (state) queryParams.append('state', state);

      const res = await this.request<any>(`/db/cold-storages?${queryParams.toString()}`);
      if (res && res.facilities && res.facilities.length > 0) {
        return res.facilities.map((f: any) => ({
          id: f.facility_id || `cs_${f.id}`,
          name: typeof f.name === 'object' ? f.name : { en: f.name, hi: f.name, te: f.name },
          location: { en: `${f.district}, ${f.state}`, hi: `${f.district}, ${f.state}`, te: `${f.district}, ${f.state}` },
          district: f.district,
          state: f.state,
          latitude: f.latitude ? Number(f.latitude) : undefined,
          longitude: f.longitude ? Number(f.longitude) : undefined,
          distanceKm: f.distance_km || 15,
          totalCapacityBags: (f.capacity_mt || 5000) * 20,
          vacantCapacityBags: (f.available_mt || 1200) * 20,
          rentPerBagPerMonth: f.monthly_rent_per_qtl ? Math.round(Number(f.monthly_rent_per_qtl) / 2) : 24,
          monthlyRentPerQtl: f.monthly_rent_per_qtl ? Number(f.monthly_rent_per_qtl) : 48,
          temperatureControlled: true,
          contactPhone: f.contact_phone || '+91 863 2234011',
          hasFumigation: true,
          facilityMeta: f.facility_meta || {}
        }));
      }
      return COLD_STORAGES;
    } catch (err) {
      console.warn('[API Client] Cold storage backend offline. Using fallback list.', err);
      return COLD_STORAGES;
    }
  }

  /**
   * 5. AI Multilingual Query / RAG Assistant
   */
  static async askAi(question: string, language: Language = 'en'): Promise<{ answer: string; sources?: any[] }> {
    try {
      const res = await this.request<any>('/ask', {
        method: 'POST',
        body: JSON.stringify({ question, language })
      });
      return {
        answer: res.answer || res.response || 'Advisory received successfully.',
        sources: res.sources || []
      };
    } catch (err) {
      console.warn('[API Client] AI backend offline. Providing calibrated response.', err);
      return {
        answer: language === 'te' 
          ? 'ప్రస్తుతం సర్వర్ ఆఫ్‌లైన్‌లో ఉంది. గ్రేడ్-ఎ మిర్చి ధరలు ₹15,200/క్వింటా వద్ద స్థిరంగా ఉన్నాయి.'
          : language === 'hi'
            ? 'सर्वर वर्तमान में ऑफ़लाइन है। ग्रेड-ए मिर्च के भाव ₹15,200/क्विंटल पर स्थिर हैं।'
            : 'Server currently in offline mode. Grade-A chilli prices are steady at ₹15,200/quintal.'
      };
    }
  }

  /**
   * 6. Live Sync Status & Freshness Telemetry
   */
  static async getSyncStatus(): Promise<any> {
    try {
      return await this.request<any>('/db/sync-status');
    } catch (err) {
      return {
        status: 'fallback',
        cadence: 'Every 6 Hours',
        max_freshness_window_hours: 6,
        last_sync_at: new Date().toISOString()
      };
    }
  }

  /**
   * 7. Trigger Live Scraper Sync
   */
  static async triggerScraper(): Promise<any> {
    try {
      return await this.request<any>('/db/trigger-scraper', { method: 'POST' });
    } catch (err) {
      console.warn('[API Client] Trigger scraper failed:', err);
      return null;
    }
  }

  /**
   * 8. Force Refresh Government Schemes
   */
  static async refreshGovtSchemes(): Promise<any> {
    try {
      return await this.request<any>('/db/refresh-govt-schemes', { method: 'POST' });
    } catch (err) {
      console.warn('[API Client] Refresh govt schemes failed:', err);
      return null;
    }
  }
}
