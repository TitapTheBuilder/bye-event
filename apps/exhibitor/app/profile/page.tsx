"use client";

import { SyncStatusChip } from "@/components/SyncStatusChip";
import { useAuth } from "@/lib/client/auth-context";
import { useSyncStatus } from "@/lib/client/use-sync-status";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const { exhibitor, isLoading, logout } = useAuth();
  const { pendingCount } = useSyncStatus();
  const router = useRouter();

  if (isLoading) {
    return <p className="px-6 py-8 text-sm text-text-secondary">Loading…</p>;
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
          {exhibitor.name
            .split(" ")
            .map((p) => p[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </div>
        <div>
          <h1 className="text-lg font-semibold text-text-primary">{exhibitor.name}</h1>
          <p className="text-sm text-text-secondary">@{exhibitor.username}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
        <dl className="grid grid-cols-1 gap-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-text-secondary">Phone</dt>
            <dd className="text-text-primary">{exhibitor.phoneNumber}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-secondary">Sync status</dt>
            <dd>
              <SyncStatusChip />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-secondary">Pending scans</dt>
            <dd className="text-text-primary">{pendingCount} pending</dd>
          </div>
        </dl>
      </div>

      <button
        type="button"
        onClick={() => void logout().then(() => router.push("/"))}
        className="rounded-xl border border-border-subtle py-3 font-medium text-danger"
      >
        Log out
      </button>
    </div>
  );
}
