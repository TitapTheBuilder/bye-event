"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/client/language-context";
import type { TranslationKey } from "@/lib/i18n/translations";

const ITEMS: { href: string; labelKey: TranslationKey }[] = [
  { href: "/", labelKey: "nav.home" },
  { href: "/scan", labelKey: "nav.scan" },
  { href: "/scanned", labelKey: "nav.scanned" },
  { href: "/profile", labelKey: "nav.profile" },
];

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-surface-0/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {ITEMS.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium ${
                isActive ? "text-brand-accent" : "text-text-secondary"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <NavIcon item={item.href} active={isActive} />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function NavIcon({ item, active }: { item: string; active: boolean }) {
  const stroke = active ? "var(--brand-accent)" : "currentColor";
  switch (item) {
    case "/":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 11.5 12 4l8 7.5M6 10v9h12v-9"
            stroke={stroke}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "/scan":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 8V5a1 1 0 0 1 1-1h3M20 8V5a1 1 0 0 0-1-1h-3M4 16v3a1 1 0 0 0 1 1h3M20 16v3a1 1 0 0 1-1 1h-3M4 12h16"
            stroke={stroke}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "/scanned":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 6h16M4 12h16M4 18h10"
            stroke={stroke}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "/profile":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="8" r="3.2" stroke={stroke} strokeWidth="1.8" />
          <path
            d="M5 20c1.2-3.5 4-5.2 7-5.2s5.8 1.7 7 5.2"
            stroke={stroke}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return null;
  }
}
