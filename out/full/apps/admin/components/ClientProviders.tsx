"use client";

import { AuthProvider } from "@/lib/client/auth-context";
import { LanguageProvider } from "@/lib/client/language-context";
import { ToastProvider } from "@/lib/client/toast";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <AuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
