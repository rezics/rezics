import { z } from 'zod/v4';

export const GetMeRequest = z.object({});

export type GetMeRequest = z.infer<typeof GetMeRequest>;