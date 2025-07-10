import { z } from 'zod/v4';

export const LoginRequest = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const RegisterRequest = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const ValidateEmailRequest = z.object({
  email: z.string().email(),
});

export const ValidatePasswordRequest = z.object({
  password: z.string().min(6),
});

export type LoginRequest = z.infer<typeof LoginRequest>;
export type RegisterRequest = z.infer<typeof RegisterRequest>;
export type ValidateEmailRequest = z.infer<typeof ValidateEmailRequest>;
export type ValidatePasswordRequest = z.infer<typeof ValidatePasswordRequest>;