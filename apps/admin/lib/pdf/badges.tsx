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
const PDF_FONT_FAMILY = "Noto Sans Arabic";
const ARABIC_SCRIPT_PATTERN = /\p{Script=Arabic}/u;

const PAGE_WIDTH = 8.5 * PT_PER_IN;
const PAGE_HEIGHT = 11 * PT_PER_IN;

const BADGE_GAP = 0.2 * PT_PER_IN;
const BADGES_PER_ROW = 2;
const ROWS_PER_PAGE = 2;
const BADGES_PER_PAGE = BADGES_PER_ROW * ROWS_PER_PAGE;

const USABLE_WIDTH = PAGE_WIDTH - 2 * PAGE_MARGIN;
const USABLE_HEIGHT = PAGE_HEIGHT - 2 * PAGE_MARGIN;

const BADGE_WIDTH = (USABLE_WIDTH - (BADGES_PER_ROW - 1) * BADGE_GAP) / BADGES_PER_ROW;
const BADGE_HEIGHT = (USABLE_HEIGHT - (ROWS_PER_PAGE - 1) * BADGE_GAP) / ROWS_PER_PAGE;

const CARD_WIDTH = 3.5 * PT_PER_IN;
const CARD_HEIGHT = 2.25 * PT_PER_IN;

const BADGE_SCALE = Math.min(BADGE_WIDTH / CARD_HEIGHT, BADGE_HEIGHT / CARD_WIDTH);



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
    position: "relative",
    overflow: "hidden",
  },
  badgeContent: {
    position: "absolute",
    left: (BADGE_WIDTH - CARD_WIDTH) / 2,
    top: (BADGE_HEIGHT - CARD_HEIGHT) / 2,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    transform: `rotate(90deg) scale(${BADGE_SCALE})`,
    transformOrigin: "center",
  },
  qr: {
    position: "absolute",
    left: 14,
    top: 39, 
    width: 84,
    height: 84,
  },
  shortCodeText: {
    position: "absolute",
    left: 14,
    width: 84,
    top: 15,
    textAlign: "center",
    fontSize: 11,
    color: "#555555",
    letterSpacing: 2,
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
    color: "#1c1c1c",
    marginTop: 6,
    textAlign: "right",
  },
  prominentText: {
    fontSize: 12,
    fontWeight: 700,
    color: "#111111",
    textAlign: "right",
  },
  guestText: {
    fontSize: 22,
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
  noRightGap: { marginRight: 0 },
  noBottomGap: { marginBottom: 0 },
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

export function formatGuestBadgeLabel(): string {
  return `مهمان`;
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
        {pageVisitors.map((visitor, i) => {
            const isLastCol = (i + 1) % BADGES_PER_ROW === 0;
            const isLastRow = i >= pageVisitors.length - BADGES_PER_ROW;
            return (
              <View
                key={visitor.id}
                style={[
                  styles.badge,
                  ...(isLastCol ? [styles.noRightGap] : []),
                  ...(isLastRow ? [styles.noBottomGap] : []),
                ]}
                wrap={false}
              >
                <View style={styles.badgeContent}>
                  <BadgeLogos logoSource={logoSource} />
                  {visitor.shortCode ? (
                    <Text style={styles.shortCodeText}>{visitor.shortCode}</Text>
                  ) : null}
                  <Image src={qrDataUrls.get(visitor.qrToken)} style={styles.qr} />

                  <View style={styles.textColumn}>
                    {visitor.firstName ? (
                      <Text
                        style={
                          containsArabicScript(visitor.firstName)
                            ? [styles.prominentText, styles.rtlText]
                            : [styles.prominentText]
                        }
                      >
                        {visitor.firstName}
                      </Text>
                    ) : null}

                    {visitor.lastName ? (
                      <Text
                        style={
                          containsArabicScript(visitor.lastName)
                            ? [styles.prominentText, styles.rtlText]
                            : [styles.prominentText]
                        }
                      >
                        {visitor.lastName}
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
          {pageVisitors.map((visitor, visitorIndex) => {
            const isLastCol = (visitorIndex + 1) % BADGES_PER_ROW === 0;
            const isLastRow = visitorIndex >= pageVisitors.length - BADGES_PER_ROW;
            return (
              <View
                key={visitor.id}
                style={[
                  styles.badge,
                  ...(isLastCol ? [styles.noRightGap] : []),
                  ...(isLastRow ? [styles.noBottomGap] : []),
                ]}
                wrap={false}
              >
                <View style={styles.badgeContent}>
                  <BadgeLogos logoSource={logoSource} />
                  {visitor.shortCode ? (
                    <Text style={styles.shortCodeText}>{visitor.shortCode}</Text>
                  ) : null}
                  <Image src={qrDataUrls.get(visitor.qrToken)} style={styles.qr} />

                  <View style={styles.textColumn}>
                    <Text style={[styles.guestText, styles.guestLabel, styles.rtlText]}>
                      {formatGuestBadgeLabel()}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
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

  const qrEntries: Array<readonly [string, string]> = [];
  const qrConcurrency = 16;
  for (let index = 0; index < visitors.length; index += qrConcurrency) {
    const batch = await Promise.all(
      visitors
        .slice(index, index + qrConcurrency)
        .map(async (visitor) => [visitor.qrToken, await makeQrDataUrl(visitor.qrToken)] as const),
    );
    qrEntries.push(...batch);
  }
  const qrDataUrls = new Map(qrEntries);

  // Embed local uploads so PDF generation does not depend on an HTTP
  // round-trip and remains portable across Windows and Linux paths.
  const localLogoPath = getLocalUploadPathFromUrl(eventSettings.logoUrl);
  // Never let a legacy/external branding URL trigger a server-side fetch.
  const logoSource = localLogoPath ? await embedLocalLogo(localLogoPath) : undefined;

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
