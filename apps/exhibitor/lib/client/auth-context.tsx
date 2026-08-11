"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { clearScannerDataAfterLogout } from "@/lib/offline/idb";
import { registerSyncTriggers, syncEngine } from "@/lib/offline/sync-engine";

export interface ExhibitorProfile {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  phoneNumber: string;
}

interface AuthContextValue {
  exhibitor: ExhibitorProfile | null;
  /** True until the initial /api/auth/me check resolves. */
  isLoading: boolean;
  login: (
    username: string,
    password: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  signup: (input: {
    firstName: string;
    lastName: string;
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
    syncEngine.setAuthenticated(null);
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = (await res.json()) as { exhibitor: ExhibitorProfile | null };
        if (cancelled) return;
        setExhibitor(data.exhibitor);
        // Ownership and sync authorization are tied to the concrete account,
        // not a process-wide authenticated boolean.
        syncEngine.setAuthenticated(data.exhibitor?.id ?? null);
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
    // Claim and flush unowned entries plus entries already owned by this account.
    syncEngine.setAuthenticated(data.exhibitor.id);
    return { ok: true as const };
  }, []);

  const signup = useCallback(
    async (input: {
      firstName: string;
      lastName: string;
      username: string;
      phoneNumber: string;
      password: string;
    }) => {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false as const, error: data.error ?? "Sign up failed" };
      setExhibitor(data.exhibitor);
      syncEngine.setAuthenticated(data.exhibitor.id);
      return { ok: true as const };
    },
    [],
  );

  const logout = useCallback(async () => {
    // Give pending scans one final chance while the session still exists.
    // Any entries that remain unsynced are preserved for a later retry.
    await syncEngine.flush();
    syncEngine.setAuthenticated(null);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      await clearScannerDataAfterLogout();
      setExhibitor(null);
    }
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
