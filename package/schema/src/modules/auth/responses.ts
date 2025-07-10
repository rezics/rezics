import { z } from 'zod/v4';
import { SuccessResponse } from '../../base';
import { AuthPayload, ValidationError } from '../user';

export const AuthResponse = SuccessResponse(AuthPayload);
export const ValidationResponse = SuccessResponse(z.array(ValidationError));

export type AuthResponse = z.infer<typeof AuthResponse>;
export type ValidationResponse = z.infer<typeof ValidationResponse>;