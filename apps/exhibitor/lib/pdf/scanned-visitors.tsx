import { existsSync } from "node:fs";
import { join } from "node:path";
import { Document, Font, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
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
    fontSize: 8,
    color: "#111111",
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
  },
  subtitle: {
    color: "#666666",
    marginBottom: 18,
  },
  row: {
    borderBottomWidth: 1,
    borderBottomColor: "#dddddd",
    paddingVertical: 8,
  },
  name: {
    fontSize: 10,
    fontWeight: 700,
  },
  details: {
    color: "#555555",
    marginTop: 2,
  },
  rtl: {
    direction: "rtl",
    textAlign: "right",
  },
});

function textStyle(
  value: string,
  base: typeof styles.name | typeof styles.details | typeof styles.title | typeof styles.subtitle,
) {
  return ARABIC_SCRIPT_PATTERN.test(value) ? [base, styles.rtl] : base;
}

function ScannedVisitorsDocument({
  rows,
  exhibitorName,
}: {
  rows: ScannedVisitorRow[];
  exhibitorName: string;
}) {
  return (
    <Document title={`Scanned visitors — ${exhibitorName}`}>
      <Page size="A4" style={styles.page}>
        <Text style={textStyle("Scanned visitors", styles.title)}>Scanned visitors</Text>
        <Text style={textStyle(exhibitorName, styles.subtitle)}>{exhibitorName}</Text>
        {rows.map((row) => {
          const name = formatPersonName(row.firstName, row.lastName) || "Guest visitor";
          const contact = [row.phoneNumber, row.email].filter(Boolean).join(" · ");
          return (
            <View key={row.visitorId} style={styles.row} wrap={false}>
              <Text style={textStyle(name, styles.name)}>{name}</Text>
              {row.company ? (
                <Text style={textStyle(row.company, styles.details)}>{row.company}</Text>
              ) : null}
              <Text style={styles.details}>
                {[contact, `Scans: ${row.scanCount}`, row.lastScannedAt.toISOString()]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
          );
        })}
      </Page>
    </Document>
  );
}

export async function generateScannedVisitorsPdf(
  rows: ScannedVisitorRow[],
  exhibitorName: string,
): Promise<Buffer> {
  return renderToBuffer(<ScannedVisitorsDocument rows={rows} exhibitorName={exhibitorName} />);
}
