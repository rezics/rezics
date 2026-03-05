import {Elysia} from 'elysia';
import {jwt} from '@elysiajs/jwt';
import {cors} from '@elysiajs/cors';
import {bearer} from '@elysiajs/bearer';
import {env} from './env';

export function coreInstance(prefix: string) {
  return new Elysia({prefix: prefix})
    .use(
      jwt({
        name: 'jwt',
        secret: env.JWT_SECRET as string,
        exp: '30min',
      }),
    )
    .use(
      jwt({
        name: 'refreshToken',
        secret: env.REFRESH_TOKEN_SECRET as string,
        exp: '30d',
      }),
    )
    .use(bearer());
}

export type coreApp = ReturnType<typeof coreInstance>;
