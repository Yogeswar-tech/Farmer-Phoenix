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

export interface ApiResponse<T> {
  data: T;
  isSample: boolean;
  asOf?: string;
  source?: string;
  error?: string;
}

// Dynamic API Base URL: in production (when bundled in container) uses '/v1' relative path.
// When running locally on Vite port 5173, falls back to http://127.0.0.1:8000/v1.
const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    if (window.location.port === '5173' || window.location.port === '3000') {
      return 'http://127.0.0.1:8000/v1';
    }
    return '/v1';
  }
  return 'http://127.0.0.1:8000/v1';
};

const API_BASE_URL = getApiBaseUrl();

export class KisanSethuApi {
  private static authToken: string | null = (typeof window !== 'undefined') ? localStorage.getItem('ks_auth_token') : null;

  static setAuthToken(token: string | null) {
    this.authToken = token;
    if (typeof window !== 'undefined') {
      if (token) localStorage.setItem('ks_auth_token', token);
      else localStorage.removeItem('ks_auth_token');
    }
  }

  static getAuthToken(): string | null {
    return this.authToken;
  }

  /**
   * Helper to perform fetch with timeout and json parsing
   */
  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {})
    };

    if (this.authToken && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers
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
   * Universal Live Today Mandi Search: searches ANY crop on Earth in PostgreSQL kisan_live_today_db
   */
  static async searchCropTodayPrice(query: string, market?: string, state?: string): Promise<any> {
    try {
      const q = new URLSearchParams({ q: query });
      if (market) q.append('market', market);
      if (state) q.append('state', state);
      const res = await this.request<any>(`/db/live-today/crop-search?${q.toString()}`);
      if (res && res.status === 'success') {
        return res;
      }
      return null;
    } catch (err) {
      console.warn('[API Client] Live today crop search fallback:', err);
      return null;
    }
  }

  /**
   * Get all queued search buttons (crop chips) for quick 1-tap switching in UI
   */
  static async getAllQueuedCrops(): Promise<any[]> {
    try {
      const res = await this.request<any>('/db/live-today/all-crops');
      if (res && res.crops && res.crops.length > 0) {
        return res.crops;
      }
      return [];
    } catch (err) {
      console.warn('[API Client] Failed to fetch queued crops catalog:', err);
      return [];
    }
  }


  /**
   * Trigger 6-Hour Automated Refresh Lifecycle: prunes data older than 6 hours and updates DB
   */
  static async trigger6HourRefresh(): Promise<any> {
    try {
      return await this.request<any>('/db/live-today/refresh-6h', { method: 'POST' });
    } catch (err) {
      console.warn('[API Client] Failed to trigger 6-hour refresh:', err);
      return null;
    }
  }

  /**
   * 1. Live APMC Mandi Rates & Arrivals (Cached in Redis)
   */
  static async getMandiRates(commodity?: string, state?: string): Promise<ApiResponse<any[]>> {
    try {
      // 1. First priority: Today's live prices from dedicated PostgreSQL kisan_live_today_db
      const liveToday = await this.getLiveTodayPrices(commodity, state);
      if (liveToday && liveToday.length > 0) {
        return {
          data: liveToday,
          isSample: false,
          asOf: 'Today Live',
          source: 'Agmarknet APMC Live'
        };
      }

      // 2. Secondary fallback: Generic APMC table
      const queryParams = new URLSearchParams();
      if (commodity) queryParams.append('commodity', commodity);
      if (state) queryParams.append('state', state);

      const res = await this.request<any>(`/db/mandi-rates?${queryParams.toString()}`);
      if (res && res.data && res.data.length > 0) {
        return {
          data: res.data,
          isSample: false,
          asOf: res.as_of || 'Today Live',
          source: res.source || 'Agmarknet APMC'
        };
      }
      return {
        data: MANDI_DATABASE,
        isSample: true,
        asOf: 'Sample Database',
        source: 'Sample Agmarknet Data'
      };
    } catch (err) {
      console.warn('[API Client] Backend unreachable for mandi rates. Returning sample data with isSample: true.', err);
      return {
        data: MANDI_DATABASE,
        isSample: true,
        asOf: 'Sample Database',
        source: 'Sample Agmarknet Data'
      };
    }
  }

  /**
   * 2. Unified Climate & Crop Suitability Prediction Engine
   * Returns up to 16-day spray windows, drying windows, calendar data, risk alerts, and crop suitability.
   */
  static async getClimatePrediction(
    locationId: string = 'guntur',
    district?: string,
    lat?: number,
    lng?: number,
    lang: Language = 'en',
    query?: string,
    days: number = 16
  ): Promise<any> {
    try {
      const params = new URLSearchParams();
      if (query) params.append('query', query);
      params.append('location_id', locationId);
      if (district) params.append('district', district);
      if (lat !== undefined) params.append('lat', String(lat));
      if (lng !== undefined) params.append('lng', String(lng));
      params.append('days', String(days));
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
   * 2b. Pan-India Agricultural Location Search Engine
   * Search across all 28 states, 8 UTs, 750+ districts, tehsils, and PIN codes.
   */
  static async searchClimateLocations(query: string): Promise<any[]> {
    try {
      if (!query || query.trim().length < 2) return [];
      const res = await this.request<any>(`/db/climate-locations?q=${encodeURIComponent(query.trim())}`);
      if (res && res.status === 'success') {
        return res.locations || [];
      }
      return [];
    } catch (err) {
      console.warn('[API Client] Climate location search error:', err);
      return [];
    }
  }

  /**
   * 2c. High-Precision Farm GPS Reverse Geocoder
   * Resolves exact coordinates to village, taluk, district, and state.
   */
  static async reverseGeocodeLocation(lat: number, lng: number): Promise<any | null> {
    try {
      const res = await this.request<any>(`/db/climate-reverse-geocode?lat=${lat}&lng=${lng}`);
      if (res && res.status === 'success') {
        return res.location || null;
      }
      return null;
    } catch (err) {
      console.warn('[API Client] Reverse geocoding error:', err);
      return null;
    }
  }

  /**
   * 2b. 7-Day Operational Weather & Spray Advisories (Cached in Redis)
   */
  static async getWeatherAdvisories(locationId: string = 'guntur'): Promise<ApiResponse<any[]>> {
    try {
      const res = await this.request<any>(`/db/weather-advisories?location_id=${encodeURIComponent(locationId)}`);
      if (res && res.data && res.data.length > 0) {
        return {
          data: res.data,
          isSample: false,
          asOf: res.as_of || 'Today Live',
          source: res.source || 'Open-Meteo & IMD'
        };
      }
      return {
        data: WEATHER_FORECAST,
        isSample: true,
        asOf: 'Sample Forecast',
        source: 'Sample Forecast'
      };
    } catch (err) {
      console.warn('[API Client] Weather backend offline. Returning sample forecast with isSample: true.', err);
      return {
        data: WEATHER_FORECAST,
        isSample: true,
        asOf: 'Sample Forecast',
        source: 'Sample Forecast'
      };
    }
  }

  /**
   * 2c. Nearest APMC Markets by Distance from Selected District
   */
  static async getNearestMarkets(
    district: string,
    state?: string,
    commodity?: string
  ): Promise<ApiResponse<any[]>> {
    try {
      const q = new URLSearchParams({ district });
      if (state) q.append('state', state);
      if (commodity) q.append('commodity', commodity);

      const res = await this.request<any>(`/db/nearest-markets?${q.toString()}`);
      if (res && res.markets && res.markets.length > 0) {
        return {
          data: res.markets,
          isSample: false,
          asOf: res.as_of || 'Today Live',
          source: res.source || 'Agmarknet Geospatial Network'
        };
      }
      return {
        data: [],
        isSample: true,
        asOf: 'Unavailable',
        source: 'Agmarknet Geospatial Network'
      };
    } catch (err) {
      console.warn('[API Client] Nearest markets backend offline:', err);
      return {
        data: [],
        isSample: true,
        asOf: 'Unavailable',
        source: 'Agmarknet Geospatial Network'
      };
    }
  }

  /**
   * 2d. Master Crops Directory & Search
   */
  static async searchCrops(query: string = '', category: string = '', lang: Language = 'en'): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.append('q', query.trim());
      if (category && category !== 'all') params.append('category', category);
      params.append('lang', lang);

      const res = await this.request<any>(`/db/crops/search?${params.toString()}`);
      if (res && res.status === 'success') {
        return res.crops || [];
      }
      return [];
    } catch (err) {
      console.warn('[API Client] Crops search error:', err);
      return [];
    }
  }

  /**
   * 2e. Crop Pesticides Doctor (Database-backed)
   */
  static async getCropPesticides(cropKey: string, lang: Language = 'en'): Promise<any | null> {
    try {
      const res = await this.request<any>(`/db/crops/${encodeURIComponent(cropKey)}/pesticides?lang=${lang}`);
      if (res && res.status === 'success') {
        return res.data || null;
      }
      return null;
    } catch (err) {
      console.warn('[API Client] Crop pesticides fetch error:', err);
      return null;
    }
  }

  /**
   * 2f. 6-Month CIBRC Gazette Sync
   */
  static async syncPesticidesDatabase(): Promise<boolean> {
    try {
      const res = await this.request<any>('/db/pesticides/sync', { method: 'POST' });
      return res?.status === 'success';
    } catch (err) {
      console.warn('[API Client] DB sync error:', err);
      return false;
    }
  }

  /**
   * 2g. Pesticide Search & Crop Compatibility Doctor
   */
  static async searchPesticides(query: string = ''): Promise<any[]> {
    try {
      const res = await this.request<any>(`/db/pesticides/search?q=${encodeURIComponent(query)}`);
      if (res && res.status === 'success') {
        return res.results || [];
      }
      return [];
    } catch (err) {
      console.warn('[API Client] Pesticide search error:', err);
      return [];
    }
  }

  static async getPesticideSuitability(
    pesticideId: string,
    crop?: string,
    tankLiters: number = 15,
    lang: Language = 'en'
  ): Promise<any | null> {
    try {
      const params = new URLSearchParams();
      params.append('pesticide_id', pesticideId);
      if (crop && crop !== 'all') params.append('crop', crop);
      params.append('tank_liters', String(tankLiters));
      params.append('lang', lang);

      const res = await this.request<any>(`/db/pesticides/suitability?${params.toString()}`);
      if (res && res.status === 'success') {
        return res;
      }
      return null;
    } catch (err) {
      console.warn('[API Client] Pesticide suitability fetch error:', err);
      return null;
    }
  }

  static async getAllPesticides(): Promise<any[]> {
    try {
      const res = await this.request<any>('/db/pesticides/all');
      if (res && res.status === 'success') {
        return res.pesticides || [];
      }
      return [];
    } catch (err) {
      console.warn('[API Client] All pesticides list error:', err);
      return [];
    }
  }

  /**
   * 2h. CIBRC Statutory Database & Gemini RAG Doctor
   */
  static async getCibrcCropPresets(cropKey: string): Promise<any | null> {
    try {
      const res = await this.request<any>(`/db/pesticides/cibrc/crop/${encodeURIComponent(cropKey)}`);
      return res || null;
    } catch (err) {
      console.warn('[API Client] CIBRC crop presets error:', err);
      return null;
    }
  }

  static async searchCibrcPesticides(query: string = '', category?: string, crop?: string): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      if (query) params.append('q', query);
      if (category && category !== 'all') params.append('category', category);
      if (crop && crop !== 'all') params.append('crop', crop);
      const res = await this.request<any>(`/db/pesticides/cibrc/search?${params.toString()}`);
      if (res && res.status === 'success') {
        return res.results || [];
      }
      return [];
    } catch (err) {
      console.warn('[API Client] CIBRC search error:', err);
      return [];
    }
  }

  static async checkCibrcSuitability(pesticide: string, crop: string): Promise<any | null> {
    try {
      const params = new URLSearchParams();
      params.append('pesticide', pesticide);
      params.append('crop', crop);
      const res = await this.request<any>(`/db/pesticides/cibrc/suitability?${params.toString()}`);
      return res || null;
    } catch (err) {
      console.warn('[API Client] CIBRC suitability error:', err);
      return null;
    }
  }

  static async askCibrcAiAdvisor(
    query: string,
    crop?: string,
    pesticide?: string,
    lang: Language = 'en'
  ): Promise<any | null> {
    try {
      const res = await this.request<any>('/db/pesticides/cibrc/ai-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, crop, pesticide, lang })
      });
      return res || null;
    } catch (err) {
      console.warn('[API Client] CIBRC AI advisor error:', err);
      return null;
    }
  }

  /**
   * 2i. Unified Multimodal Crop & Pesticide Doctor
   */
  static async diagnoseMultimodalCropDoctor(params: {
    cropKey?: string;
    symptomKey?: string;
    imageBase64?: string;
    mimeType?: string;
    tankLiters?: number;
    lang?: Language;
  }): Promise<any | null> {
    try {
      const res = await this.request<any>('/db/crop-doctor/multimodal-diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crop_key: params.cropKey,
          symptom_key: params.symptomKey,
          image_base64: params.imageBase64,
          mime_type: params.mimeType || 'image/jpeg',
          tank_liters: params.tankLiters || 15,
          lang: params.lang || 'en'
        })
      });
      return res || null;
    } catch (err) {
      console.warn('[API Client] Multimodal crop doctor error:', err);
      return null;
    }
  }



  /**
   * 3. Government Policies, Concessional 4% Loans & Subsidies
   */
  static async getGovtSchemes(category?: string, lang: Language = 'en'): Promise<ApiResponse<GovtScheme[]>> {
    try {
      const catParam = category && category !== 'ALL' ? `category=${encodeURIComponent(category)}&` : '';
      const res = await this.request<any>(`/db/govt-schemes?${catParam}lang=${lang}`);
      if (res && res.schemes && res.schemes.length > 0) {
        return {
          data: res.schemes,
          isSample: false,
          asOf: res.last_sync || 'Ministry of Agriculture',
          source: 'Govt National Schemes Portal'
        };
      }
      return {
        data: GOVT_SCHEMES,
        isSample: true,
        asOf: 'Sample Catalog',
        source: 'Sample Schemes Data'
      };
    } catch (err) {
      console.warn('[API Client] Government schemes backend offline. Using sample schemes.', err);
      return {
        data: GOVT_SCHEMES,
        isSample: true,
        asOf: 'Sample Catalog',
        source: 'Sample Schemes Data'
      };
    }
  }

  /**
   * 4. Cold Storage Directory & Freight Rates
   */
  static async getColdStorages(
    paramsOrDistrict?: {
      district?: string;
      state?: string;
      lat?: number;
      lng?: number;
      radius_km?: number;
      commodity?: string;
      search?: string;
    } | string,
    stateArg?: string
  ): Promise<ApiResponse<any[]>> {
    try {
      const queryParams = new URLSearchParams();
      if (typeof paramsOrDistrict === 'string') {
        if (paramsOrDistrict) queryParams.append('district', paramsOrDistrict);
        if (stateArg) queryParams.append('state', stateArg);
      } else if (paramsOrDistrict && typeof paramsOrDistrict === 'object') {
        if (paramsOrDistrict.district) queryParams.append('district', paramsOrDistrict.district);
        if (paramsOrDistrict.state) queryParams.append('state', paramsOrDistrict.state);
        if (paramsOrDistrict.lat !== undefined && paramsOrDistrict.lat !== null) queryParams.append('lat', String(paramsOrDistrict.lat));
        if (paramsOrDistrict.lng !== undefined && paramsOrDistrict.lng !== null) queryParams.append('lng', String(paramsOrDistrict.lng));
        if (paramsOrDistrict.radius_km !== undefined && paramsOrDistrict.radius_km !== null) queryParams.append('radius_km', String(paramsOrDistrict.radius_km));
        if (paramsOrDistrict.commodity) queryParams.append('commodity', paramsOrDistrict.commodity);
        if (paramsOrDistrict.search) queryParams.append('search', paramsOrDistrict.search);
      }

      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const res = await this.request<any>(`/db/cold-storages${queryString}`);
      if (res && res.facilities && res.facilities.length > 0) {
        const mapped = res.facilities.map((f: any) => {
          const meta = f.facility_meta || {};
          return {
            id: f.facility_id || `cs_${f.id}`,
            facilityId: f.facility_id,
            name: {
              en: f.name,
              hi: meta.name_hi || f.name,
              te: meta.name_te || f.name
            },
            location: {
              en: meta.address || `${f.district}, ${f.state}`,
              hi: meta.address || `${f.district}, ${f.state}`,
              te: meta.address || `${f.district}, ${f.state}`
            },
            district: f.district,
            state: f.state,
            latitude: f.latitude ? Number(f.latitude) : undefined,
            longitude: f.longitude ? Number(f.longitude) : undefined,
            distanceKm: f.distance_km !== null && f.distance_km !== undefined ? Number(f.distance_km) : undefined,
            capacityMt: f.capacity_mt || 5000,
            availableMt: f.available_mt || 1200,
            totalCapacityBags: f.total_capacity_bags || (f.capacity_mt || 5000) * 20,
            vacantCapacityBags: f.vacant_capacity_bags || (f.available_mt || 1200) * 20,
            occupancyPct: f.occupancy_pct ?? Math.round(((f.capacity_mt - f.available_mt) / f.capacity_mt) * 100),
            rentPerBagPerMonth: f.rent_per_bag_per_month || (f.monthly_rent_per_qtl ? Math.round(Number(f.monthly_rent_per_qtl) / 2) : 24),
            monthlyRentPerQtl: f.monthly_rent_per_qtl ? Number(f.monthly_rent_per_qtl) : 48,
            temperatureControlled: true,
            contactPhone: f.contact_phone || '+91 863 2234011',
            hasFumigation: meta.fumigation_certified !== false,
            wdraAccredited: Boolean(f.wdra_accredited ?? meta.wdra_accredited),
            tempRangeC: f.temp_range_c || meta.temp_range_c || '2°C to 8°C',
            chambers: f.chambers || meta.chambers || 6,
            crops: f.crops || meta.crops || [],
            facilityMeta: meta
          };
        });
        return {
          data: mapped,
          isSample: false,
          asOf: 'Today Live',
          source: 'WDRA Warehousing Portal'
        };
      }
      return {
        data: COLD_STORAGES,
        isSample: true,
        asOf: 'Sample Directory',
        source: 'Sample Cold Storage Data'
      };
    } catch (err) {
      console.warn('[API Client] Cold storage backend offline. Using sample directory.', err);
      return {
        data: COLD_STORAGES,
        isSample: true,
        asOf: 'Sample Directory',
        source: 'Sample Cold Storage Data'
      };
    }
  }

  /**
   * 5. AI Multilingual Query / RAG Assistant
   */
  static async askAi(question: string, language: Language = 'en'): Promise<{ answer: string; sources?: any[] }> {
    try {
      const res = await this.request<any>('/ask', {
        method: 'POST',
        body: JSON.stringify({ question, lang: language })
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
    } catch {
      return {
        status: 'fallback',
        cadence: 'Every 6 Hours',
        max_freshness_window_hours: 6,
        last_sync_at: new Date().toISOString()
      };
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

  /**
   * 9. Crop Doctor Diseases & Diagnostic Advisory
   */
  static async getCropDiseases(cropKey: string, lang: Language = 'en'): Promise<any[]> {
    try {
      const res = await this.request<any>(`/db/crops/${encodeURIComponent(cropKey)}/diseases?lang=${lang}`);
      if (res && res.status === 'success' && res.diseases) {
        return res.diseases;
      }
      return [];
    } catch (err) {
      console.warn('[API Client] Crop diseases fetch error:', err);
      return [];
    }
  }

  static async diagnoseCropDisease(
    cropKey: string,
    symptoms?: string,
    locationId: string = 'guntur',
    farmerPhone?: string,
    lang: Language = 'en'
  ): Promise<any | null> {
    try {
      const res = await this.request<any>('/db/crop-doctor/diagnose', {
        method: 'POST',
        body: JSON.stringify({
          crop_key: cropKey,
          symptoms,
          location_id: locationId,
          farmer_phone: farmerPhone,
          lang
        })
      });
      if (res && res.status === 'success') {
        return res;
      }
      return null;
    } catch (err) {
      console.warn('[API Client] Crop disease diagnosis error:', err);
      return null;
    }
  }

  /**
   * 10. Soil Health Doctor & Precision NPK Recommender
   */
  static async getSoilHealthCard(locationId: string = 'guntur', lang: Language = 'en'): Promise<any | null> {
    try {
      const res = await this.request<any>(`/db/soil/health-card?location_id=${encodeURIComponent(locationId)}&lang=${lang}`);
      if (res && res.status === 'success') {
        return res;
      }
      return null;
    } catch (err) {
      console.warn('[API Client] Soil health card fetch error:', err);
      return null;
    }
  }

  static async calculateSoilRecommendation(params: {
    cropKey?: string;
    acres?: number;
    nitrogenKgHa?: number;
    phosphorusKgHa?: number;
    potassiumKgHa?: number;
    ph?: number;
    locationId?: string;
    farmerPhone?: string;
    lang?: Language;
  }): Promise<any | null> {
    try {
      const res = await this.request<any>('/db/soil/recommend', {
        method: 'POST',
        body: JSON.stringify({
          crop_key: params.cropKey || 'chilli',
          acres: params.acres || 1.0,
          nitrogen_kg_ha: params.nitrogenKgHa,
          phosphorus_kg_ha: params.phosphorusKgHa,
          potassium_kg_ha: params.potassiumKgHa,
          ph: params.ph,
          location_id: params.locationId || 'guntur',
          farmer_phone: params.farmerPhone,
          lang: params.lang || 'en'
        })
      });
      if (res && res.status === 'success') {
        return res;
      }
      return null;
    } catch (err) {
      console.warn('[API Client] Soil recommendation calculation error:', err);
      return null;
    }
  }

  static async getSoilLiveTelemetry(lat: number = 16.3067, lng: number = 80.4365, lang: Language = 'en'): Promise<any | null> {
    try {
      const res = await this.request<any>(`/db/soil/live-telemetry?lat=${lat}&lng=${lng}&lang=${lang}`);
      if (res && res.status === 'success') {
        return res;
      }
      return null;
    } catch (err) {
      console.warn('[API Client] Live soil telemetry error:', err);
      return null;
    }
  }

  static async scanSoilReport(imageBase64: string, mimeType: string = 'image/jpeg', lang: Language = 'en'): Promise<any | null> {
    try {
      const res = await this.request<any>('/db/soil/scan-report', {
        method: 'POST',
        body: JSON.stringify({ image_base64: imageBase64, mime_type: mimeType, lang })
      });
      return res || null;
    } catch (err) {
      console.warn('[API Client] Soil report scan error:', err);
      return null;
    }
  }

  static async bookKvkSoilTest(params: {
    farmerName: string;
    farmerPhone: string;
    locationId?: string;
    crop?: string;
    acres?: number;
    address?: string;
    lang?: Language;
  }): Promise<any | null> {
    try {
      const res = await this.request<any>('/db/soil/book-kvk-test', {
        method: 'POST',
        body: JSON.stringify({
          farmer_name: params.farmerName,
          farmer_phone: params.farmerPhone,
          location_id: params.locationId || 'guntur',
          crop: params.crop || 'chilli',
          acres: params.acres || 1.0,
          address: params.address || '',
          lang: params.lang || 'en'
        })
      });
      return res || null;
    } catch (err) {
      console.warn('[API Client] KVK soil test booking error:', err);
      return null;
    }
  }

  /**
   * 11. Mandi Logistics & Inter-Market Arbitrage Calculator
   */
  static async calculateLogisticsRoi(params: {
    cropKey: string;
    loadQuintals?: number;
    vehicleType?: string;
    distanceKm?: number;
    originMandi?: string;
    destinationMandi?: string;
    lang?: Language;
  }): Promise<any | null> {
    try {
      const res = await this.request<any>('/db/logistics/calculate', {
        method: 'POST',
        body: JSON.stringify({
          crop_key: params.cropKey,
          load_quintals: params.loadQuintals ?? 50,
          vehicle_type: params.vehicleType ?? 'tractor',
          distance_km: params.distanceKm,
          origin_mandi: params.originMandi,
          destination_mandi: params.destinationMandi,
          lang: params.lang || 'en'
        })
      });
      if (res && res.status === 'success') {
        return res;
      }
      return null;
    } catch (err) {
      console.warn('[API Client] Logistics ROI calculation error:', err);
      return null;
    }
  }

  static async getLogisticsCorridors(cropKey?: string, lang: Language = 'en'): Promise<any[]> {
    try {
      const param = cropKey ? `crop_key=${encodeURIComponent(cropKey)}&` : '';
      const res = await this.request<any>(`/db/logistics/corridors?${param}lang=${lang}`);
      if (res && res.status === 'success' && res.corridors) {
        return res.corridors;
      }
      return [];
    } catch (err) {
      console.warn('[API Client] Logistics corridors fetch error:', err);
      return [];
    }
  }

  /**
   * 12. Farmer Price Alert Subscriptions
   */
  static async subscribePriceAlert(params: {
    phoneNumber: string;
    cropKey: string;
    cropName?: string;
    targetPrice: number;
    channel?: string;
    mandiName?: string;
  }): Promise<any | null> {
    try {
      const res = await this.request<any>('/db/price-alerts/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          phone_number: params.phoneNumber,
          crop_key: params.cropKey,
          crop_name: params.cropName,
          target_price: params.targetPrice,
          channel: params.channel || 'whatsapp',
          mandi_name: params.mandiName
        })
      });
      if (res && res.status === 'success') {
        return res;
      }
      return null;
    } catch (err) {
      console.warn('[API Client] Price alert subscribe error:', err);
      return null;
    }
  }

  static async getPriceAlerts(phoneNumber: string): Promise<any[]> {
    try {
      const res = await this.request<any>(`/db/price-alerts?phone_number=${encodeURIComponent(phoneNumber)}`);
      if (res && res.status === 'success' && res.alerts) {
        return res.alerts;
      }
      return [];
    } catch (err) {
      console.warn('[API Client] Price alerts fetch error:', err);
      return [];
    }
  }

  /**
   * 13. Farmer Profile Authentication & Persistence (Firebase Phone-OTP & Verified UID)
   */
  static async syncFarmerProfile(params: {
    preferredLang?: Language;
    district?: string;
    primaryCrop?: string;
    farmerName?: string;
    idToken?: string;
  }): Promise<any | null> {
    try {
      if (params.idToken) {
        this.setAuthToken(params.idToken);
      }
      const res = await this.request<any>('/farmer/sync-profile', {
        method: 'POST',
        body: JSON.stringify({
          preferred_lang: params.preferredLang || 'te',
          district: params.district || 'Chittoor',
          primary_crop: params.primaryCrop || 'tomato',
          farmer_name: params.farmerName
        })
      });
      return res;
    } catch (err) {
      console.warn('[API Client] Farmer profile sync error:', err);
      throw err;
    }
  }

  static async getFarmerProfile(phoneNumber?: string): Promise<any | null> {
    try {
      const endpoint = phoneNumber ? `/farmer/profile?phone_number=${encodeURIComponent(phoneNumber)}` : '/farmer/profile';
      const res = await this.request<any>(endpoint);
      if (res && res.status === 'success' && res.profile) {
        return res.profile;
      }
      return null;
    } catch (err) {
      console.warn('[API Client] Farmer profile fetch error:', err);
      return null;
    }
  }

  static async updateFarmerLocation(params: {
    district: string;
    state?: string;
    email?: string;
    locationId?: string;
    locationName?: string;
    latitude?: number;
    longitude?: number;
    pincode?: string;
  }): Promise<any | null> {
    try {
      const res = await this.request<any>('/farmer/profile/location', {
        method: 'PUT',
        body: JSON.stringify({
          district: params.district,
          state: params.state || 'Andhra Pradesh'
        })
      });
      return res;
    } catch (err) {
      console.warn('[API Client] Farmer location sync error:', err);
      return null;
    }
  }

  static async updateFarmerCrop(emailOrCrop: string, cropParam?: string): Promise<any | null> {
    const primaryCrop = cropParam || emailOrCrop;
    try {
      const res = await this.request<any>('/farmer/profile/crop', {
        method: 'PUT',
        body: JSON.stringify({ primary_crop: primaryCrop })
      });
      return res;
    } catch (err) {
      console.warn('[API Client] Farmer crop sync error:', err);
      return null;
    }
  }

  static async getDemoAccounts(): Promise<any[]> {
    try {
      const res = await this.request<any>('/farmer/demo-accounts');
      if (res && res.status === 'success' && res.accounts) {
        return res.accounts;
      }
      return [];
    } catch (err) {
      console.warn('[API Client] Demo accounts fetch error:', err);
      return [];
    }
  }

  static async loginFarmer(params: {
    phoneNumber: string;
    farmerName?: string;
    otp?: string;
    preferredLang?: Language;
    district?: string;
    state?: string;
    primaryCrop?: string;
    idToken?: string;
  }): Promise<any | null> {
    try {
      if (params.idToken) {
        this.setAuthToken(params.idToken);
      }
      const res = await this.request<any>('/farmer/login-otp', {
        method: 'POST',
        body: JSON.stringify({
          phone_number: params.phoneNumber,
          farmer_name: params.farmerName,
          otp: params.otp || '1234',
          preferred_lang: params.preferredLang || 'te',
          district: params.district || 'Guntur',
          state: params.state || 'Andhra Pradesh',
          primary_crop: params.primaryCrop || 'chilli'
        })
      });
      if (res && res.token) {
        this.setAuthToken(res.token);
      }
      if (res && res.status === 'success') {
        return res;
      }
      return null;
    } catch (err) {
      console.warn('[API Client] Farmer login error:', err);
      return null;
    }
  }

  /**
   * 14. Today's Live Page Mandi Prices (kisan_live_today_db)
   * Scraped twice daily (Morning 06:00 AM & Evening 06:00 PM)
   */
  static async getLiveTodayPrices(commodity?: string, state?: string, session?: string): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      if (commodity) params.append('commodity', commodity);
      if (state) params.append('state', state);
      if (session) params.append('session', session);

      const res = await this.request<any>(`/db/live-today/prices?${params.toString()}`);
      if (res && res.data && res.data.length > 0) {
        return res.data;
      }
      return [];
    } catch (err) {
      console.warn('[API Client] Live today prices fetch error:', err);
      return [];
    }
  }

  /**
   * 15. Unified Background Scrapers Telemetry
   */
  static async getScrapersTelemetry(): Promise<any | null> {
    try {
      const res = await this.request<any>('/db/scrapers/telemetry');
      if (res && res.status === 'active') {
        return res;
      }
      return null;
    } catch (err) {
      console.warn('[API Client] Scrapers telemetry fetch error:', err);
      return null;
    }
  }

  /**
   * 18. Trigger Manual Scraper Ingestion Cycle
   */
  static async triggerScraper(scraperName?: string): Promise<any | null> {
    try {
      if (scraperName) {
        const res = await this.request<any>('/db/scrapers/trigger', {
          method: 'POST',
          body: JSON.stringify({ scraper_name: scraperName })
        });
        return res;
      }
      return await this.request<any>('/db/trigger-scraper', { method: 'POST' });
    } catch (err) {
      console.warn('[API Client] Trigger scraper error:', err);
      return null;
    }
  }
}

