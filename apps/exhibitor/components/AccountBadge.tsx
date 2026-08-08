"use client";

import Link from "next/link";
import { useAuth } from "@/lib/client/auth-context";
import { useTranslation } from "@/lib/client/language-context";

export function AccountBadge() {
  const { exhibitor, isLoading } = useAuth();
  const { t } = useTranslation();

  if (isLoading) {
    return <div className="h-9 w-9 animate-pulse rounded-full bg-surface-2" aria-hidden />;
  }

  if (!exhibitor) {
    return (
      <Link
        href="/login"
        className="flex items-center rounded-full bg-surface-2 px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-3"
      >
        {t("account.signIn")}
      </Link>
    );
  }

  const initials = exhibitor.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Link
      href="/profile"
      aria-label={`Profile: ${exhibitor.name}`}
      className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white"
      style={{ background: "var(--brand-gradient)" }}
    >
      {initials}
    </Link>
  );
}
