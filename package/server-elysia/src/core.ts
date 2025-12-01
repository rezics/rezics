import {Elysia} from 'elysia';
import {jwt} from '@elysiajs/jwt';
import {cors} from '@elysiajs/cors';
import {bearer} from '@elysiajs/bearer';

export function coreInstance(prefix: string) {
  return new Elysia({prefix: prefix})
    .use(
      jwt({
        name: 'jwt',
        secret: process.env.JWT_SECRET!,
        exp: '30min',
      }),
    )
    .use(
      jwt({
        name: 'refreshToken',
        secret: process.env.REFRESH_TOKEN_SECRET!,
        exp: '30d',
      }),
    )
    .use(bearer());
}

export type coreApp = ReturnType<typeof coreInstance>;
