import {Elysia} from 'elysia';
import {mainSessionJwtPlugin} from '@/src/session';

export function coreInstance(prefix: string) {
  return new Elysia({prefix}).use(mainSessionJwtPlugin);
}

export type coreApp = ReturnType<typeof coreInstance>;
