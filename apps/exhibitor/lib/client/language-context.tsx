"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { en, fa, type TranslationKey } from "@/lib/i18n/translations";

export type Language = "en" | "fa";

interface LanguageContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  dir: "ltr" | "rtl";
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = "exhibition-lang";

const dictionaries = { en, fa } as const;

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Keep the server and first client render identical. Reading localStorage
  // in the state initializer causes hydration mismatches on devices that
  // previously selected Persian, which can leave top-bar controls inert.
  const [lang, setLangState] = useState<Language>("en");
  const [storageLoaded, setStorageLoaded] = useState(false);

  const dir: "ltr" | "rtl" = lang === "fa" ? "rtl" : "ltr";

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "fa" || stored === "en") setLangState(stored);
    } catch {
      // Storage may be blocked in private/restricted browser modes. Language
      // switching must still work for the current session.
    } finally {
      setStorageLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!storageLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Keep the in-memory language even when persistence is unavailable.
    }
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [lang, dir, storageLoaded]);

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      let text = dictionaries[lang][key] ?? dictionaries.en[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(`{${k}}`, String(v));
        }
      }
      return text;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t, dir }), [lang, setLang, t, dir]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

/** Shortcut — most components only need the `t` function. */
export function useTranslation() {
  const { t, lang, dir } = useLanguage();
  return { t, lang, dir };
}
