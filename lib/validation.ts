import { z } from "zod";
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export const reportInput = z.object({
  kind: z.enum(["lost", "found"]),
  title: z.string().trim().min(3).max(100),
  category: z.enum(["ID card", "Electronics", "Bags", "Accessories", "Books", "Clothing", "Keys", "Other"]),
  description: z.string().trim().min(10).max(1200),
  location: z.string().trim().min(2).max(160),
  happened_at: z.string().datetime().refine((value) => new Date(value).getTime() <= Date.now() + MAX_CLOCK_SKEW_MS, "The date cannot be in the future."),
  dropped_off_desk: z.string().trim().max(160).optional().default(""),
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

export const contactCategories = [
  "Handover Dispute — Finder Refuses Return",
  "Handover Dispute — Claimant Issue",
  "Lost Item",
  "Found Item",
  "Account/Login Issue",
  "Technical Issue",
  "Report Inappropriate Content",
  "General Enquiry",
] as const;

export const contactPartyRoles = [
  "Lost item owner",
  "Item finder",
  "General member",
] as const;

export const contactInput = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  party_role: z.enum(contactPartyRoles).optional().default("General member"),
  category: z.enum(contactCategories),
  report_id: z.string().trim().max(64).optional().default(""),
  claim_id: z.string().trim().max(64).optional().default(""),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(3000),
});

export const adminLoginInput = z.object({
  email: z.string().trim().email("Enter a valid admin email address.").max(254),
  password: z.string().min(1, "Enter your admin password.").max(256),
});

export const adminUserUpdateInput = z.object({
  role: z.enum(["member", "student", "faculty", "staff", "admin"]).optional(),
  auth_status: z.enum(["approved", "suspended"]).optional(),
  new_password: passwordSchema.optional(),
  reason: z.string().trim().max(300).optional(),
}).refine((data) => data.role !== undefined || data.auth_status !== undefined || data.new_password !== undefined, {
  message: "Provide a role, authentication status, or new password to update.",
});

export const changePasswordInput = z.object({
  currentPassword: z.string().max(256).optional().default(""),
  newPassword: passwordSchema,
});
