import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { UserSchema } from './User';

const c = initContract();

export const authRouter = c.router({
  login: {
    method: 'POST',
    path: '/auth/login',
    body: z.object({ email: z.string().email(), password: z.string() }),
    responses: {
      200: z.object({ token: z.string(), user: UserSchema }),
      401: z.object({ message: z.string() }),
    },
  },
  register: {
    method: 'POST',
    path: '/auth/register',
    body: z.object({ email: z.string().email(), password: z.string() }),
    responses: {
      200: z.object({ token: z.string(), user: UserSchema }),
    },
  },
  refresh: {
    method: 'POST',
    path: '/auth/refresh',
    body: z.object({ refreshToken: z.string() }),
    responses: {
      200: z.object({ accessToken: z.string(), refreshToken: z.string().optional() }),
      401: z.object({ message: z.string() }),
    },
  },
});

export type AuthRouter = typeof authRouter; 