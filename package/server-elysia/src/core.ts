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
      }),
    )
    .use(bearer());
}

export type coreApp = ReturnType<typeof coreInstance>;
