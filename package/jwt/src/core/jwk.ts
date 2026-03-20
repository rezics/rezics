import {exportJWK, importJWK, importSPKI, type JWK} from 'jose';
import {JwtAlgorithm} from './jwt-algorithm';

export type JwtPublicJwk = JWK & {
  kid: string;
  use: 'sig';
  alg: typeof JwtAlgorithm.ES256;
};

export type JwtPrivateJwk = JWK & {
  kid: string;
  use: 'sig';
  alg: typeof JwtAlgorithm.ES256;
  d: string;
};

function withJwtMetadata<TJwk extends JWK>(jwk: TJwk): TJwk & {
  use: 'sig';
  alg: typeof JwtAlgorithm.ES256;
} {
  return {
    ...jwk,
    use: 'sig',
    alg: JwtAlgorithm.ES256,
  };
}

export function asJwtPublicJwk(jwk: JWK): JwtPublicJwk {
  return withJwtMetadata(jwk) as JwtPublicJwk;
}

export function asJwtPrivateJwk(jwk: JWK): JwtPrivateJwk {
  return withJwtMetadata(jwk) as JwtPrivateJwk;
}

export async function importPublicJwk(jwk: JWK) {
  return importJWK(jwk, JwtAlgorithm.ES256);
}

export async function importPrivateJwk(jwk: JWK) {
  return importJWK(jwk, JwtAlgorithm.ES256);
}

export async function pemToJwk(pem: string) {
  const key = await importSPKI(pem, JwtAlgorithm.ES256);
  return exportJWK(key);
}
