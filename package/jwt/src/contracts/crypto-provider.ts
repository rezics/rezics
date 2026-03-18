import {generateKeyPairSync} from 'node:crypto';
import {JwtAlgorithm} from '../core/jwt-algorithm';

export type JwtKeyMaterial = {
  privateKeyPem: string;
  publicKeyPem: string;
};

export type JwtCryptoProvider = {
  generateKey(): Promise<JwtKeyMaterial> | JwtKeyMaterial;
};

export const defaultJwtCryptoProvider: JwtCryptoProvider = {
  generateKey() {
    const {privateKey, publicKey} = generateKeyPairSync('ec', {
      namedCurve: 'P-256',
    });

    return {
      privateKeyPem: privateKey.export({format: 'pem', type: 'pkcs8'}).toString(),
      publicKeyPem: publicKey.export({format: 'pem', type: 'spki'}).toString(),
    };
  },
};

export const defaultJwtAlgorithm = JwtAlgorithm.ES256;
