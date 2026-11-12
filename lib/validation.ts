import { z } from "zod";
export const reportInput = z.object({
  kind: z.enum(["lost","found"]),
  title: z.string().trim().min(3).max(100),
  category: z.enum(["ID card","Electronics","Bags","Accessories","Books","Clothing","Keys","Other"]),
  description: z.string().trim().min(10).max(1200),
  location: z.string().trim().min(2).max(160),
  happened_at: z.string().datetime().refine((value) => new Date(value).getTime() <= Date.now(), "The date cannot be in the future."),
});

export const reportUpdateInput = reportInput.omit({ kind: true });

export const claimInput = z.object({
  report_id: z.string().uuid(),
  ownership_details: z.string().trim().min(8).max(1000),
});

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long.")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter (a-z).")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter (A-Z).")
  .regex(/[0-9]/, "Password must contain at least one number (0-9).")
  .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character.");

export const signUpInput = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters."),
  email: z.string().trim().email("Please provide a valid email address."),
  password: passwordSchema,
});

export const signInInput = z.object({
  email: z.string().trim().email("Please provide a valid email address."),
  password: z.string().min(1, "Password is required."),
});
