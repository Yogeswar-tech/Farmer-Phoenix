import AsyncStorage from "@react-native-async-storage/async-storage";

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
} as const;

export async function getLanguage(): Promise<SupportedLanguage | null> {
  try {
    const val = await AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE);
    if (val === "en" || val === "hi" || val === "te" || val === "mr") {
      return val;
    }
    return null;
  } catch {
    return null;
  }
}

export async function setLanguage(lang: SupportedLanguage): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
  } catch {
    // Safe fallback if storage fails
  }
}

export async function getRegionId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.REGION_ID);
  } catch {
    return null;
  }
}

export async function setRegionId(regionId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.REGION_ID, regionId);
  } catch {
    // Safe fallback if storage fails
  }
}

export async function getConsent(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(STORAGE_KEYS.CONSENT);
    return val === "true";
  } catch {
    return false;
  }
}

export async function setConsent(consent: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.CONSENT, consent ? "true" : "false");
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
