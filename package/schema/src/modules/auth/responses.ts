import { z } from 'zod/v4';
import { SuccessResponseSchema } from '../../base';
import { AuthPayloadSchema, ValidationErrorSchema } from '../user';

// 认证响应
export const AuthResponseSchema = SuccessResponseSchema(AuthPayloadSchema);
export const ValidationResponseSchema = SuccessResponseSchema(z.array(ValidationErrorSchema));

// 导出类型
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type ValidationResponse = z.infer<typeof ValidationResponseSchema>;