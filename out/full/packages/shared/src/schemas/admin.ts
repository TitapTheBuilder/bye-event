import { z } from "zod";

const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(200);

export const adminLoginSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1, "Password is required").max(200),
});
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export const adminCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().email().max(200),
  password: passwordSchema,
});
export type AdminCreateInput = z.infer<typeof adminCreateSchema>;
