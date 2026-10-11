import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import hi from "./hi.json";
import te from "./te.json";
import mr from "./mr.json";
import { getLanguage, SupportedLanguage } from "@/lib/storage";

export interface LanguageOption {
  code: SupportedLanguage;
  name: string;
}

export type SupportedLanguageCode = SupportedLanguage;


// Language names defined once and displayed in their own script
export const SUPPORTED_LANGUAGES: readonly LanguageOption[] = [
  { code: "en", name: "English" },
  { code: "hi", name: "हिन्दी" },
  { code: "te", name: "తెలుగు" },
  { code: "mr", name: "मराठी" },
] as const;

export const resources = {
  en: { translation: en },
  hi: { translation: hi },
  te: { translation: te },
  mr: { translation: mr },
} as const;

export async function initI18n(): Promise<void> {
  const savedLang = await getLanguage();
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      compatibilityJSON: "v4",
      lng: savedLang ?? "en",
      fallbackLng: "en",
      resources,
      interpolation: {
        escapeValue: false,
      },
    });
  } else if (savedLang && i18n.language !== savedLang) {
    await i18n.changeLanguage(savedLang);
  }
}

export default i18n;
