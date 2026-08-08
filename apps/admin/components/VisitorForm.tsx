"use client";

import { FormField, buttonPrimaryClassName, buttonSecondaryClassName, inputClassName } from "@/components/FormField";
import { useTranslation } from "@/lib/client/language-context";
import { useState } from "react";

export interface VisitorFormValues {
  name: string;
  company: string;
  phoneNumber: string;
  email: string;
  visitorType: "invited" | "guest";
}

const EMPTY_VALUES: VisitorFormValues = {
  name: "",
  company: "",
  phoneNumber: "",
  email: "",
  visitorType: "invited",
};

export function VisitorForm({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel = "Save",
  showVisitorType = true,
}: {
  initialValues?: Partial<VisitorFormValues>;
  onSubmit: (values: VisitorFormValues) => Promise<{ ok: true } | { ok: false; error: string }>;
  onCancel: () => void;
  submitLabel?: string;
  showVisitorType?: boolean;
}) {
  const { t } = useTranslation();
  const [values, setValues] = useState<VisitorFormValues>({ ...EMPTY_VALUES, ...initialValues });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await onSubmit(values);
    setIsSubmitting(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField label={t("form.name")}>
        <input
          className={inputClassName}
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          placeholder="Jane Doe"
        />
      </FormField>
      <FormField label={t("form.company")}>
        <input
          className={inputClassName}
          value={values.company}
          onChange={(e) => setValues((v) => ({ ...v, company: e.target.value }))}
          placeholder="Acme Inc."
        />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label={t("form.phone")}>
          <input
            className={inputClassName}
            value={values.phoneNumber}
            onChange={(e) => setValues((v) => ({ ...v, phoneNumber: e.target.value }))}
            placeholder="+1 555 000 0000"
          />
        </FormField>
        <FormField label={t("form.email")}>
          <input
            type="email"
            className={inputClassName}
            value={values.email}
            onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
            placeholder="jane@acme.com"
          />
        </FormField>
      </div>
      {showVisitorType ? (
        <FormField label={t("form.visitorType")}>
          <select
            className={inputClassName}
            value={values.visitorType}
            onChange={(e) =>
              setValues((v) => ({ ...v, visitorType: e.target.value as "invited" | "guest" }))
            }
          >
            <option value="invited">{t("common.invited")}</option>
            <option value="guest">{t("common.guest")}</option>
          </select>
        </FormField>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={buttonSecondaryClassName}>
          {t("form.cancel")}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className={buttonPrimaryClassName}
          style={{ background: "var(--brand-gradient)" }}
        >
          {isSubmitting ? t("form.saving") : submitLabel}
        </button>
      </div>
    </form>
  );
}
