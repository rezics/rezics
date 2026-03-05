import {Elysia} from 'elysia';
import {cors} from '@elysiajs/cors';

export function coreInstance(prefix = '') {
  return new Elysia({prefix}).use(
    cors({
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['content-type', 'authorization', 'x-internal-auth-token'],
    }),
  );
}

export type CoreApp = ReturnType<typeof coreInstance>;
