"use client";

import { FormField, inputClassName } from "@/components/FormField";
import { useAuth } from "@/lib/client/auth-context";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const { login } = useAuth();
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
        <h1 className="text-xl font-semibold text-text-primary">Sign in</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Scanning works without signing in -- sign in to save your scans to the event.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Username">
          <input
            className={inputClassName}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
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
          className="mt-2 rounded-xl py-3 font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--brand-gradient)" }}
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="text-center text-sm text-text-secondary">
        New exhibitor?{" "}
        <Link href="/signup" className="font-medium text-brand-accent">
          Create an account
        </Link>
      </p>
    </div>
  );
}
