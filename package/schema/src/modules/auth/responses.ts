import { z } from 'zod/v4';
import { SuccessResponseSchema } from '../../base';
import { AuthPayloadSchema, ValidationErrorSchema } from '../user';

export const AuthResponseSchema = SuccessResponseSchema(AuthPayloadSchema);
export const ValidationResponseSchema = SuccessResponseSchema(z.array(ValidationErrorSchema));

export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type ValidationResponse = z.infer<typeof ValidationResponseSchema>;