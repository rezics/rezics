import {
  apiTokenDTOSchema,
  apiTokenListResponseSchema,
  BasicAdminPermission,
  createApiTokenResponseSchema,
  createApiTokenSchema,
  DispatchScope,
  updateApiTokenSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { prisma } from "#/prisma/client";
import { authMacro } from "@/middleware";
import { signRezicsSessionToken } from "@/session/jwt/jwt.service";
import { bookRoute } from "./token.book.api";
import { tokenService } from "./token.service";
import { userRoute } from "./token.user.api";

// Token-auth book & user routes (independent auth via API token header)
const tokenExternalRoutes = new Elysia({ prefix: "/token" })
  .use(bookRoute)
  .use(userRoute);

// Token-auth session exchange route
const tokenSessionRoute = new Elysia({ prefix: "/token" }).post(
  "/session",
  async ({ headers, set }) => {
    const { userId, scopes } = await tokenService.authenticateFromHeader(
      headers.authorization,
      { status: set.status as number | undefined },
    );

    if (
      !tokenService.hasScope(
        scopes,
        DispatchScope.DOMAIN,
        DispatchScope.SESSION,
      )
    ) {
      set.status = 403;
      throw new Error(
        "Forbidden: token lacks dispatch:rezics-server-session scope",
      );
    }

    const user = await prisma.user.findUnique({
      where: { unitId: userId },
      select: { unitId: true, permission: true },
    });

    if (!user) {
      set.status = 404;
      throw new Error("User not found");
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
    headers: t.Object(
      { authorization: t.String() },
      { additionalProperties: true },
    ),
    detail: {
      summary: "Exchange API token for session JWT",
      description:
        "Exchange a valid API token with dispatch:rezics-server-session scope for a short-lived rezics-session-token JWT",
      tags: ["Token", "Dispatch"],
    },
  },
);

// Owner-authenticated token management routes
const tokenManagementRoutes = new Elysia({ prefix: "/token" })
  .use(authMacro)
  .get(
    "/tokens",
    async ({ identity, set }) => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: Cannot list tokens");
      }
      const tokens = await tokenService.listTokens(identity.userId);
      return { tokens };
    },
    {
      requireLogin: true,
      detail: {
        summary: "List API tokens",
        description: "List non-revoked API tokens for the current user",
        tags: ["Token", "Token Management"],
      },
      response: apiTokenListResponseSchema,
    },
  )
  .post(
    "/tokens",
    async ({ identity, set, body, request }) => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: Cannot create token");
      }

      const ip =
        request.headers.get("x-forwarded-for") ??
        request.headers.get("x-real-ip") ??
        null;
      const userAgent = request.headers.get("user-agent") ?? null;

      const { token, tokenInfo } = await tokenService.createToken(
        identity.userId,
        body,
        { ip, userAgent },
      );

      return { token, tokenInfo };
    },
    {
      requireLogin: true,
      body: createApiTokenSchema,
      response: createApiTokenResponseSchema,
      detail: {
        summary: "Create API token",
        description:
          "Create a new API token for the current user. The raw token is returned once.",
        tags: ["Token", "Token Management"],
      },
    },
  )
  .put(
    "/tokens/:id",
    async ({ identity, set, params, body }) => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: Cannot update token");
      }
      return tokenService.updateToken(identity.userId, params.id, body);
    },
    {
      requireLogin: true,
      params: t.Object({ id: t.String() }),
      body: updateApiTokenSchema,
      response: apiTokenDTOSchema,
      detail: {
        summary: "Update API token",
        description:
          "Update name, scopes, or expiration time of an existing API token",
        tags: ["Token", "Token Management"],
      },
    },
  )
  .delete(
    "/tokens/:id",
    async ({ identity, set, params }) => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: Cannot revoke token");
      }
      await tokenService.revokeToken(identity.userId, params.id);
      return { message: "Token revoked successfully" };
    },
    {
      requireLogin: true,
      params: t.Object({ id: t.String() }),
      detail: {
        summary: "Revoke API token",
        description: "Soft-revoke an API token so it can no longer be used",
        tags: ["Token", "Token Management"],
      },
    },
  );

export const tokenApi = new Elysia()
  .use(tokenExternalRoutes)
  .use(tokenSessionRoute)
  .use(tokenManagementRoutes);
