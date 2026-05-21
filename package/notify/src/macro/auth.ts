import {
  NormalizedTokenName,
  type RezicsSessionClaims,
  TokenTransportHeader,
} from "@rezics/contract";
import { createJwtVerifier, JwtAlgorithm } from "@rezics/jwt";
import { Elysia, status } from "elysia";
import { env } from "../env";

const SESSION_COOKIE_NAME = "rezics-session-token";

const verifier = createJwtVerifier<RezicsSessionClaims>({
  issuer: env.SERVER_ISSUER,
  jwksUrl: env.SERVER_JWKS_URL,
  algorithm: JwtAlgorithm.ES256,
  tokenName: NormalizedTokenName.REZICS_SESSION,
  clockToleranceSeconds: 5,
  enforceTransport: true,
});

export function readCookie(
  cookieHeader: string | undefined,
  name: string,
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }
  return null;
}

/**
 * Resolve the session token from either the Authorization header (Bearer)
 * or the rezics-session-token cookie. Authorization takes precedence when both
 * are present.
 *
 * Returns the raw token string (no "Bearer " prefix) or null.
 */
export function resolveSessionToken(
  authorization: string | undefined,
  cookieHeader: string | undefined,
): string | null {
  if (authorization) {
    const trimmed = authorization.trim();
    if (trimmed.toLowerCase().startsWith("bearer ")) {
      return trimmed.slice(7).trim();
    }
    return trimmed;
  }
  return readCookie(cookieHeader, SESSION_COOKIE_NAME);
}

export const authMacro = new Elysia({ name: "macro/notify-auth" }).macro(
  "requireUser",
  {
    async resolve({ headers }) {
      const authHeaderKey = TokenTransportHeader.AUTHORIZATION.toLowerCase();
      const authorization = headers[authHeaderKey];
      const cookieHeader = headers.cookie;
      const token = resolveSessionToken(authorization, cookieHeader);
      if (!token) {
        return status(401, "Unauthorized: Missing token");
      }

      try {
        const result = await verifier(`Bearer ${token}`);
        const userId = result.payload.userId || result.payload.sub;
        if (!userId) {
          return status(401, "Unauthorized: Missing user identity");
        }
        return { userId };
      } catch {
        return status(401, "Unauthorized: Invalid or missing token");
      }
    },
  },
);

export async function verifyJwtToken(
  token: string,
): Promise<{ userId: string } | null> {
  try {
    const result = await verifier(`Bearer ${token}`);
    const userId = result.payload.userId || result.payload.sub;
    if (!userId) return null;
    return { userId };
  } catch {
    return null;
  }
}
