import {Elysia} from 'elysia';

export function coreInstance(prefix: string) {
  return new Elysia({prefix: prefix});
}
