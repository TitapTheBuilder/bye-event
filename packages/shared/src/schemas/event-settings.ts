import { z } from "zod";

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color like #6366f1");

export const eventSettingsUpdateSchema = z.object({
  businessName: z.string().trim().max(200).optional(),
  primaryColor: hexColor.optional(),
  secondaryColor: hexColor.optional(),
  accentColor: hexColor.optional(),
});
export type EventSettingsUpdateInput = z.infer<typeof eventSettingsUpdateSchema>;

export const logoUploadSchema = z.object({
  contentType: z.enum(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]),
  sizeBytes: z.number().int().positive().max(5 * 1024 * 1024, "Logo must be under 5MB"),
});
export type LogoUploadInput = z.infer<typeof logoUploadSchema>;
