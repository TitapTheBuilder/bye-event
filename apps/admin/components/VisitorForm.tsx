"use client";

import { useState } from "react";
import {
  buttonPrimaryClassName,
  buttonSecondaryClassName,
  FormField,
  inputClassName,
} from "@/components/FormField";
import { useTranslation } from "@/lib/client/language-context";

export interface VisitorFormValues {
  firstName: string;
  lastName: string;
  company: string;
  phoneNumber: string;
  email: string;
  color: string;
  visitorType: "invited" | "guest";
}

const EMPTY_VALUES: VisitorFormValues = {
  firstName: "",
  lastName: "",
  company: "",
  phoneNumber: "",
  email: "",
  color: "",
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
      <div className="grid grid-cols-2 gap-4">
        <FormField label={t("form.firstName")}>
          <input
            className={inputClassName}
            value={values.firstName}
            onChange={(e) => setValues((v) => ({ ...v, firstName: e.target.value }))}
            placeholder="Jane"
            autoComplete="given-name"
          />
        </FormField>
        <FormField label={t("form.lastName")}>
          <input
            className={inputClassName}
            value={values.lastName}
            onChange={(e) => setValues((v) => ({ ...v, lastName: e.target.value }))}
            placeholder="Doe"
            autoComplete="family-name"
          />
        </FormField>
      </div>
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
      <FormField label={t("form.color")}>
        <input
          className={inputClassName}
          value={values.color}
          onChange={(e) => setValues((v) => ({ ...v, color: e.target.value }))}
          placeholder="yellow"
        />
      </FormField>
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
