import {exportJWK, importSPKI, type JWK} from 'jose';
import {JwtAlgorithm} from './jwt-algorithm';

const publicJwkCache = new Map<string, Promise<JWK>>();

export type JwtPublicJwk = JWK & {
  kid: string;
  use: 'sig';
  alg: typeof JwtAlgorithm.ES256;
};

export async function publicPemToJwk(
  publicKeyPem: string,
  kid: string,
): Promise<JwtPublicJwk> {
  let cached = publicJwkCache.get(publicKeyPem);
  if (!cached) {
    cached = importSPKI(publicKeyPem, JwtAlgorithm.ES256).then(key =>
      exportJWK(key),
    );
    publicJwkCache.set(publicKeyPem, cached);
  }

  const jwk = await cached;
  return {
    ...jwk,
    kid,
    use: 'sig',
    alg: JwtAlgorithm.ES256,
  };
}
