import {Elysia} from 'elysia';
import {cors} from '@elysiajs/cors';

export function coreInstance(prefix: string) {
  return new Elysia({prefix}).use(cors());
}

export type coreApp = ReturnType<typeof coreInstance>;
