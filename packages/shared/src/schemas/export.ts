import { z } from "zod";

/** Admin "data export" feature -- CSV/XLSX/JSON of visitors, exhibitors, or visits. */
export const exportEntitySchema = z.enum(["visitors", "exhibitors", "visits"]);
export type ExportEntity = z.infer<typeof exportEntitySchema>;

export const exportFormatSchema = z.enum(["csv", "xlsx", "json"]);
export type ExportFormat = z.infer<typeof exportFormatSchema>;

export const exportQuerySchema = z.object({
  entity: exportEntitySchema,
  format: exportFormatSchema,
});
export type ExportQuery = z.infer<typeof exportQuerySchema>;
