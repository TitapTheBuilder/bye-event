"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

export interface ToastOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
  tone?: "default" | "danger";
}

interface Toast extends ToastOptions {
  id: string;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 6000;

/** Destructive-but-recoverable admin actions (deactivating an exhibitor or
 * visitor) use this instead of a blocking confirm(), same as the exhibitor
 * app. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (options: ToastOptions) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { ...options, id }]);
      const timer = setTimeout(() => dismiss(id), options.durationMs ?? DEFAULT_DURATION_MS);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex w-full max-w-sm items-center justify-between gap-3 rounded-xl border px-4 py-3 shadow-lg ${
              toast.tone === "danger"
                ? "border-danger/40 bg-surface-2"
                : "border-border-subtle bg-surface-2"
            }`}
          >
            <span className="text-sm text-text-primary">{toast.message}</span>
            {toast.actionLabel && toast.onAction ? (
              <button
                type="button"
                onClick={() => {
                  toast.onAction?.();
                  dismiss(toast.id);
                }}
                className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-brand-accent hover:bg-surface-3"
              >
                {toast.actionLabel}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
