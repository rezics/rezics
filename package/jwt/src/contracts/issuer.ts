import {JwtAlgorithm} from '../core/jwt-algorithm';
import type {JwtAudience} from '../core/jwt-claims';

export type JwtIssuerDescriptor = {
  issuer: string;
  audience: JwtAudience;
  algorithm: typeof JwtAlgorithm.ES256;
  jwksPath: string;
};
