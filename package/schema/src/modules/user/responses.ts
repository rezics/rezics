import { z } from 'zod/v4';
import { SuccessResponseSchema } from '../../base';
import { UserSchema } from './types';

export const MeResponseSchema = SuccessResponseSchema(UserSchema);

export type MeResponse = z.infer<typeof MeResponseSchema>;