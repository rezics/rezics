import {Elysia} from 'elysia';
import {cors} from '@elysiajs/cors';

export function coreInstance(prefix: string) {
  return new Elysia({prefix}).decorate('jwt', null as unknown).use(cors());
}

export type coreApp = ReturnType<typeof coreInstance>;
