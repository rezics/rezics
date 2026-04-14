import {
  createLocalJWKSet,
  importJWK,
  jwtVerify,
  SignJWT,
  type JWK,
} from "jose";
import type { RezicsSessionClaims } from "@rezics/contract";
import { getJwtService } from "@/jwt/jwtServiceCache";
import { env } from "@/env";

const ISSUER = "rezics-server";
const DEFAULT_TTL_SECONDS = 900;

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
  unitId: string;
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
    sub: claims.unitId,
    unitId: claims.unitId,
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

    if (!payload.unitId || !payload.permission) {
      return null;
    }

    return payload as unknown as RezicsSessionClaims;
  } catch {
    return null;
  }
}
