import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { MAX_EXPORT_RECORDS, serializeExport } from "./export";

const dangerousRow = {
  equals: "=1+1",
  plus: "+1+1",
  minus: "-1+1",
  at: "@SUM(1,1)",
  tab: "\t=1+1",
  carriageReturn: "\r=1+1",
};
const neutralizedRow = Object.fromEntries(
  Object.entries(dangerousRow).map(([key, value]) => [key, `'${value}`]),
);

describe("serializeExport", () => {
  it("neutralizes spreadsheet formulas in CSV exports", () => {
    const exported = serializeExport("visitors", "csv", [dangerousRow]);
    const parsed = Papa.parse<Record<string, string>>(exported.body as string, {
      header: true,
    }).data[0];

    expect(parsed).toEqual(neutralizedRow);
  });

  it("neutralizes spreadsheet formulas in XLSX exports", () => {
    const exported = serializeExport("visitors", "xlsx", [dangerousRow]);
    const workbook = XLSX.read(exported.body, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
    const parsed = sheet
      ? XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" })[0]
      : undefined;

    expect(parsed).toEqual(neutralizedRow);
  });

  it("does not alter JSON export values", () => {
    const exported = serializeExport("visitors", "json", [dangerousRow]);

    expect(JSON.parse(exported.body as string)).toEqual([dangerousRow]);
  });

  it("rejects exports over the record limit", () => {
    const rows = Array.from({ length: MAX_EXPORT_RECORDS + 1 }, () => dangerousRow);

    expect(() => serializeExport("visitors", "csv", rows)).toThrow(/more than/);
  });
});
