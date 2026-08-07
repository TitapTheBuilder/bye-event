"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { registerSyncTriggers, syncEngine } from "@/lib/offline/sync-engine";

export interface ExhibitorProfile {
  id: string;
  name: string;
  username: string;
  phoneNumber: string;
}

interface AuthContextValue {
  exhibitor: ExhibitorProfile | null;
  /** True until the initial /api/auth/me check resolves. */
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  signup: (input: {
    name: string;
    username: string;
    phoneNumber: string;
    password: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [exhibitor, setExhibitor] = useState<ExhibitorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = (await res.json()) as { exhibitor: ExhibitorProfile | null };
        if (cancelled) return;
        setExhibitor(data.exhibitor);
        // On load, tell the sync engine whether we're authenticated so it
        // knows whether it's allowed to flush anything it finds queued.
        syncEngine.setAuthenticated(Boolean(data.exhibitor));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => registerSyncTriggers(), []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false as const, error: data.error ?? "Login failed" };
    setExhibitor(data.exhibitor);
    // Immediately flush the entire outbox, including everything
    // accumulated before this account existed on this device.
    syncEngine.setAuthenticated(true);
    return { ok: true as const };
  }, []);

  const signup = useCallback(
    async (input: { name: string; username: string; phoneNumber: string; password: string }) => {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false as const, error: data.error ?? "Sign up failed" };
      setExhibitor(data.exhibitor);
      syncEngine.setAuthenticated(true);
      return { ok: true as const };
    },
    [],
  );

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setExhibitor(null);
    syncEngine.setAuthenticated(false);
  }, []);

  const value = useMemo(
    () => ({ exhibitor, isLoading, login, signup, logout }),
    [exhibitor, isLoading, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
