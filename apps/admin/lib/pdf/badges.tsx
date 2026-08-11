import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import {
  Document,
  Font,
  Image,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { EventSettings, Visitor } from "@repo/db";
import QRCode from "qrcode";
import sharp from "sharp";
import { getLocalUploadPathFromUrl } from "@/lib/uploads";

/**
 * Print-ready badge PDFs, per §7 of the build spec: two distinct templates
 * (Invited: name + company + QR; Guest: numbered Persian label + QR),
 * laid out multiple-per-page for standard badge stock, with cut
 * guides. QR generation is fully automatic here -- callers just pass
 * Visitor rows, never a separately-authored QR image.
 */

const PT_PER_IN = 72;
const PAGE_MARGIN = 0.4 * PT_PER_IN;
const BADGE_WIDTH = 3.5 * PT_PER_IN;
const BADGE_HEIGHT = 2.25 * PT_PER_IN;
const BADGE_GAP = 0.2 * PT_PER_IN;
const BADGES_PER_ROW = 2;
const ROWS_PER_PAGE = 4;
const BADGES_PER_PAGE = BADGES_PER_ROW * ROWS_PER_PAGE;
const PDF_FONT_FAMILY = "Noto Sans Arabic";
const ARABIC_SCRIPT_PATTERN = /\p{Script=Arabic}/u;

function resolvePublicFilePath(...segments: string[]): string | undefined {
  const candidates = [
    join(process.cwd(), "public", ...segments),
    join(process.cwd(), "apps", "admin", "public", ...segments),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

function resolveFontPath(filename: string): string {
  const fontPath = resolvePublicFilePath("fonts", filename);
  if (!fontPath) throw new Error(`Required badge PDF font is missing: ${filename}`);
  return fontPath;
}

function resolveBadgeAssetPath(filename: string): string {
  const assetPath = resolvePublicFilePath(filename);
  if (!assetPath) throw new Error(`Required badge PDF asset is missing: ${filename}`);
  return assetPath;
}

Font.register({
  family: PDF_FONT_FAMILY,
  fonts: [
    { src: resolveFontPath("NotoSansArabic-Regular.ttf"), fontWeight: 400 },
    { src: resolveFontPath("NotoSansArabic-Bold.ttf"), fontWeight: 700 },
  ],
});

const UT_LOGO_SOURCE = `data:image/svg+xml;base64,${readFileSync(
  resolveBadgeAssetPath("UT-Logo.svg"),
).toString("base64")}`;

async function embedLocalLogo(filePath: string): Promise<string> {
  const extension = extname(filePath).toLowerCase();
  if (extension === ".webp") {
    const png = await sharp(filePath).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  }

  const mimeType =
    extension === ".svg"
      ? "image/svg+xml"
      : extension === ".png"
        ? "image/png"
        : extension === ".jpg" || extension === ".jpeg"
          ? "image/jpeg"
          : null;
  if (!mimeType) throw new Error(`Unsupported badge logo format: ${extension}`);

  const image = await readFile(filePath);
  return `data:${mimeType};base64,${image.toString("base64")}`;
}

function containsArabicScript(value: string): boolean {
  return ARABIC_SCRIPT_PATTERN.test(value);
}

const styles = StyleSheet.create({
  page: {
    padding: PAGE_MARGIN,
    flexDirection: "row",
    flexWrap: "wrap",
    fontFamily: PDF_FONT_FAMILY,
  },
  badge: {
    width: BADGE_WIDTH,
    height: BADGE_HEIGHT,
    marginRight: BADGE_GAP,
    marginBottom: BADGE_GAP,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#999999",
    position: "relative", // <-- CRITICAL: Turns the badge into a fixed canvas, bypassing flexbox bugs
  },
  qr: {
    position: "absolute",
    left: 14,
    top: 39, // Vertically centered: (162 total height - 84 qr height) / 2 = 39
    width: 84,
    height: 84,
  },
  textColumn: {
    position: "absolute",
    right: 14, // Locks the column perfectly 14 pixels from the right border
    top: 54, // Starts nicely below the logos
    width: 125, // Hard brick wall: The text can NEVER exceed this width now
    flexDirection: "column",
  },
  companyText: {
    fontSize: 9,
    fontWeight: 400,
    color: "#555555",
    marginTop: 6,
    textAlign: "right",
  },
  prominentText: {
    fontSize: 12,
    fontWeight: 700,
    color: "#111111",
    textAlign: "right",
  },
  guestBadge: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 34,
  },
  rtlText: {
    direction: "rtl",
    textAlign: "right",
  },
  logoStrip: {
    position: "absolute",
    top: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandingLogo: {
    width: 32,
    height: 28,
    objectFit: "contain",
  },
  universityLogo: {
    width: 28,
    height: 28,
    objectFit: "contain",
  },
  qrLarge: {
    width: 92,
    height: 92,
  },
  guestLabel: {
    direction: "rtl",
    textAlign: "right",
    marginBottom: 16,
  },
});

async function makeQrDataUrl(qrToken: string): Promise<string> {
  return QRCode.toDataURL(qrToken, { margin: 1, width: 300, errorCorrectionLevel: "M" });
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

interface BadgeDocumentProps {
  visitors: Visitor[];
  qrDataUrls: Map<string, string>;
  logoSource: string | undefined;
  businessName: string | null;
}

function BadgeLogos({ logoSource }: Pick<BadgeDocumentProps, "logoSource">) {
  return (
    <View style={styles.logoStrip}>
      {logoSource ? <Image src={logoSource} style={styles.brandingLogo} /> : null}
      <Image src={UT_LOGO_SOURCE} style={styles.universityLogo} />
    </View>
  );
}

export function formatGuestBadgeLabel(index: number): string {
  return `مهمان ${new Intl.NumberFormat("fa-IR", { useGrouping: false }).format(index + 1)}`;
}

function InvitedBadgesDocument({
  visitors,
  qrDataUrls,
  logoSource,
  businessName,
}: BadgeDocumentProps) {
  const pages = chunk(visitors, BADGES_PER_PAGE);
  return (
    <Document title={`${businessName ?? "Event"} — Invited badges`}>
      {pages.map((pageVisitors, pageIndex) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: pages are a static, non-reorderable chunking of the input list
        <Page key={pageIndex} size="LETTER" style={styles.page}>
        {pageVisitors.map((visitor) => {
            const fullName = [visitor.firstName, visitor.lastName].filter(Boolean).join(" ");

            return (
              <View key={visitor.id} style={styles.badge} wrap={false}>
                <BadgeLogos logoSource={logoSource} />

                <Image src={qrDataUrls.get(visitor.qrToken)} style={styles.qr} />

                <View style={styles.textColumn}>
                  {fullName ? (
                    <Text
                      style={
                        containsArabicScript(fullName)
                          ? [styles.prominentText, styles.rtlText]
                          : [styles.prominentText]
                      }
                    >
                      {fullName}
                    </Text>
                  ) : null}
                  
                  {visitor.company ? (
                    <Text
                      style={
                        containsArabicScript(visitor.company)
                          ? [styles.companyText, styles.rtlText]
                          : [styles.companyText]
                      }
                    >
                      {visitor.company}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </Page>
      ))}
    </Document>
  );
}

function GuestBadgesDocument({
  visitors,
  qrDataUrls,
  logoSource,
  businessName,
}: BadgeDocumentProps) {
  const pages = chunk(visitors, BADGES_PER_PAGE);
  return (
    <Document title={`${businessName ?? "Event"} — Guest badges`}>
      {pages.map((pageVisitors, pageIndex) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: pages are a static, non-reorderable chunking of the input list
        <Page key={pageIndex} size="LETTER" style={styles.page}>
          {pageVisitors.map((visitor, visitorIndex) => (
            <View key={visitor.id} style={styles.badge} wrap={false}>
              <BadgeLogos logoSource={logoSource} />

              <Image src={qrDataUrls.get(visitor.qrToken)} style={styles.qr} />

              <View style={styles.textColumn}>
                <Text style={[styles.prominentText, styles.guestLabel, styles.rtlText]}>
                  {formatGuestBadgeLabel(pageIndex * BADGES_PER_PAGE + visitorIndex)}
                </Text>
              </View>
            </View>
          ))}
        </Page>
      ))}
    </Document>
  );
}

export interface GenerateBadgePdfOptions {
  visitorType: "invited" | "guest";
  visitors: Visitor[];
  eventSettings: EventSettings;
}

export async function generateBadgePdf(options: GenerateBadgePdfOptions): Promise<Buffer> {
  const { visitorType, visitors, eventSettings } = options;

  const qrEntries = await Promise.all(
    visitors.map(
      async (visitor) => [visitor.qrToken, await makeQrDataUrl(visitor.qrToken)] as const,
    ),
  );
  const qrDataUrls = new Map(qrEntries);

  // Embed local uploads so PDF generation does not depend on an HTTP
  // round-trip and remains portable across Windows and Linux paths.
  const localLogoPath = getLocalUploadPathFromUrl(eventSettings.logoUrl);
  const logoSource = localLogoPath
    ? await embedLocalLogo(localLogoPath)
    : (eventSettings.logoUrl ?? undefined);

  const props: BadgeDocumentProps = {
    visitors,
    qrDataUrls,
    logoSource,
    businessName: eventSettings.businessName,
  };

  const document =
    visitorType === "invited" ? (
      <InvitedBadgesDocument {...props} />
    ) : (
      <GuestBadgesDocument {...props} />
    );

  return renderToBuffer(document);
}
