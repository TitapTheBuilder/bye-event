import { BottomNav } from "@/components/BottomNav";
import { ClientProviders } from "@/components/ClientProviders";
import { TopBar } from "@/components/TopBar";
import { db, getEventSettings } from "@repo/db";
import { PLATFORM_CREDIT } from "@repo/shared/constants";
import { SerwistProvider } from "@serwist/turbopack/react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Vazirmatn } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const vazirmatn = Vazirmatn({ variable: "--font-vazirmatn", subsets: ["arabic"] });

export const metadata: Metadata = {
  title: "Badge Scanner",
  description: `Exhibitor badge scanning app. Built by ${PLATFORM_CREDIT}.`,
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Scanner" },
};

export const viewport: Viewport = {
  themeColor: "#08080c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

// event_settings is read at render time (not baked in at build time) so a
// new logo/colors uploaded in admin take effect without a redeploy -- this
// also means the DB doesn't need to be reachable during `next build`.
export const dynamic = "force-dynamic";

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function safeHex(value: string | null, fallback: string): string {
  return value && HEX_COLOR_PATTERN.test(value) ? value : fallback;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Brand colors come from event_settings at RENDER TIME, not build time --
  // this is what lets a new deployment for a different customer "just
  // work" once an admin uploads a new logo, with zero code changes and no
  // redeploy. Re-validated as hex here too (defense in depth) since this
  // gets interpolated directly into an inline <style> tag.
  const settings = await getEventSettings(db);
  const primary = safeHex(settings.primaryColor, "#6366f1");
  const secondary = safeHex(settings.secondaryColor, "#8b5cf6");
  const accent = safeHex(settings.accentColor, "#22d3ee");

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${vazirmatn.variable}`}>
      <body className="min-h-dvh font-sans antialiased">
        <style>
          {`:root { --brand-primary: ${primary}; --brand-secondary: ${secondary}; --brand-accent: ${accent}; }`}
        </style>
        <SerwistProvider swUrl="/serwist/sw.js">
          <ClientProviders>
            <TopBar businessName={settings.businessName} logoUrl={settings.logoUrl} />
            <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-lg pb-20">{children}</main>
            <BottomNav />
          </ClientProviders>
        </SerwistProvider>
      </body>
    </html>
  );
}
