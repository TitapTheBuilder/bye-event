import { z } from "zod";
import { VISITOR_TYPES } from "../constants";

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined));

export const visitorTypeSchema = z.enum(VISITOR_TYPES);

export const visitorCreateSchema = z.object({
  firstName: optionalTrimmedString(200),
  lastName: optionalTrimmedString(200),
  company: optionalTrimmedString(200),
  phoneNumber: optionalTrimmedString(30),
  email: z
    .string()
    .trim()
    .email()
    .max(200)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  color: optionalTrimmedString(50),
  visitorType: visitorTypeSchema.default("invited"),
});
export type VisitorCreateInput = z.infer<typeof visitorCreateSchema>;

export const visitorUpdateSchema = visitorCreateSchema.partial();
export type VisitorUpdateInput = z.infer<typeof visitorUpdateSchema>;

/** One row from a bulk CSV/XLSX import -- validated independently per row
 * so a single bad row never blocks the rest of the file (partial-success
 * import). */
export const visitorImportRowSchema = z.object({
  firstName: optionalTrimmedString(200),
  lastName: optionalTrimmedString(200),
  company: optionalTrimmedString(200),
  phoneNumber: optionalTrimmedString(30),
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || z.string().email().safeParse(v).success, {
      message: "Invalid email address",
    }),
  color: optionalTrimmedString(50),
});
export type VisitorImportRow = z.infer<typeof visitorImportRowSchema>;

export const guestGenerateSchema = z.object({
  count: z.coerce.number().int().min(1).max(5000),
});
export type GuestGenerateInput = z.infer<typeof guestGenerateSchema>;

/** Admin-side soft-delete/restore toggle for a single visitor row. */
export const visitorStatusUpdateSchema = z.object({
  action: z.enum(["deactivate", "reactivate"]),
});
export type VisitorStatusUpdateInput = z.infer<typeof visitorStatusUpdateSchema>;

export const badgeExportSchema = z.object({
  visitorType: visitorTypeSchema,
  /** Omit to export every active visitor of this type. */
  visitorIds: z.array(z.string().uuid()).min(1).optional(),
});
export type BadgeExportInput = z.infer<typeof badgeExportSchema>;
