"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/client/auth-context";

const NAV_SECTIONS = [
  {
    title: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard" }],
  },
  {
    title: "People",
    items: [
      { href: "/visitors", label: "Visitors" },
      { href: "/guests", label: "Guests" },
      { href: "/exhibitors", label: "Exhibitors" },
      { href: "/admins", label: "Admin accounts" },
    ],
  },
  {
    title: "Event",
    items: [
      { href: "/badges", label: "Badges" },
      { href: "/export", label: "Data export" },
      { href: "/branding", label: "Branding" },
    ],
  },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { admin, logout } = useAuth();

  return (
    <aside className="flex h-dvh w-64 flex-col border-r border-border-subtle bg-surface-1 px-4 py-6">
      <div className="mb-6 px-2">
        <p className="text-sm font-semibold text-text-primary">Event Admin</p>
        <p className="text-xs text-text-muted">University of Tehran platform</p>
      </div>

      <nav className="flex-1 space-y-6">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              {section.title}
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
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {admin ? (
        <div className="mt-6 border-t border-border-subtle pt-4">
          <p className="truncate px-2 text-sm text-text-primary">{admin.name}</p>
          <p className="truncate px-2 text-xs text-text-muted">{admin.email}</p>
          <button
            type="button"
            onClick={() => void logout().then(() => window.location.assign("/login"))}
            className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-surface-2"
          >
            Log out
          </button>
        </div>
      ) : null}
    </aside>
  );
}
