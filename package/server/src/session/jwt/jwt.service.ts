import type {
  RezicsProfileSetupClaims,
  RezicsSessionClaims,
} from "@rezics/contract";
import {
  createLocalJWKSet,
  importJWK,
  type JWK,
  jwtVerify,
  SignJWT,
} from "jose";
import { env } from "@/env";
import { getJwtService } from "@/jwt/jwtServiceCache";

const ISSUER = "rezics-server";
const DEFAULT_TTL_SECONDS = 900;
const DEFAULT_PROFILE_SETUP_TTL_SECONDS = 900;

export async function getMainSessionPublicJwks() {
  const service = await getJwtService("server-local").catch(() => null);
  if (!service) {
    return { keys: [] };
  }
  return {
    keys: service.jwks.map((k) => k.publicJwk),
  };
}

export async function signRezicsSessionToken(claims: {
  userId: string;
  permission: { role: string };
}): Promise<string> {
  const service = await getJwtService("server-local");
  const key = service.jwks[0];
  if (!key) {
    throw new Error("No signing key available for server-local JWT service");
  }

  const ttl = env.MAIN_SESSION_JWT_TTL_SECONDS
    ? Number(env.MAIN_SESSION_JWT_TTL_SECONDS)
    : DEFAULT_TTL_SECONDS;

  const now = Math.floor(Date.now() / 1000);
  const privateKey = await importJWK(key.privateJwk, "ES256");

  return new SignJWT({
    tokenType: "member-session",
    sub: claims.userId,
    userId: claims.userId,
    role: claims.permission.role,
    permission: claims.permission,
  })
    .setProtectedHeader({ alg: "ES256", kid: key.kid })
    .setIssuer(ISSUER)
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .sign(privateKey);
}

export async function verifyRezicsSessionToken(
  token: string,
): Promise<RezicsSessionClaims | null> {
  try {
    const raw = token.startsWith("Bearer ") ? token.slice(7) : token;
    const service = await getJwtService("server-local");
    const jwks = createLocalJWKSet({
      keys: service.jwks.map((k) => k.publicJwk as unknown as JWK),
    });

    const { payload } = await jwtVerify(raw, jwks, {
      issuer: ISSUER,
      clockTolerance: 5,
    });

    if (
      payload.tokenType !== "member-session" ||
      !payload.sub ||
      !payload.userId ||
      !payload.permission
    ) {
      return null;
    }

    return payload as unknown as RezicsSessionClaims;
  } catch {
    return null;
  }
}

export async function signRezicsProfileSetupToken(claims: {
  userId: string;
  ttlSeconds?: number;
}): Promise<string> {
  const service = await getJwtService("server-local");
  const key = service.jwks[0];
  if (!key) {
    throw new Error("No signing key available for server-local JWT service");
  }

  const ttl = claims.ttlSeconds ?? DEFAULT_PROFILE_SETUP_TTL_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  const privateKey = await importJWK(key.privateJwk, "ES256");

  return new SignJWT({
    tokenType: "profile-setup",
    purpose: "profile-setup",
    sub: claims.userId,
    userId: claims.userId,
  })
    .setProtectedHeader({ alg: "ES256", kid: key.kid })
    .setIssuer(ISSUER)
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .sign(privateKey);
}

export async function verifyRezicsProfileSetupToken(
  token: string,
): Promise<RezicsProfileSetupClaims | null> {
  try {
    const raw = token.startsWith("Bearer ") ? token.slice(7) : token;
    const service = await getJwtService("server-local");
    const jwks = createLocalJWKSet({
      keys: service.jwks.map((k) => k.publicJwk as unknown as JWK),
    });

    const { payload } = await jwtVerify(raw, jwks, {
      issuer: ISSUER,
      clockTolerance: 5,
    });

    if (
      payload.tokenType !== "profile-setup" ||
      payload.purpose !== "profile-setup" ||
      !payload.sub ||
      !payload.userId
    ) {
      return null;
    }

    return payload as unknown as RezicsProfileSetupClaims;
  } catch {
    return null;
  }
}
