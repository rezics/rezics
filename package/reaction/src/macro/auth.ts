import {
  NormalizedTokenName,
  type RezicsSessionClaims,
  TokenTransportHeader,
} from "@rezics/contract";
import { createJwtVerifier, JwtAlgorithm } from "@rezics/jwt";
import { Elysia } from "elysia";
import { env } from "../env";

const verifier = createJwtVerifier<RezicsSessionClaims>({
  issuer: env.SERVER_ISSUER,
  jwksUrl: env.SERVER_JWKS_URL,
  algorithm: JwtAlgorithm.ES256,
  tokenName: NormalizedTokenName.REZICS_SESSION,
  clockToleranceSeconds: 5,
  enforceTransport: true,
});

export const authMacro = new Elysia({ name: "macro/reaction-auth" }).macro(
  "requireUser",
  {
    async resolve({ headers }) {
      const headerKey = TokenTransportHeader.AUTHORIZATION.toLowerCase();
      const raw = headers[headerKey];

      try {
        const result = await verifier(raw);
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
