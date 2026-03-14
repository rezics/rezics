import {Elysia} from 'elysia';
import {cors} from '@elysiajs/cors';
import {mainSessionJwtPlugin} from './session/jwt';

export function coreInstance(prefix: string) {
  return new Elysia({prefix}).use(mainSessionJwtPlugin).use(cors());
}

export type coreApp = ReturnType<typeof coreInstance>;
