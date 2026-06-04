import { randomUUID } from "node:crypto";
import { Elysia, t } from "elysia";
import {
  cleanupStaleRegistrations,
  createImpersonationSession,
  deleteAuthRegistration,
  deleteAuthSessionForUser,
  deleteAuthSessionsForUser,
  findAuthUserForRegistrationCancel,
  findAuthUserId,
  findImpersonationUsers,
  findStaleUnverifiedUsers,
  findVerifiedFactsUser,
  listActiveAuthSessions,
  updateAuthUserName,
} from "../auth/storage";
import { env } from "../env";

export const authInternalApi = new Elysia({ prefix: "/internal" })
  .onBeforeHandle(({ headers, set }) => {
    const secret = headers["x-internal-secret"];
    if (
      !env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET ||
      secret !== env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET
    ) {
      set.status = 403;
      return { error: "Forbidden: Invalid or missing internal secret" };
    }
  })
  .post(
    "/registration/cancel",
    async ({ body, set }) => {
      const user = await findAuthUserForRegistrationCancel(body.authUserId);

      if (!user) {
        return { success: true, canceled: false };
      }

      if (user.emailVerified && !body.allowVerified) {
        set.status = 409;
        return {
          success: false,
          canceled: false,
          error: {
            code: "VERIFIED_ACCOUNT_REQUIRES_MAIN_APPROVAL",
            message:
              "Verified auth accounts can only be canceled by a main-owned pending-registration flow.",
          },
        };
      }

      await deleteAuthRegistration(user);

      return { success: true, canceled: true };
    },
    {
      body: t.Object({
        authUserId: t.String(),
        allowVerified: t.Optional(t.Boolean()),
      }),
    },
  )
  .post(
    "/registration/verified-facts",
    async ({ body, set }) => {
      const user = await findVerifiedFactsUser(body.authUserId);

      if (!user) {
        set.status = 404;
        return {
          success: false,
          error: {
            code: "AUTH_USER_NOT_FOUND",
            message: "Auth user was not found",
          },
        };
      }

      if (!user.emailVerified) {
        set.status = 403;
        return {
          success: false,
          error: {
            code: "REGISTRATION_NOT_VERIFIED",
            message: "Registration verification is not complete",
          },
        };
      }

      const trustedProviderId = user.accounts.find(
        (account) => account.providerId !== "credential",
      )?.providerId;

      return {
        success: true,
        facts: {
          authUserId: user.id,
          email: user.email,
          emailVerified: true,
          verifiedAt: user.updatedAt.toISOString(),
          verificationSource: trustedProviderId ?? "email-otp",
          trustedProviderId,
        },
      };
    },
    {
      body: t.Object({
        authUserId: t.String(),
      }),
    },
  )
  .post(
    "/users/project-slug",
    async ({ body, set }) => {
      const user = await findAuthUserId(body.authUserId);

      if (!user) {
        set.status = 404;
        return {
          success: false,
          error: {
            code: "AUTH_USER_NOT_FOUND",
            message: "Auth user was not found",
          },
        };
      }

      await updateAuthUserName(body.authUserId, body.slug);

      return { success: true };
    },
    {
      body: t.Object({
        authUserId: t.String(),
        slug: t.String({ minLength: 1 }),
      }),
    },
  )
  .post(
    "/users/impersonate",
    async ({ body, set }) => {
      const { actor, target } = await findImpersonationUsers(
        body.actorAuthUserId,
        body.targetAuthUserId,
      );

      if (!actor) {
        set.status = 404;
        return {
          success: false,
          error: {
            code: "ACTOR_AUTH_USER_NOT_FOUND",
            message: "Actor auth user was not found",
          },
        };
      }
      if (actor.role !== "owner") {
        set.status = 403;
        return {
          success: false,
          error: {
            code: "OWNER_REQUIRED",
            message: "Only auth owners may start impersonation.",
          },
        };
      }
      if (!target) {
        set.status = 404;
        return {
          success: false,
          error: {
            code: "TARGET_AUTH_USER_NOT_FOUND",
            message: "Target auth user was not found",
          },
        };
      }
      if (target.banned) {
        set.status = 409;
        return {
          success: false,
          error: {
            code: "TARGET_AUTH_USER_BANNED",
            message: "Banned auth users cannot be impersonated.",
          },
        };
      }

      const now = new Date();
      const durationSeconds = body.durationSeconds ?? 900;
      const expiresAt = new Date(now.getTime() + durationSeconds * 1000);
      const token = `${randomUUID()}${randomUUID()}`;
      const session = await createImpersonationSession({
        userId: target.id,
        token,
        expiresAt,
        impersonatedBy: actor.id,
      });

      return {
        success: true,
        session: {
          id: session.id,
          token: session.token,
          authUserId: session.userId,
          impersonatedBy: session.impersonatedBy,
          startedAt: session.createdAt.toISOString(),
          expiresAt: session.expiresAt.toISOString(),
          durationSeconds,
        },
      };
    },
    {
      body: t.Object({
        actorAuthUserId: t.String(),
        targetAuthUserId: t.String(),
        reason: t.String({ minLength: 1 }),
        durationSeconds: t.Optional(t.Number({ minimum: 60, maximum: 3600 })),
      }),
    },
  )
  .post(
    "/users/list-sessions",
    async ({ body, set }) => {
      const user = await findAuthUserId(body.authUserId);

      if (!user) {
        set.status = 404;
        return {
          success: false,
          error: {
            code: "AUTH_USER_NOT_FOUND",
            message: "Auth user was not found",
          },
        };
      }

      const sessions = await listActiveAuthSessions(user.id);

      return {
        success: true,
        sessions: sessions.map((session) => ({
          id: session.id,
          authUserId: session.userId,
          createdAt: session.createdAt.toISOString(),
          updatedAt: session.updatedAt.toISOString(),
          expiresAt: session.expiresAt.toISOString(),
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          impersonatedBy: session.impersonatedBy,
        })),
      };
    },
    {
      body: t.Object({
        authUserId: t.String(),
      }),
    },
  )
  .post(
    "/users/revoke-session",
    async ({ body, set }) => {
      const user = await findAuthUserId(body.authUserId);

      if (!user) {
        set.status = 404;
        return {
          success: false,
          error: {
            code: "AUTH_USER_NOT_FOUND",
            message: "Auth user was not found",
          },
        };
      }

      const revokedSessions = await deleteAuthSessionForUser(
        user.id,
        body.sessionId,
      );

      return {
        success: true,
        revokedSessions,
      };
    },
    {
      body: t.Object({
        authUserId: t.String(),
        sessionId: t.String(),
        reason: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/users/revoke-sessions",
    async ({ body, set }) => {
      const user = await findAuthUserId(body.authUserId);

      if (!user) {
        set.status = 404;
        return {
          success: false,
          error: {
            code: "AUTH_USER_NOT_FOUND",
            message: "Auth user was not found",
          },
        };
      }

      const revokedSessions = await deleteAuthSessionsForUser(user.id);

      return {
        success: true,
        revokedSessions,
      };
    },
    {
      body: t.Object({
        authUserId: t.String(),
        reason: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/registration/cleanup-stale",
    async ({ body }) => {
      const olderThanHours = body.olderThanHours ?? 24 * 7;
      const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
      const users = await findStaleUnverifiedUsers(cutoff);

      const userIds = users.map((user) => user.id);
      const emails = users.map((user) => user.email);

      if (userIds.length === 0) {
        return { success: true, deleted: 0, cutoff: cutoff.toISOString() };
      }

      await cleanupStaleRegistrations({ userIds, emails });

      return {
        success: true,
        deleted: userIds.length,
        cutoff: cutoff.toISOString(),
      };
    },
    {
      body: t.Object({
        olderThanHours: t.Optional(t.Number({ minimum: 1 })),
      }),
    },
  );
