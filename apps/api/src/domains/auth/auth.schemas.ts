import { MembershipRole } from "@prisma/client";
import { z } from "zod";

export const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1).max(200)
});

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const forgotPasswordSchema = z.object({
  email: z.string().email()
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8)
});

export const createInviteSchema = z.object({
  workspaceId: z.string().uuid(),
  email: z.string().email(),
  role: z.nativeEnum(MembershipRole)
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  fullName: z.string().min(1).max(200).optional(),
  password: z.string().min(8).optional()
});

export const refreshSchema = z.object({});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
