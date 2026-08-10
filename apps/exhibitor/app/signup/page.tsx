"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormField, inputClassName } from "@/components/FormField";
import { useAuth } from "@/lib/client/auth-context";
import { useTranslation } from "@/lib/client/language-context";

export default function SignupPage() {
  const { signup } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    phoneNumber: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await signup(form);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/");
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">{t("signup.title")}</h1>
        <p className="mt-1 text-sm text-text-secondary">{t("signup.subtitle")}</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t("signup.firstName")}>
            <input
              className={inputClassName}
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              autoComplete="given-name"
              required
            />
          </FormField>
          <FormField label={t("signup.lastName")}>
            <input
              className={inputClassName}
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              autoComplete="family-name"
              required
            />
          </FormField>
        </div>
        <FormField label={t("signup.username")}>
          <input
            className={inputClassName}
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            autoComplete="username"
            required
          />
        </FormField>
        <FormField label={t("signup.phone")}>
          <input
            type="tel"
            className={inputClassName}
            value={form.phoneNumber}
            onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
            autoComplete="tel"
            required
          />
        </FormField>
        <FormField label={t("signup.password")}>
          <input
            type="password"
            className={inputClassName}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </FormField>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 rounded-xl py-3 font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--brand-gradient)" }}
        >
          {isSubmitting ? t("signup.submitting") : t("signup.submit")}
        </button>
      </form>

      <p className="text-center text-sm text-text-secondary">
        {t("signup.hasAccount")}{" "}
        <Link href="/login" className="font-medium text-brand-accent">
          {t("signup.signIn")}
        </Link>
      </p>
    </div>
  );
}
