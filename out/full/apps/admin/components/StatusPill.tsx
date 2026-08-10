"use client";

import { useTranslation } from "@/lib/client/language-context";

export function StatusPill({ active }: { active: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        active ? "bg-success/15 text-success" : "bg-surface-3 text-text-muted"
      }`}
    >
      {active ? t("common.active") : t("common.deactivated")}
    </span>
  );
}

export function VisitorTypeBadge({ visitorType }: { visitorType: "invited" | "guest" }) {
  const { t } = useTranslation();
  const isInvited = visitorType === "invited";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        isInvited ? "bg-brand-primary/20 text-brand-accent" : "bg-surface-3 text-text-secondary"
      }`}
    >
      {isInvited ? t("common.invited") : t("common.guest")}
    </span>
  );
}
