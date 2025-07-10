import { z } from 'zod/v4';

export const GetMeRequestSchema = z.object({});

export type GetMeRequest = z.infer<typeof GetMeRequestSchema>;