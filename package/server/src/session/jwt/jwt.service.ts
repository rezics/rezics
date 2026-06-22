import type {
  RezicsProfileSetupClaims,
  RezicsSessionClaims,
} from "@rezics/contract";
import {
  type JWTPayload,
  createLocalJWKSet,
  importJWK,
  jwtVerify,
  SignJWT,
} from "jose";
import { env } from "@/env";
import { getJwtService } from "@/jwt/jwtServiceCache";

const ISSUER = "rezics-server";
const DEFAULT_TTL_SECONDS = 900;
const DEFAULT_PROFILE_SETUP_TTL_SECONDS = 900;

// Type predicates: narrow jose JWTPayload (index-sig `unknown`) to our contract claims.
// 类型谓词：将 jose JWTPayload（索引签名 `unknown`）窄化为契约 claims 类型。
function isSessionClaims(p: JWTPayload): p is JWTPayload & RezicsSessionClaims {
  const perm = p.permission;
  return (
    p.tokenType === "member-session" &&
    typeof p.sub === "string" &&
    typeof p.userId === "string" &&
    typeof perm === "object" &&
    perm !== null &&
    "role" in perm &&
    typeof perm.role === "string"
  );
}

function isProfileSetupClaims(
  p: JWTPayload,
): p is JWTPayload & RezicsProfileSetupClaims {
  return (
    p.tokenType === "profile-setup" &&
    p.purpose === "profile-setup" &&
    typeof p.sub === "string" &&
    typeof p.userId === "string"
  );
}

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
      keys: service.jwks.map((k) => k.publicJwk),
    });

    const { payload } = await jwtVerify(raw, jwks, {
      issuer: ISSUER,
      clockTolerance: 5,
    });

    if (!isSessionClaims(payload)) {
      return null;
    }

    return payload;
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
      keys: service.jwks.map((k) => k.publicJwk),
    });

    const { payload } = await jwtVerify(raw, jwks, {
      issuer: ISSUER,
      clockTolerance: 5,
    });

    if (!isProfileSetupClaims(payload)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
