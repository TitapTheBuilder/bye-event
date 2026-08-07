"use client";

import { FormField, inputClassName } from "@/components/FormField";
import { useAuth } from "@/lib/client/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await login(email, password);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(searchParams.get("next") ?? "/dashboard");
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="text-xl font-semibold text-text-primary">Event Admin</h1>
      <p className="mt-1 text-sm text-text-secondary">Sign in to manage this event.</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <FormField label="Email">
          <input
            type="email"
            className={inputClassName}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </FormField>
        <FormField label="Password">
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
          className="mt-2 rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--brand-gradient)" }}
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
