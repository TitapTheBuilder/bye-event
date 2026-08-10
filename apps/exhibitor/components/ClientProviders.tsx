"use client";

import { AuthProvider } from "@/lib/client/auth-context";
import { LanguageProvider } from "@/lib/client/language-context";
import { ToastProvider } from "@/lib/client/toast";
import { ThemeProvider } from "next-themes";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <LanguageProvider>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
