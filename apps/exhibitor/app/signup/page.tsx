"use client";

import { FormField, inputClassName } from "@/components/FormField";
import { useAuth } from "@/lib/client/auth-context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", username: "", phoneNumber: "", password: "" });
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
        <h1 className="text-xl font-semibold text-text-primary">Create your account</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Any scans you&apos;ve already made on this device will save automatically once you sign
          up.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Full name">
          <input
            className={inputClassName}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            autoComplete="name"
            required
          />
        </FormField>
        <FormField label="Username">
          <input
            className={inputClassName}
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            autoComplete="username"
            required
          />
        </FormField>
        <FormField label="Phone number">
          <input
            type="tel"
            className={inputClassName}
            value={form.phoneNumber}
            onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
            autoComplete="tel"
            required
          />
        </FormField>
        <FormField label="Password">
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
          {isSubmitting ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="text-center text-sm text-text-secondary">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-accent">
          Sign in
        </Link>
      </p>
    </div>
  );
}
