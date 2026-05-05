import type { AuthSessionTokenClaims } from "@rezics/contract";
import { TokenTransportHeader } from "@rezics/contract";
import { JwtAlgorithm, verifyBearerToken } from "@rezics/jwt";
import { Elysia, status } from "elysia";
import { prisma } from "#/prisma/client";
import { getJwtService } from "@/jwt/jwtServiceCache";
import { userService } from "@/user/service/user.service";
import {
  getMainSessionPublicJwks,
  signRezicsSessionToken,
} from "./jwt/jwt.service.ts";

export const sessionApi = new Elysia({ prefix: "/session" })
  .post(
    "/exchange",
    async ({ headers }) => {
      const authToken = (headers as Record<string, string | undefined>)[
        TokenTransportHeader.AUTH_SESSION_EXCHANGE.toLowerCase()
      ];

      if (!authToken) {
        return status(401, "Unauthorized: Missing x-auth-session-token header");
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

      /**
       * `sub` from the auth JWT maps to `unitId` in the server's user model.
       * The `unitId` claim is a legacy alias; `sub` is the canonical identifier.
       */
      const unitId = claims.unitId || claims.sub;
      if (!unitId) {
        return status(401, "Unauthorized: Token missing unitId claim");
      }

      let user = await prisma.user.findUnique({
        where: { unitId },
        select: { unitId: true, permission: true },
      });

      if (!user) {
        if (claims.email_verified === false) {
          return status(403, "Email not verified");
        }

        if (!claims.slug) {
          return status(403, "Registration incomplete");
        }

        const provisioned = await userService.provisionFromJwt({
          unitId,
          slug: claims.slug,
          name: claims.name,
        });

        user = {
          unitId: provisioned.unitId,
          permission: provisioned.permission,
        };
      }

      const dbPermission = user.permission as
        | { role?: string[] }
        | null
        | undefined;
      const role = dbPermission?.role?.[0] ?? "MEMBER";

      const token = await signRezicsSessionToken({
        userId: user.unitId,
        permission: { role },
      });

      return { token };
    },
    {
      detail: {
        summary: "Exchange auth token for session token",
        description:
          "Verify an upstream auth session token and issue a rezics session token with the user's role",
        tags: ["Session"],
      },
    },
  )
  .get("/jwks", async () => getMainSessionPublicJwks(), {
    detail: {
      summary: "Publish main-server JWKS (legacy)",
      description:
        "Legacy JWKS endpoint. Use `/.well-known/jwks.json` instead.",
      tags: ["Session"],
      deprecated: true,
    },
  });
