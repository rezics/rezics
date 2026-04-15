import type { AuthSessionTokenClaims } from "@rezics/contract";
import { NormalizedTokenName } from "@rezics/contract";
import {
  type JwtVerifyInput,
  type VerifiedJwt,
  verifyBearerToken,
} from "@rezics/jwt";
import type { JWTPayload } from "jose";
import {
  getAuthJwtAudience,
  getAuthJwtIssuer,
  getAuthSessionJwksPath,
} from "./options";

export type VerifyOptions = JwtVerifyInput;
export type VerifiedToken<TPayload extends JWTPayload = JWTPayload> =
  VerifiedJwt<TPayload>;

function buildLocalDefaults(
  overrides?: Partial<VerifyOptions>,
  tokenName: VerifyOptions["tokenName"] = NormalizedTokenName.AUTH_SESSION,
): VerifyOptions {
  const issuer = overrides?.issuer ?? getAuthJwtIssuer();
  const audience = overrides?.audience ?? getAuthJwtAudience();
  const jwksUrl =
    typeof overrides?.jwksUrl === "string"
      ? overrides.jwksUrl
      : new URL(getAuthSessionJwksPath(), issuer).toString();

  return {
    issuer,
    audience,
    jwksUrl,
    algorithm: overrides?.algorithm ?? "ES256",
    tokenName,
    clockToleranceSeconds: overrides?.clockToleranceSeconds ?? 5,
    requiredScope: overrides?.requiredScope ?? undefined,
    enforceTransport: overrides?.enforceTransport ?? true,
  };
}

export function getAuthSessionVerifyOptions(
  overrides?: Partial<VerifyOptions>,
): VerifyOptions {
  return buildLocalDefaults(overrides, NormalizedTokenName.AUTH_SESSION);
}

export async function verifyAuthSessionToken<
  TPayload extends JWTPayload = AuthSessionTokenClaims & JWTPayload,
>(
  authorization: string | undefined,
  overrides?: Partial<VerifyOptions>,
): Promise<VerifiedToken<TPayload>> {
  return verifyBearerToken<TPayload>(
    authorization,
    getAuthSessionVerifyOptions(overrides),
  );
}

export async function verifyAuth<
  TPayload extends JWTPayload = AuthSessionTokenClaims & JWTPayload,
>(
  authorization: string | undefined,
  setOrOptions?: { status?: number } | Partial<VerifyOptions>,
  maybeOptions?: Partial<VerifyOptions>,
): Promise<TPayload> {
  let set: { status?: number } | undefined;
  let options: Partial<VerifyOptions> | undefined;

  if (
    setOrOptions !== null &&
    setOrOptions !== undefined &&
    typeof setOrOptions === "object" &&
    "status" in setOrOptions
  ) {
    set = setOrOptions;
    options = maybeOptions;
  } else if (setOrOptions) {
    options = setOrOptions as Partial<VerifyOptions>;
  }

  try {
    const verified = await verifyAuthSessionToken<TPayload>(
      authorization,
      options,
    );
    return verified.payload;
  } catch (error) {
    if (set) set.status = 401;
    throw error;
  }
}
