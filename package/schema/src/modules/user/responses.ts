import { z } from 'zod/v4';
import { SuccessResponse } from '../../base';
import { User } from './types';

export const MeResponse = SuccessResponse(User);

export type MeResponse = z.infer<typeof MeResponse>;