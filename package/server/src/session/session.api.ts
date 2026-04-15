import type { AuthSessionTokenClaims } from "@rezics/contract";
import { TokenTransportHeader } from "@rezics/contract";
import { JwtAlgorithm, verifyBearerToken } from "@rezics/jwt";
import { Elysia, status } from "elysia";
import { prisma } from "#/prisma/client";
import { getJwtService } from "@/jwt/jwtServiceCache";
import {
  getMainSessionPublicJwks,
  signRezicsSessionToken,
} from "./jwt/jwt.service.ts";

export const sessionApi = new Elysia({ prefix: "/session" })
  .post("/exchange", async ({ headers }) => {
    const authToken = (headers as Record<string, string | undefined>)[
      TokenTransportHeader.AUTH_SESSION_EXCHANGE.toLowerCase()
    ];

    if (!authToken) {
      return status(
        401,
        "Unauthorized: Missing x-auth-session-token header",
      );
    }

    const authUpstream = await getJwtService("auth-upstream");

    let claims: AuthSessionTokenClaims;
    try {
      const result = await verifyBearerToken<AuthSessionTokenClaims>(
        authToken,
        {
          issuer: authUpstream.issuer,
          audience: authUpstream.audience,
          jwksUrl: authUpstream.jwksUrl,
          algorithm: JwtAlgorithm.ES256,
          enforceTransport: false,
        },
      );
      claims = result.payload;
    } catch {
      return status(401, "Unauthorized: Invalid or expired auth token");
    }

    const unitId = claims.unitId || claims.sub;
    if (!unitId) {
      return status(401, "Unauthorized: Token missing unitId claim");
    }

    const user = await prisma.user.findUnique({
      where: { unitId },
      select: { unitId: true, permission: true },
    });

    if (!user) {
      return status(404, "User not found");
    }

    const dbPermission = user.permission as
      | { role?: string[] }
      | null
      | undefined;
    const role = dbPermission?.role?.[0] ?? "MEMBER";

    const token = await signRezicsSessionToken({
      unitId: user.unitId,
      permission: { role },
    });

    return { token };
  }, {
    detail: {
      summary: "Exchange auth token for session token",
      description:
        "Verify an upstream auth session token and issue a rezics session token with the user's role",
      tags: ["Session"],
    },
  })
  .get("/jwks", async () => getMainSessionPublicJwks(), {
    detail: {
      summary: "Publish main-server JWKS (legacy)",
      description:
        "Legacy JWKS endpoint. Use `/.well-known/jwks.json` instead.",
      tags: ["Session"],
      deprecated: true,
    },
  });
