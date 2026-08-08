"use client";

import { FormField, inputClassName } from "@/components/FormField";
import { useAuth } from "@/lib/client/auth-context";
import { useTranslation } from "@/lib/client/language-context";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await login(username, password);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(searchParams.get("next") ?? "/");
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">{t("login.title")}</h1>
        <p className="mt-1 text-sm text-text-secondary">
          {t("login.subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label={t("login.username")}>
          <input
            className={inputClassName}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </FormField>
        <FormField label={t("login.password")}>
          <input
            type="password"
            className={inputClassName}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
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
          {isSubmitting ? t("login.submitting") : t("login.submit")}
        </button>
      </form>

      <p className="text-center text-sm text-text-secondary">
        {t("login.noAccount")}{" "}
        <Link href="/signup" className="font-medium text-brand-accent">
          {t("login.createAccount")}
        </Link>
      </p>
    </div>
  );
}
