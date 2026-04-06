import type { NormalizedTokenName } from "@rezics/contract";
import type { JwtAlgorithm } from "./jwt-algorithm";
import type { JwtAudience, JwtClaims } from "./jwt-claims";

export type JwtVerifierDescriptor = {
  issuer: string;
  audience: JwtAudience;
  algorithm: JwtAlgorithm;
};

export type JwtVerifierOptions = JwtVerifierDescriptor & {
  tokenName?: NormalizedTokenName;
  clockToleranceSeconds?: number;
  requiredScope?: string;
  enforceTransport?: boolean;
};

export type VerifiedJwt<TPayload extends JwtClaims = JwtClaims> = {
  token: string;
  payload: TPayload;
  protectedHeader: {
    alg?: string;
    kid?: string;
  };
};
