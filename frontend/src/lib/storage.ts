import AsyncStorage from "@react-native-async-storage/async-storage";
import { FarmerEnvelope } from "./types";

export type SupportedLanguage = "en" | "hi" | "te" | "mr";

export interface UserSettings {
  language: SupportedLanguage | null;
  regionId: string | null;
  consent: boolean;
}

const STORAGE_KEYS = {
  LANGUAGE: "ks_language",
  REGION_ID: "ks_region_id",
  CONSENT: "ks_consent",
  INSIGHT_PREFIX: "ks_insight_",
} as const;

const memoryStore = new Map<string, string>();

export async function getLanguage(): Promise<SupportedLanguage | null> {
  try {
    let val = await AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE);
    if (!val) val = memoryStore.get(STORAGE_KEYS.LANGUAGE) ?? null;
    if (val === "en" || val === "hi" || val === "te" || val === "mr") {
      return val;
    }
    return null;
  } catch {
    const val = memoryStore.get(STORAGE_KEYS.LANGUAGE);
    if (val === "en" || val === "hi" || val === "te" || val === "mr") {
      return val;
    }
    return null;
  }
}

export async function setLanguage(lang: SupportedLanguage): Promise<void> {
  try {
    memoryStore.set(STORAGE_KEYS.LANGUAGE, lang);
    await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
  } catch {
    // Safe fallback if storage fails
  }
}

export async function getRegionId(): Promise<string | null> {
  try {
    const val = await AsyncStorage.getItem(STORAGE_KEYS.REGION_ID);
    return val ?? memoryStore.get(STORAGE_KEYS.REGION_ID) ?? null;
  } catch {
    return memoryStore.get(STORAGE_KEYS.REGION_ID) ?? null;
  }
}

export async function setRegionId(regionId: string): Promise<void> {
  try {
    memoryStore.set(STORAGE_KEYS.REGION_ID, regionId);
    await AsyncStorage.setItem(STORAGE_KEYS.REGION_ID, regionId);
  } catch {
    // Safe fallback if storage fails
  }
}

export async function getConsent(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(STORAGE_KEYS.CONSENT);
    const resolved = val ?? memoryStore.get(STORAGE_KEYS.CONSENT);
    return resolved === "true";
  } catch {
    return memoryStore.get(STORAGE_KEYS.CONSENT) === "true";
  }
}

export async function setConsent(consent: boolean): Promise<void> {
  try {
    const str = consent ? "true" : "false";
    memoryStore.set(STORAGE_KEYS.CONSENT, str);
    await AsyncStorage.setItem(STORAGE_KEYS.CONSENT, str);
  } catch {
    // Safe fallback if storage fails
  }
}

export async function getSettings(): Promise<UserSettings> {
  try {
    const [language, regionId, consent] = await Promise.all([
      getLanguage(),
      getRegionId(),
      getConsent(),
    ]);
    return { language, regionId, consent };
  } catch {
    return { language: null, regionId: null, consent: false };
  }
}

export async function getLastInsight(crop: string): Promise<FarmerEnvelope | null> {
  const key = `${STORAGE_KEYS.INSIGHT_PREFIX}${crop.toLowerCase()}`;
  try {
    let raw = await AsyncStorage.getItem(key);
    if (!raw) {
      raw = memoryStore.get(key) ?? null;
    }
    if (!raw) return null;
    return JSON.parse(raw) as FarmerEnvelope;
  } catch {
    const raw = memoryStore.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as FarmerEnvelope;
  }
}

export async function saveLastInsight(crop: string, insight: FarmerEnvelope): Promise<void> {
  const key = `${STORAGE_KEYS.INSIGHT_PREFIX}${crop.toLowerCase()}`;
  const json = JSON.stringify(insight);
  memoryStore.set(key, json);
  try {
    await AsyncStorage.setItem(key, json);
  } catch {
    // Safe fallback if storage fails
  }
}
