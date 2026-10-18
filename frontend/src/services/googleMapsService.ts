import type { Language, LocationOption } from '../types';
import { KisanSethuApi } from './api';

// Optional Google Maps client API key (Vite pulls from backend/.env via envDir)
const clientEnv = (typeof import.meta !== 'undefined' ? (import.meta.env || {}) : {}) as Record<string, string | undefined>;
const GOOGLE_MAPS_KEY = (
  clientEnv.VITE_GOOGLE_MAPS_API_KEY ||
  clientEnv.KS_GOOGLE_MAPS_API_KEY ||
  ''
).trim().replace(/['"]/g, '');

let isScriptLoading = false;
let isScriptLoaded = false;

declare global {
  interface Window {
    google?: any;
    __googleMapsInitCallback?: () => void;
  }
}

/**
 * Dynamically loads the Google Maps JavaScript API SDK if a valid API key is present
 */
export async function loadGoogleMapsSdk(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (window.google?.maps?.places) return true;
  if (isScriptLoaded) return true;

  if (!GOOGLE_MAPS_KEY || GOOGLE_MAPS_KEY.toLowerCase().startsWith('your_')) {
    return false;
  }

  if (isScriptLoading) {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (window.google?.maps?.places) {
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 100);
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(false);
      }, 6000);
    });
  }

  isScriptLoading = true;
  return new Promise((resolve) => {
    try {
      const existingScript = document.getElementById('google-maps-js-sdk');
      if (existingScript) {
        isScriptLoading = false;
        isScriptLoaded = true;
        resolve(true);
        return;
      }

      window.__googleMapsInitCallback = () => {
        isScriptLoading = false;
        isScriptLoaded = true;
        resolve(true);
      };

      const script = document.createElement('script');
      script.id = 'google-maps-js-sdk';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_KEY)}&libraries=places&callback=__googleMapsInitCallback`;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        isScriptLoading = false;
        resolve(false);
      };
      document.head.appendChild(script);
    } catch {
      isScriptLoading = false;
      resolve(false);
    }
  });
}

/**
 * Searches places using Google Maps Places Autocomplete & Geocoder if available,
 * seamlessly merged with the Pan-India Agricultural Geocoding Engine.
 */
export async function searchGoogleAndAgriLocations(
  query: string,
  _lang: Language = 'en'
): Promise<LocationOption[]> {
  const cleanQ = query.trim();
  if (!cleanQ || cleanQ.length < 2) return [];

  const results: LocationOption[] = [];
  const seenKeys = new Set<string>();

  const addUnique = (loc: LocationOption) => {
    const lat = loc.lat ? loc.lat.toFixed(2) : '';
    const lng = loc.lng ? loc.lng.toFixed(2) : '';
    const key = `${loc.name.en.toLowerCase()}-${loc.district.en.toLowerCase()}-${lat}-${lng}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      results.push(loc);
    }
  };

  // 1. Client-Side Google Maps API (Places Autocomplete / Geocoder)
  if (typeof window !== 'undefined' && window.google?.maps) {
    try {
      if (window.google.maps.places?.AutocompleteService) {
        const autoService = new window.google.maps.places.AutocompleteService();
        const predictions = await new Promise<any[]>((resolve) => {
          autoService.getPlacePredictions(
            {
              input: cleanQ,
              componentRestrictions: { country: 'in' }
            },
            (preds: any[], status: string) => {
              if (status === 'OK' && preds) {
                resolve(preds.slice(0, 5));
              } else {
                resolve([]);
              }
            }
          );
        });

        if (predictions.length > 0 && window.google.maps.Geocoder) {
          const geocoder = new window.google.maps.Geocoder();
          for (const pred of predictions) {
            try {
              const geoRes = await new Promise<any>((resGeo) => {
                geocoder.geocode({ placeId: pred.place_id }, (geoList: any[], st: string) => {
                  if (st === 'OK' && geoList?.[0]) resGeo(geoList[0]);
                  else resGeo(null);
                });
              });

              if (geoRes) {
                const comps = geoRes.address_components || [];
                let subloc = '';
                let loc = '';
                let dist = '';
                let state = 'India';
                let pin = '';

                for (const c of comps) {
                  const types = c.types || [];
                  if (types.includes('sublocality') || types.includes('sublocality_level_1') || types.includes('neighborhood')) {
                    subloc = c.long_name;
                  } else if (types.includes('locality')) {
                    loc = c.long_name;
                  } else if (types.includes('administrative_area_level_2')) {
                    dist = c.long_name;
                  } else if (types.includes('administrative_area_level_1')) {
                    state = c.long_name;
                  } else if (types.includes('postal_code')) {
                    pin = c.long_name;
                  }
                }

                const primaryName = subloc || loc || pred.structured_formatting?.main_text || pred.description.split(',')[0];
                const lat = geoRes.geometry?.location?.lat?.();
                const lng = geoRes.geometry?.location?.lng?.();

                addUnique({
                  id: `gmap-${pred.place_id}`,
                  name: { en: primaryName, hi: primaryName, te: primaryName },
                  state: { en: state, hi: state, te: state },
                  district: { en: dist || loc || 'Local District', hi: dist || loc || 'Local District', te: dist || loc || 'Local District' },
                  mandiName: {
                    en: `${primaryName} Mandi Yard`,
                    hi: `${primaryName} कृषि मंडी`,
                    te: `${primaryName} మార్కెట్ యార్డ్`
                  },
                  pincode: pin,
                  lat: typeof lat === 'number' ? lat : undefined,
                  lng: typeof lng === 'number' ? lng : undefined
                });
              }
            } catch {
              // Ignore individual place geocode errors
            }
          }
        }
      }
    } catch (err) {
      console.debug('Client Google Maps Places search notice:', err);
    }
  }

  // 2. High-Precision Backend Geocoding Engine (Google Maps API + All-India localities & PIN codes)
  try {
    const remoteList = await KisanSethuApi.searchClimateLocations(cleanQ);
    if (Array.isArray(remoteList)) {
      for (const f of remoteList) {
        addUnique({
          id: f.id,
          name: { hi: f.name, te: f.name, en: f.name },
          state: { hi: f.state, te: f.state, en: f.state },
          district: { hi: f.district, te: f.district, en: f.district },
          mandiName: {
            hi: f.name ? `${f.name} मंडी` : 'स्थानीय मंडी',
            te: f.name ? `${f.name} మార్కెట్` : 'స్థానిక మార్కెట్',
            en: f.name ? `${f.name} Mandi Yard` : 'Local Mandi'
          },
          pincode: f.pincode || '',
          lat: f.latitude,
          lng: f.longitude
        });
      }
    }
  } catch (err) {
    console.debug('Backend climate-locations search notice:', err);
  }

  return results;
}

/**
 * Reverse geocodes exact farm GPS coordinates to village, tehsil, district, and state
 * using Google Maps API with fallback to high-accuracy reverse geocoder.
 */
export async function reverseGeocodeGpsCoordinates(
  lat: number,
  lng: number,
  _lang: Language = 'en'
): Promise<LocationOption | null> {
  // 1. Try Client-side Google Maps Geocoder if loaded
  if (typeof window !== 'undefined' && window.google?.maps?.Geocoder) {
    try {
      const geocoder = new window.google.maps.Geocoder();
      const geoRes = await new Promise<any>((resolve) => {
        geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
          if (status === 'OK' && results?.[0]) resolve(results[0]);
          else resolve(null);
        });
      });

      if (geoRes) {
        const comps = geoRes.address_components || [];
        let subloc = '';
        let loc = '';
        let dist = '';
        let state = 'India';
        let pin = '';

        for (const c of comps) {
          const types = c.types || [];
          if (types.includes('sublocality') || types.includes('sublocality_level_1') || types.includes('neighborhood')) {
            subloc = c.long_name;
          } else if (types.includes('locality')) {
            loc = c.long_name;
          } else if (types.includes('administrative_area_level_2')) {
            dist = c.long_name;
          } else if (types.includes('administrative_area_level_1')) {
            state = c.long_name;
          } else if (types.includes('postal_code')) {
            pin = c.long_name;
          }
        }

        const villageName = subloc || loc || geoRes.formatted_address?.split(',')?.[0] || 'Farm Location';
        return {
          id: `gps-gmap-${lat.toFixed(4)}-${lng.toFixed(4)}`,
          name: { en: villageName, hi: villageName, te: villageName },
          state: { en: state, hi: state, te: state },
          district: { en: dist || loc || 'Local District', hi: dist || loc || 'स्थानीय जिला', te: dist || loc || 'స్థానిక జిల్లా' },
          mandiName: {
            en: `${villageName} Nearest Mandi`,
            hi: `${villageName} निकटतम मंडी`,
            te: `${villageName} సమీప మార్కెట్`
          },
          pincode: pin,
          lat,
          lng
        };
      }
    } catch (err) {
      console.debug('Client Google Geocoder reverse error:', err);
    }
  }

  // 2. High-Precision Backend Reverse Geocoder (Google Maps Geocoding API + Nominatim India)
  try {
    const resolved = await KisanSethuApi.reverseGeocodeLocation(lat, lng);
    if (resolved) {
      return {
        id: resolved.id || `gps-${lat.toFixed(4)}-${lng.toFixed(4)}`,
        name: { hi: resolved.name, te: resolved.name, en: resolved.name },
        state: { hi: resolved.state, te: resolved.state, en: resolved.state },
        district: { hi: resolved.district, te: resolved.district, en: resolved.district },
        mandiName: {
          hi: resolved.name ? `${resolved.name} निकटतम मंडी` : 'निकटतम मंडी',
          te: resolved.name ? `${resolved.name} సమీప మార్కెట్` : 'సమీప మార్కెట్',
          en: resolved.name ? `${resolved.name} Nearest Mandi` : 'Nearest Mandi'
        },
        pincode: resolved.pincode || '',
        lat,
        lng
      };
    }
  } catch (err) {
    console.debug('Backend reverse geocoding notice:', err);
  }

  // 3. Fallback coordinates representation
  return {
    id: `gps-${lat.toFixed(4)}-${lng.toFixed(4)}`,
    name: {
      hi: `खेत (${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E)`,
      te: `పొలం (${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E)`,
      en: `Farm (${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E)`
    },
    state: { hi: 'भारत', te: 'భారత్', en: 'India' },
    district: { hi: 'स्थानीय जिला', te: 'స్థానిక జిల్లా', en: 'Local District' },
    mandiName: { hi: 'निकटतम मंडी', te: 'సమీప మార్కెట్', en: 'Nearest Mandi' },
    pincode: '',
    lat,
    lng
  };
}
