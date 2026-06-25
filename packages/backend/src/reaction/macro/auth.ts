import {
  NormalizedTokenName,
  type RezicsSessionClaims,
  TokenTransportHeader,
} from "@rezics/contract";
import { createJwtVerifier, JwtAlgorithm } from "@/internal/jwt";
import { Elysia } from "elysia";
import { env } from "../env";

const bearerVerifier = createJwtVerifier<RezicsSessionClaims>({
  issuer: env.SERVER_ISSUER,
  jwksUrl: env.SERVER_JWKS_URL,
  algorithm: JwtAlgorithm.ES256,
  tokenName: NormalizedTokenName.REZICS_SESSION,
  clockToleranceSeconds: 5,
  enforceTransport: true,
});

const cookieVerifier = createJwtVerifier<RezicsSessionClaims>({
  issuer: env.SERVER_ISSUER,
  jwksUrl: env.SERVER_JWKS_URL,
  algorithm: JwtAlgorithm.ES256,
  tokenName: NormalizedTokenName.REZICS_SESSION,
  clockToleranceSeconds: 5,
  enforceTransport: false,
});

function getCookieToken(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;

  const prefix = `${NormalizedTokenName.REZICS_SESSION}=`;
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
}

export const authMacro = new Elysia({ name: "macro/reaction-auth" }).macro(
  "requireUser",
  {
    async resolve({ headers }) {
      const headerKey = TokenTransportHeader.AUTHORIZATION.toLowerCase();
      const raw = headers[headerKey];

      try {
        const result = raw
          ? await bearerVerifier(raw)
          : await cookieVerifier(getCookieToken(headers.cookie));
        const userId = result.payload.userId || result.payload.sub;
        if (!userId) {
          return new Response("Unauthorized: Missing user identity", {
            status: 401,
          }) as any;
        }
        return { userId };
      } catch {
        return new Response("Unauthorized: Invalid or missing token", {
          status: 401,
        }) as any;
      }
    },
  },
);
