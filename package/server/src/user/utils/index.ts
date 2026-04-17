import {
  NormalizedTokenName,
  type NormalizedTokenName as NormalizedTokenNameType,
} from "@rezics/contract";
import {
  JwtAlgorithm,
  type VerifiedJwt as VerifiedToken,
  type JwtVerifyInput as VerifyOptions,
  verifyTokenFromHeader,
} from "@rezics/jwt";
import type { JWTPayload } from "jose";
import { getJwtService } from "@/jwt";
import { env } from "../../env";

export function buildTrustedAuthVerifyOptions(
  trustedAuth: {
    issuer: string;
    audience: string;
    jwksUrl: string;
  },
  overrides?: Partial<VerifyOptions>,
  tokenName: NormalizedTokenNameType = NormalizedTokenName.AUTH_SESSION,
): VerifyOptions {
  return {
    issuer: overrides?.issuer ?? trustedAuth.issuer,
    audience: overrides?.audience ?? trustedAuth.audience,
    jwksUrl:
      typeof overrides?.jwksUrl === "string"
        ? overrides.jwksUrl
        : trustedAuth.jwksUrl,
    algorithm: overrides?.algorithm ?? JwtAlgorithm.ES256,
    tokenName,
    clockToleranceSeconds:
      overrides?.clockToleranceSeconds ??
      Number(env.AUTH_JWT_CLOCK_TOLERANCE_SECONDS ?? "5"),
    requiredScope: overrides?.requiredScope ?? "user",
    enforceTransport: overrides?.enforceTransport ?? true,
  };
}

async function buildAuthVerifyOptions(
  overrides?: Partial<VerifyOptions>,
  tokenName: NormalizedTokenNameType = NormalizedTokenName.AUTH_SESSION,
): Promise<VerifyOptions> {
  const trustedAuth = await getJwtService("auth-upstream");
  return buildTrustedAuthVerifyOptions(trustedAuth, overrides, tokenName);
}

export async function verifyAuthToken<
  TPayload extends JWTPayload = JWTPayload,
>(
  token: string | undefined,
  overrides?: Partial<VerifyOptions>,
): Promise<VerifiedToken<TPayload>> {
  return verifyTokenFromHeader<TPayload>(
    token,
    await buildAuthVerifyOptions(overrides),
  );
}
