"use client";

import { formatPersonName, getPersonInitials } from "@repo/shared/person-name";
import { useRouter } from "next/navigation";
import { SyncStatusChip } from "@/components/SyncStatusChip";
import { useAuth } from "@/lib/client/auth-context";
import { useTranslation } from "@/lib/client/language-context";
import { useSyncStatus } from "@/lib/client/use-sync-status";

export default function ProfilePage() {
  const { exhibitor, isLoading, logout } = useAuth();
  const { pendingCount } = useSyncStatus();
  const { t } = useTranslation();
  const router = useRouter();

  if (isLoading) {
    return <p className="px-6 py-8 text-sm text-text-secondary">{t("common.loading")}</p>;
  }

  if (!exhibitor) {
    router.replace("/login?next=/profile");
    return null;
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <div className="flex items-center gap-4">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold text-white"
          style={{ background: "var(--brand-gradient)" }}
        >
          {getPersonInitials(exhibitor.firstName, exhibitor.lastName)}
        </div>
        <div>
          <h1 className="text-lg font-semibold text-text-primary">
            {formatPersonName(exhibitor.firstName, exhibitor.lastName)}
          </h1>
          <p className="text-sm text-text-secondary">@{exhibitor.username}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
        <dl className="grid grid-cols-1 gap-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-text-secondary">{t("profile.phone")}</dt>
            <dd className="text-text-primary">{exhibitor.phoneNumber}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-secondary">{t("profile.syncStatus")}</dt>
            <dd>
              <SyncStatusChip />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-secondary">{t("profile.pendingScans")}</dt>
            <dd className="text-text-primary">{t("profile.pending", { count: pendingCount })}</dd>
          </div>
        </dl>
      </div>

      <button
        type="button"
        onClick={() => void logout().then(() => router.push("/"))}
        className="rounded-xl border border-border-subtle py-3 font-medium text-danger"
      >
        {t("profile.logout")}
      </button>
    </div>
  );
}
