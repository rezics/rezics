import type {JWTPayload} from 'jose';

export type JwtAudience = string | string[];

export type JwtClaims = JWTPayload & {
  scope?: string | string[];
  sub?: string;
};
