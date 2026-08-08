"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/client/auth-context";
import { useTranslation } from "@/lib/client/language-context";
import { LanguageToggle } from "./LanguageToggle";
import type { TranslationKey } from "@/lib/i18n/translations";

const NAV_SECTIONS: {
  titleKey: TranslationKey;
  items: { href: string; labelKey: TranslationKey }[];
}[] = [
  {
    titleKey: "sidebar.dashboard",
    items: [{ href: "/dashboard", labelKey: "sidebar.dashboard" }],
  },
  {
    titleKey: "visitors.title",
    items: [
      { href: "/visitors", labelKey: "sidebar.visitors" },
      { href: "/guests", labelKey: "sidebar.guests" },
      { href: "/exhibitors", labelKey: "sidebar.exhibitors" },
      { href: "/admins", labelKey: "sidebar.admins" },
    ],
  },
  {
    titleKey: "badges.title",
    items: [
      { href: "/badges", labelKey: "sidebar.badges" },
      { href: "/export", labelKey: "sidebar.export" },
      { href: "/branding", labelKey: "sidebar.branding" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { admin, logout } = useAuth();
  const { t } = useTranslation();

  return (
    <aside className="flex h-dvh w-64 flex-col border-r border-border-subtle bg-surface-1 px-4 py-6 rtl:border-r-0 rtl:border-l">
      <div className="mb-6 px-2">
        <p className="text-sm font-semibold text-text-primary">{t("login.title")}</p>
        <p className="text-xs text-text-muted">University of Tehran platform</p>
      </div>

      <nav className="flex-1 space-y-6">
        {NAV_SECTIONS.map((section) => (
          <div key={section.titleKey}>
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t(section.titleKey)}
            </p>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                        isActive
                          ? "bg-surface-3 text-brand-accent"
                          : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                      }`}
                    >
                      {t(item.labelKey)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-4">
        <LanguageToggle className="w-full justify-center" />
      </div>

      {admin ? (
        <div className="mt-4 border-t border-border-subtle pt-4">
          <p className="truncate px-2 text-sm text-text-primary">{admin.name}</p>
          <p className="truncate px-2 text-xs text-text-muted">{admin.email}</p>
          <button
            type="button"
            onClick={() => void logout().then(() => window.location.assign("/login"))}
            className="mt-2 w-full rounded-lg px-3 py-2 text-start text-sm text-danger hover:bg-surface-2"
          >
            {t("sidebar.logout")}
          </button>
        </div>
      ) : null}
    </aside>
  );
}
