import { z } from 'zod/v4';
import { IDSchema, StringSchema } from './base';

// 用户相关
export const UserSchema = z.object({
  id: IDSchema,
  name: StringSchema,
  avatar: StringSchema,
});

export const AuthorSchema = z.object({
  name: StringSchema,
  avatar: StringSchema,
  description: StringSchema,
});

// 认证相关
export const AuthPayloadSchema = z.object({
  token: StringSchema,
  user: UserSchema,
});

export const ValidationErrorSchema = z.object({
  field: StringSchema,
  message: StringSchema,
});

// 导出类型
export type User = z.infer<typeof UserSchema>;
export type Author = z.infer<typeof AuthorSchema>;
export type AuthPayload = z.infer<typeof AuthPayloadSchema>;
export type ValidationError = z.infer<typeof ValidationErrorSchema>;