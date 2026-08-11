"use client";

import { FormField, buttonPrimaryClassName, inputClassName } from "@/components/FormField";
import { useTranslation } from "@/lib/client/language-context";
import type { EventSettings } from "@repo/db";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

/**
 * White-label branding (§7/§8): logo upload (auto-extracts 2-3 brand
 * colors), manually overridable via color pickers, business name -- all
 * written to event_settings, which both apps read at render time. A
 * change here takes effect without a redeploy.
 */
export default function BrandingPage() {
  const { t, lang } = useTranslation();
  const [settings, setSettings] = useState<EventSettings | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#6366f1");
  const [secondaryColor, setSecondaryColor] = useState("#8b5cf6");
  const [accentColor, setAccentColor] = useState("#22d3ee");
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applySettings = useCallback((s: EventSettings) => {
    setSettings(s);
    setBusinessName(s.businessName ?? "");
    if (s.primaryColor && HEX_PATTERN.test(s.primaryColor)) setPrimaryColor(s.primaryColor);
    if (s.secondaryColor && HEX_PATTERN.test(s.secondaryColor)) setSecondaryColor(s.secondaryColor);
    if (s.accentColor && HEX_PATTERN.test(s.accentColor)) setAccentColor(s.accentColor);
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/branding");
      if (!res.ok) return;
      const data = await res.json();
      applySettings(data.settings);
    })();
  }, [applySettings]);

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setMessage(null);
    setIsUploading(true);

    const formData = new FormData();
    formData.append("logo", file);

    try {
      const res = await fetch("/api/branding/logo", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not upload logo");
        return;
      }
      applySettings(data.settings);
      setMessage(
        data.colorsExtracted
          ? t("branding.logoUploaded")
          : t("branding.logoUploadedNoColors"),
      );
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsSaving(true);
    try {
      const res = await fetch("/api/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, primaryColor, secondaryColor, accentColor }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save branding");
        return;
      }
      applySettings(data.settings);
      setMessage(t("branding.saved"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">{t("branding.title")}</h1>
        <p className="text-sm text-text-secondary">
          {t("branding.subtitle")}
        </p>
      </div>

      <div className="flex items-center gap-6 rounded-2xl border border-border-subtle bg-surface-1 p-5">
        <div className="flex h-20 w-32 items-center justify-center rounded-xl border border-dashed border-border-subtle bg-surface-2">
          {settings?.logoUrl ? (
            <Image
              src={settings.logoUrl}
              alt={businessName || "Event logo"}
              width={112}
              height={64}
              className="h-16 w-auto object-contain"
              unoptimized
            />
          ) : (
            <span className="text-xs text-text-muted">{t("branding.noLogo")}</span>
          )}
        </div>
        <div>
          <label className="inline-block cursor-pointer rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-2">
            {isUploading ? t("branding.uploading") : t("branding.uploadLogo")}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleLogoChange}
              disabled={isUploading}
              className="hidden"
            />
          </label>
          <p className="mt-2 text-xs text-text-muted">
            {lang === "fa"
              ? "PNG، JPEG یا WebP. حداکثر ۵ مگابایت."
              : "PNG, JPEG, or WebP. Max 5MB."}
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-5 rounded-2xl border border-border-subtle bg-surface-1 p-5">
        <FormField label={t("branding.businessName")}>
          <input
            className={inputClassName}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Acme Events Co."
          />
        </FormField>

        <div className="grid grid-cols-3 gap-4">
          <FormField label={t("branding.primary")}>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-10 w-10 rounded border border-border-subtle bg-transparent p-0"
              />
              <span className="text-xs text-text-muted">{primaryColor}</span>
            </div>
          </FormField>
          <FormField label={t("branding.secondary")}>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="h-10 w-10 rounded border border-border-subtle bg-transparent p-0"
              />
              <span className="text-xs text-text-muted">{secondaryColor}</span>
            </div>
          </FormField>
          <FormField label={t("branding.accent")}>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-10 w-10 rounded border border-border-subtle bg-transparent p-0"
              />
              <span className="text-xs text-text-muted">{accentColor}</span>
            </div>
          </FormField>
        </div>

        <div
          className="h-12 rounded-xl"
          style={{
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 55%, ${accentColor} 100%)`,
          }}
        />

        {message ? <p className="text-sm text-success">{message}</p> : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <button
          type="submit"
          disabled={isSaving}
          className={`w-fit ${buttonPrimaryClassName}`}
          style={{ background: "var(--brand-gradient)" }}
        >
          {isSaving ? t("branding.saving") : t("branding.save")}
        </button>
      </form>
    </div>
  );
}
