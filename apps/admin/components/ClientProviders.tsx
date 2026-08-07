"use client";

import { AuthProvider } from "@/lib/client/auth-context";
import { ToastProvider } from "@/lib/client/toast";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>{children}</ToastProvider>
    </AuthProvider>
  );
}
