"use client";

import { useLanguage } from "@/lib/client/language-context";

/**
 * Compact language-switch button rendered in the sidebar.
 * Toggles between English and فارسی on every click.
 */
export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLanguage();

  return (
    <button
      type="button"
      onClick={() => setLang(lang === "en" ? "fa" : "en")}
      className={`flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-3 ${className}`}
      aria-label={lang === "en" ? "Switch to Persian" : "Switch to English"}
    >
      <span>🌐</span>
      <span>{lang === "en" ? "فارسی" : "English"}</span>
    </button>
  );
}
