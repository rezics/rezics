import {
  type AuthIdentityTokenClaims,
  NormalizedTokenName,
  TokenTransportHeader,
} from "@rezics/contract";
import { createJwtVerifier, JwtAlgorithm } from "@rezics/jwt";
import { Elysia } from "elysia";
import { env } from "../env";

const verifier = createJwtVerifier<AuthIdentityTokenClaims>({
  issuer: env.AUTH_ISSUER,
  audience: env.AUTH_JWT_AUDIENCE,
  jwksUrl: env.AUTH_JWKS_URL,
  algorithm: JwtAlgorithm.ES256,
  tokenName: NormalizedTokenName.AUTH_IDENTITY,
  clockToleranceSeconds: 5,
  requiredScope: "user",
  enforceTransport: true,
});

export const authMacro = new Elysia({ name: "macro/notify-auth" }).macro(
  "requireUser",
  {
    async resolve({ headers }) {
      const headerKey = TokenTransportHeader.AUTHORIZATION.toLowerCase();
      const raw = headers[headerKey];

      try {
        const result = await verifier(raw);
        const userId = result.payload.unitId || result.payload.sub;
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

export async function verifyJwtToken(
  token: string,
): Promise<{ userId: string } | null> {
  try {
    const result = await verifier(`Bearer ${token}`);
    const userId = result.payload.unitId || result.payload.sub;
    if (!userId) return null;
    return { userId };
  } catch {
    return null;
  }
}
