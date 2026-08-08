import { ClientProviders } from "@/components/ClientProviders";
import { db, getEventSettings } from "@repo/db";
import { PLATFORM_CREDIT } from "@repo/shared/constants";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Vazirmatn } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const vazirmatn = Vazirmatn({ variable: "--font-vazirmatn", subsets: ["arabic"] });

export const metadata: Metadata = {
  title: "Event Admin",
  description: `Exhibition event administration panel. Built by ${PLATFORM_CREDIT}.`,
};

export const viewport: Viewport = {
  themeColor: "#08080c",
};

// event_settings is read at render time (not baked in at build time) so a
// new logo/colors uploaded here take effect immediately in both apps,
// with no redeploy -- this also means the DB doesn't need to be reachable
// during `next build`.
export const dynamic = "force-dynamic";

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function safeHex(value: string | null, fallback: string): string {
  return value && HEX_COLOR_PATTERN.test(value) ? value : fallback;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
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
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
