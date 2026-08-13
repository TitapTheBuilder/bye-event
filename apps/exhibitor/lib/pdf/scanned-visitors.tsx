import { existsSync } from "node:fs";
import { join } from "node:path";
import { Document, Font, Page, renderToBuffer, StyleSheet, Text, View, Svg, Path, Rect } from "@react-pdf/renderer";
import type { ScannedVisitorRow } from "@repo/db";
import { formatPersonName } from "@repo/shared/person-name";

const PDF_FONT_FAMILY = "Noto Sans Arabic";
const ARABIC_SCRIPT_PATTERN = /\p{Script=Arabic}/u;

function resolveFontPath(filename: string): string {
  const candidates = [
    join(process.cwd(), "public", "fonts", filename),
    join(process.cwd(), "apps", "exhibitor", "public", "fonts", filename),
  ];
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) throw new Error(`Required scanned-list PDF font is missing: ${filename}`);
  return path;
}

Font.register({
  family: PDF_FONT_FAMILY,
  fonts: [
    { src: resolveFontPath("NotoSansArabic-Regular.ttf"), fontWeight: 400 },
    { src: resolveFontPath("NotoSansArabic-Bold.ttf"), fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 10,
    backgroundColor: "#f8fafc",
    color: "#0f172a",
  },
  header: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#cbd5e1",
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: "#1e293b",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "#64748b",
  },
  grid: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  nameContainer: {
    flex: 1,
    paddingRight: 8,
  },
  name: {
    fontSize: 14,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 4,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 7,
    fontWeight: 700,
  },
  badgeInvited: {
    backgroundColor: "#dcfce7",
  },
  badgeInvitedText: {
    color: "#166534",
  },
  badgeGuest: {
    backgroundColor: "#f1f5f9",
  },
  badgeGuestText: {
    color: "#475569",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  infoIcon: {
    marginRight: 6,
  },
  infoText: {
    fontSize: 9,
    color: "#475569",
  },
  footer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  footerText: {
    fontSize: 8,
    color: "#94a3b8",
  },
  rtl: {
    direction: "rtl",
    textAlign: "right",
  },
});

function textStyle(value: string, base: Record<string, string | number>) {
  return ARABIC_SCRIPT_PATTERN.test(value) ? [base, styles.rtl] : base;
}

const IconPhone = ({ color = "#94a3b8", size = 10 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </Svg>
);

const IconMail = ({ color = "#94a3b8", size = 10 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect width="20" height="16" x="2" y="4" rx="2" />
    <Path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </Svg>
);

const IconBriefcase = ({ color = "#94a3b8", size = 10 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <Path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </Svg>
);

export interface PdfScannedVisitorRow {
  visitorId?: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  phoneNumber: string | null;
  email: string | null;
  visitorType?: "invited" | "guest" | string | null;
  scanCount?: number | null;
  lastScannedAt?: string | Date | null;
  scannedAt?: string | Date | null;
}

function ScannedVisitorsDocument({
  rows,
  exhibitorName,
}: {
  rows: PdfScannedVisitorRow[];
  exhibitorName: string;
}) {
  return (
    <Document title={`Scanned visitors — ${exhibitorName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={textStyle("Scanned Visitors", styles.title)}>Scanned Visitors</Text>
          <Text style={textStyle(exhibitorName, styles.subtitle)}>{exhibitorName}</Text>
        </View>
        
        <View style={styles.grid}>
          {rows.map((row, idx) => {
            const name = formatPersonName(row.firstName, row.lastName) || "Guest visitor";
            const isInvited = row.visitorType === "invited";
            const timestamp = row.lastScannedAt ?? row.scannedAt;
            const dateDisplay = timestamp
              ? new Date(timestamp).toLocaleString()
              : "";
            
            return (
              <View key={row.visitorId ?? `row-${idx}`} style={styles.card} wrap={false}>
                <View style={styles.cardHeader}>
                  <View style={styles.nameContainer}>
                    <Text style={textStyle(name, styles.name)}>{name}</Text>
                    {row.company ? (
                      <View style={styles.infoRow}>
                        <View style={styles.infoIcon}><IconBriefcase /></View>
                        <Text style={textStyle(row.company, styles.infoText)}>{row.company}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={[styles.badge, isInvited ? styles.badgeInvited : styles.badgeGuest]}>
                    <Text style={[styles.badgeText, isInvited ? styles.badgeInvitedText : styles.badgeGuestText]}>
                      {isInvited ? "INVITED" : "GUEST"}
                    </Text>
                  </View>
                </View>

                {row.phoneNumber ? (
                  <View style={styles.infoRow}>
                    <View style={styles.infoIcon}><IconPhone /></View>
                    <Text style={styles.infoText}>{row.phoneNumber}</Text>
                  </View>
                ) : null}
                
                {row.email ? (
                  <View style={styles.infoRow}>
                    <View style={styles.infoIcon}><IconMail /></View>
                    <Text style={styles.infoText}>{row.email}</Text>
                  </View>
                ) : null}

                {dateDisplay ? (
                  <View style={styles.footer}>
                    <Text style={styles.footerText}>{dateDisplay}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </Page>
    </Document>
  );
}

export async function generateScannedVisitorsPdf(
  rows: PdfScannedVisitorRow[],
  exhibitorName: string,
): Promise<Buffer> {
  return renderToBuffer(<ScannedVisitorsDocument rows={rows} exhibitorName={exhibitorName} />);
}
