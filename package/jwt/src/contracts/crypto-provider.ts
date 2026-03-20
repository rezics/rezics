import {generateKeyPairSync} from 'node:crypto';
import {exportJWK} from 'jose';
import {JwtAlgorithm} from '../core/jwt-algorithm';
import {asJwtPrivateJwk, asJwtPublicJwk, type JwtPrivateJwk, type JwtPublicJwk} from '../core/jwk';

export type JwtKeyMaterial = {
  privateJwk: JwtPrivateJwk;
  publicJwk: JwtPublicJwk;
};

export type JwtCryptoProvider = {
  generateKey(): Promise<JwtKeyMaterial> | JwtKeyMaterial;
};

export const defaultJwtCryptoProvider: JwtCryptoProvider = {
  async generateKey() {
    const {privateKey, publicKey} = generateKeyPairSync('ec', {
      namedCurve: 'P-256',
    });

    return {
      privateJwk: asJwtPrivateJwk(await exportJWK(privateKey)),
      publicJwk: asJwtPublicJwk(await exportJWK(publicKey)),
    };
  },
};

export const defaultJwtAlgorithm = JwtAlgorithm.ES256;
