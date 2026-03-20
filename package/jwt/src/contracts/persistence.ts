import type {JwtPrivateJwk, JwtPublicJwk} from '../core/jwk';
import type {JwtAlgorithm} from '../core/jwt-algorithm';

export type JwtKeyRecord = {
  issuer: string;
  kid: string;
  algorithm: JwtAlgorithm;
  publicJwk: JwtPublicJwk;
  privateJwk: JwtPrivateJwk;
  createdAt: Date;
  activatesAt: Date;
  retiresAt: Date | null;
  expiresAt: Date | null;
};

export type JwtKeyPersistence = {
  listKeys(params: {issuer: string}): Promise<JwtKeyRecord[]>;
  saveKey(params: {issuer: string; key: JwtKeyRecord}): Promise<void>;
  markKeyRetiring(params: {
    issuer: string;
    kid: string;
    retiresAt: Date;
    expiresAt: Date;
  }): Promise<void>;
  getKeyByKid(params: {
    issuer: string;
    kid: string;
  }): Promise<JwtKeyRecord | null>;
};
