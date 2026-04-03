import {Elysia} from 'elysia';
import type {JWTPayload} from 'jose';
import type {JwtVerifier} from '../contracts/verifier';

export interface TokenResolverConfig<TPayload extends JWTPayload = JWTPayload> {
  headerName: string;
  usesBearer: boolean;
  verifier: JwtVerifier<TPayload>;
}

export function createTokenResolver<
  Name extends string,
  TPayload extends JWTPayload = JWTPayload,
>(name: Name, config: TokenResolverConfig<TPayload>) {
  type ResolvedToken = {[K in Name]: TPayload | null};

  return new Elysia({name: `token-resolver/${name}`, seed: name}).resolve(
    {as: 'global'},
    async ({headers}) => {
      const headerKey = config.headerName.toLowerCase();
      const raw = (headers as Record<string, string | undefined>)[headerKey];

      if (!raw) {
        return {[name]: null} as ResolvedToken;
      }

      try {
        const result = await config.verifier(raw);
        return {[name]: result.payload} as ResolvedToken;
      } catch {
        return {[name]: null} as ResolvedToken;
      }
    },
  );
}
