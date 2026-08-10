"use client";

import {
  FormField,
  buttonPrimaryClassName,
  buttonSecondaryClassName,
  inputClassName,
} from "@/components/FormField";
import { Modal } from "@/components/Modal";
import { useAuth } from "@/lib/client/auth-context";
import { useTranslation } from "@/lib/client/language-context";
import { useCallback, useEffect, useState } from "react";

interface AdminRow {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

function AddAdminForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not create admin");
        return;
      }
      await onCreated();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField label={t("admins.name")}>
        <input
          className={inputClassName}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </FormField>
      <FormField label={t("admins.email")}>
        <input
          type="email"
          className={inputClassName}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </FormField>
      <FormField label={t("admins.password")} hint="At least 8 characters.">
        <input
          type="password"
          className={inputClassName}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
      </FormField>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={buttonSecondaryClassName}>
          {t("form.cancel")}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className={buttonPrimaryClassName}
          style={{ background: "var(--brand-gradient)" }}
        >
          {isSubmitting ? t("admins.saving") : t("admins.addAdmin")}
        </button>
      </div>
    </form>
  );
}

export default function AdminsPage() {
  const { t, dir } = useTranslation();
  const { admin: currentAdmin } = useAuth();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admins");
      if (!res.ok) return;
      const data = await res.json();
      setAdmins(data.admins);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleteError(null);
    const res = await fetch(`/api/admins/${pendingDelete.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setDeleteError(data.error ?? "Could not delete admin");
      return;
    }
    setPendingDelete(null);
    await refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{t("admins.title")}</h1>
          <p className="text-sm text-text-secondary">
            {t("admins.subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className={buttonPrimaryClassName}
          style={{ background: "var(--brand-gradient)" }}
        >
          {t("admins.addAdmin")}
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface-1">
        <table className={`w-full min-w-[560px] text-sm text-${dir === "rtl" ? "end" : "start"}`}>
          <thead className="border-b border-border-subtle text-text-secondary">
            <tr>
              <th className="px-4 py-3">{t("admins.name")}</th>
              <th className="px-4 py-3">{t("admins.email")}</th>
              <th className="px-4 py-3">{t("admins.created")}</th>
              <th className={`px-4 py-3 text-${dir === "rtl" ? "start" : "end"}`}>{t("admins.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text-secondary">
                  {t("common.loading")}
                </td>
              </tr>
            ) : (
              admins.map((admin) => (
                <tr key={admin.id} className="border-b border-border-subtle last:border-0">
                  <td className="px-4 py-3 text-text-primary">
                    {admin.name}
                    {admin.id === currentAdmin?.id ? (
                      <span className="ml-2 text-xs text-text-muted">(you)</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{admin.email}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {new Date(admin.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={admin.id === currentAdmin?.id || admins.length <= 1}
                        onClick={() => setPendingDelete(admin)}
                        className="rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {t("admins.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCreate ? (
        <Modal title={t("admins.addTitle")} onClose={() => setShowCreate(false)}>
          <AddAdminForm
            onCancel={() => setShowCreate(false)}
            onCreated={async () => {
              setShowCreate(false);
              await refresh();
            }}
          />
        </Modal>
      ) : null}

      {pendingDelete ? (
        <Modal title={t("admins.delete")} onClose={() => setPendingDelete(null)}>
          <p className="text-sm text-text-secondary">
            This permanently deletes <span className="text-text-primary">{pendingDelete.name}</span>
            's admin account. This cannot be undone.
          </p>
          {deleteError ? <p className="mt-3 text-sm text-danger">{deleteError}</p> : null}
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingDelete(null)}
              className={buttonSecondaryClassName}
            >
              {t("form.cancel")}
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white"
            >
              {t("admins.delete")}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
