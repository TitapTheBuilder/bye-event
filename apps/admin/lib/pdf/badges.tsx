import type { EventSettings, Visitor } from "@repo/db";
import { PLATFORM_CREDIT } from "@repo/shared/constants";
import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { existsSync } from "node:fs";
import { join } from "node:path";
import QRCode from "qrcode";
import { getLocalUploadPathFromUrl } from "@/lib/uploads";

/**
 * Print-ready badge PDFs, per §7 of the build spec: two distinct templates
 * (Invited: name + company + QR; Guest: QR only, since no name is known
 * yet), laid out multiple-per-page for standard badge stock, with cut
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

function resolveFontPath(filename: string): string {
  const candidates = [
    join(process.cwd(), "public", "fonts", filename),
    join(process.cwd(), "apps", "admin", "public", "fonts", filename),
  ];
  const fontPath = candidates.find((candidate) => existsSync(candidate));
  if (!fontPath) {
    throw new Error(`Required badge PDF font is missing: ${filename}`);
  }
  return fontPath;
}

Font.register({
  family: PDF_FONT_FAMILY,
  fonts: [
    { src: resolveFontPath("NotoSansArabic-Regular.ttf"), fontWeight: 400 },
    { src: resolveFontPath("NotoSansArabic-Bold.ttf"), fontWeight: 700 },
  ],
});

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
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  guestBadge: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  textColumn: {
    flexDirection: "column",
    justifyContent: "center",
    flexGrow: 1,
    paddingRight: 10,
  },
  logo: {
    height: 20,
    maxWidth: 100,
    marginBottom: 8,
    objectFit: "contain",
  },
  name: {
    fontSize: 15,
    fontWeight: 700,
    color: "#111111",
  },
  company: {
    marginTop: 3,
    fontSize: 10,
    color: "#444444",
  },
  rtlText: {
    direction: "rtl",
    textAlign: "right",
  },
  typeTag: {
    marginTop: 8,
    fontSize: 8,
    color: "#777777",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  qr: {
    width: 84,
    height: 84,
  },
  qrLarge: {
    width: 110,
    height: 110,
  },
  credit: {
    position: "absolute",
    bottom: 6,
    left: 14,
    right: 14,
    fontSize: 6,
    color: "#999999",
    textAlign: "center",
  },
  guestLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#111111",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  guestHint: {
    fontSize: 7,
    color: "#888888",
    textAlign: "center",
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

function InvitedBadgesDocument({ visitors, qrDataUrls, logoSource, businessName }: BadgeDocumentProps) {
  const pages = chunk(visitors, BADGES_PER_PAGE);
  return (
    <Document title={`${businessName ?? "Event"} — Invited badges`}>
      {pages.map((pageVisitors, pageIndex) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: pages are a static, non-reorderable chunking of the input list
        <Page key={pageIndex} size="LETTER" style={styles.page}>
          {pageVisitors.map((visitor) => (
            <View key={visitor.id} style={styles.badge} wrap={false}>
              <View style={styles.textColumn}>
                {logoSource ? (
                  <Image src={logoSource} style={styles.logo} />
                ) : businessName ? (
                  <Text
                    style={
                      containsArabicScript(businessName)
                        ? [styles.company, styles.rtlText]
                        : styles.company
                    }
                  >
                    {businessName}
                  </Text>
                ) : null}
                <Text
                  style={
                    containsArabicScript(visitor.name ?? "")
                      ? [styles.name, styles.rtlText]
                      : styles.name
                  }
                >
                  {visitor.name ?? "Guest"}
                </Text>
                {visitor.company ? (
                  <Text
                    style={
                      containsArabicScript(visitor.company)
                        ? [styles.company, styles.rtlText]
                        : styles.company
                    }
                  >
                    {visitor.company}
                  </Text>
                ) : null}
                <Text style={styles.typeTag}>Invited</Text>
              </View>
              <Image src={qrDataUrls.get(visitor.qrToken)} style={styles.qr} />
              <Text style={styles.credit}>{PLATFORM_CREDIT}</Text>
            </View>
          ))}
        </Page>
      ))}
    </Document>
  );
}

function GuestBadgesDocument({ visitors, qrDataUrls, logoSource, businessName }: BadgeDocumentProps) {
  const pages = chunk(visitors, BADGES_PER_PAGE);
  return (
    <Document title={`${businessName ?? "Event"} — Guest badges`}>
      {pages.map((pageVisitors, pageIndex) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: pages are a static, non-reorderable chunking of the input list
        <Page key={pageIndex} size="LETTER" style={styles.page}>
          {pageVisitors.map((visitor) => (
            <View key={visitor.id} style={[styles.badge, styles.guestBadge]} wrap={false}>
              {logoSource ? <Image src={logoSource} style={styles.logo} /> : null}
              <Text style={styles.guestLabel}>Guest</Text>
              <Image src={qrDataUrls.get(visitor.qrToken)} style={styles.qrLarge} />
              <Text style={styles.guestHint}>Present at check-in to register your details</Text>
              <Text style={styles.credit}>{PLATFORM_CREDIT}</Text>
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
    visitors.map(async (visitor) => [visitor.qrToken, await makeQrDataUrl(visitor.qrToken)] as const),
  );
  const qrDataUrls = new Map(qrEntries);

  // Prefer a local file path over round-tripping the logo through this
  // app's own HTTP server -- both are supported by react-pdf's <Image>.
  const logoSource =
    getLocalUploadPathFromUrl(eventSettings.logoUrl) ?? eventSettings.logoUrl ?? undefined;

  const props: BadgeDocumentProps = {
    visitors,
    qrDataUrls,
    logoSource,
    businessName: eventSettings.businessName,
  };

  const document =
    visitorType === "invited" ? <InvitedBadgesDocument {...props} /> : <GuestBadgesDocument {...props} />;

  return renderToBuffer(document);
}
