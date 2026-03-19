import {Elysia} from 'elysia';

export function coreInstance(prefix = '') {
  return new Elysia({prefix});
}

export type CoreApp = ReturnType<typeof coreInstance>;
