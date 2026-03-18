import type {KeyObject} from 'node:crypto';
import type {JWK, JWTPayload} from 'jose';
import type {JwtJwks} from '../core/jwks';
import type {JwtVerifierOptions, VerifiedJwt} from '../core/verification';

export type JwtKeySource =
  | {jwksUrl: string; jwks?: never; verificationKey?: never; verificationKeyPem?: never}
  | {jwks: JwtJwks | {keys: JWK[]}; jwksUrl?: never; verificationKey?: never; verificationKeyPem?: never}
  | {
      verificationKey: CryptoKey | KeyObject | Uint8Array;
      jwksUrl?: never;
      jwks?: never;
      verificationKeyPem?: never;
    }
  | {
      verificationKeyPem: string;
      jwksUrl?: never;
      jwks?: never;
      verificationKey?: never;
    };

export type JwtVerifyInput = JwtVerifierOptions & JwtKeySource;

export type JwtVerifier<TPayload extends JWTPayload = JWTPayload> = (
  tokenInput: string | undefined,
) => Promise<VerifiedJwt<TPayload>>;
