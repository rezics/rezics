import { z } from 'zod/v4';

// 认证请求
export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const ValidateEmailRequestSchema = z.object({
  email: z.string().email(),
});

export const ValidatePasswordRequestSchema = z.object({
  password: z.string().min(6),
});

// 导出类型
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type ValidateEmailRequest = z.infer<typeof ValidateEmailRequestSchema>;
export type ValidatePasswordRequest = z.infer<typeof ValidatePasswordRequestSchema>;