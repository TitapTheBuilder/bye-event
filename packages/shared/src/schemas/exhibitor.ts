import { z } from "zod";

const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(200);

const phoneNumberSchema = z
  .string()
  .trim()
  .min(6, "Enter a valid phone number")
  .max(30)
  .regex(/^[+\d][\d\s-]*$/, "Enter a valid phone number");

export const exhibitorSignupSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(200),
  lastName: z.string().trim().min(1, "Last name is required").max(200),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(100)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Username may only contain letters, numbers, . _ -"),
  phoneNumber: phoneNumberSchema,
  password: passwordSchema,
});
export type ExhibitorSignupInput = z.infer<typeof exhibitorSignupSchema>;

export const exhibitorLoginSchema = z.object({
  username: z.string().trim().min(1, "Username is required").max(100),
  password: z.string().min(1, "Password is required").max(200),
});
export type ExhibitorLoginInput = z.infer<typeof exhibitorLoginSchema>;

/** Admin-side soft-delete/restore toggle for a single exhibitor account. */
export const exhibitorStatusUpdateSchema = z.object({
  action: z.enum(["deactivate", "reactivate"]),
});
export type ExhibitorStatusUpdateInput = z.infer<typeof exhibitorStatusUpdateSchema>;
