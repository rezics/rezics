import {Elysia} from 'elysia';
import type {JWTPayload} from 'jose';
import type {JwtVerifier} from '../contracts/verifier';

export interface TokenResolverConfig<TPayload extends JWTPayload = JWTPayload> {
  headerName: string;
  usesBearer: boolean;
  verifier: JwtVerifier<TPayload>;
}

function extractBearer(value: string): string {
  if (value.startsWith('Bearer ')) return value.slice(7);
  return value;
}

export function createTokenResolver<
  Name extends string,
  TPayload extends JWTPayload = JWTPayload,
>(name: Name, config: TokenResolverConfig<TPayload>) {
  return new Elysia({name: `token-resolver/${name}`, seed: name}).resolve(
    {as: 'global'},
    async ({headers, set}) => {
      const headerKey = config.headerName.toLowerCase();
      const raw = (headers as Record<string, string | undefined>)[headerKey];

      if (!raw) {
        return {[name]: null} as {[K in Name]: TPayload | null};
      }

      const token = config.usesBearer ? extractBearer(raw) : raw;

      try {
        const result = await config.verifier(token);
        return {[name]: result.payload} as {[K in Name]: TPayload | null};
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : 'Unknown verification error';
        set.status = 401;
        throw new Error(`Unauthorized: Invalid ${name} — ${reason}`);
      }
    },
  );
}
