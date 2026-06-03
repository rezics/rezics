import { randomUUID } from "node:crypto";
import { Elysia, t } from "elysia";
import { prisma } from "../auth/prisma";
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
      const user = await prisma.user.findUnique({
        where: { id: body.authUserId },
        select: { id: true, email: true, emailVerified: true },
      });

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

      await prisma.$transaction([
        prisma.oAuthAccessToken.deleteMany({ where: { userId: user.id } }),
        prisma.oAuthRefreshToken.deleteMany({ where: { userId: user.id } }),
        prisma.oAuthConsent.deleteMany({ where: { userId: user.id } }),
        prisma.session.deleteMany({ where: { userId: user.id } }),
        prisma.account.deleteMany({ where: { userId: user.id } }),
        prisma.verification.deleteMany({
          where: {
            OR: [
              { identifier: user.email },
              { identifier: user.id },
              { identifier: { contains: user.email } },
            ],
          },
        }),
        prisma.user.delete({ where: { id: user.id } }),
      ]);

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
      const user = await prisma.user.findUnique({
        where: { id: body.authUserId },
        select: {
          id: true,
          email: true,
          emailVerified: true,
          updatedAt: true,
          accounts: { select: { providerId: true } },
        },
      });

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
      const user = await prisma.user.findUnique({
        where: { id: body.authUserId },
        select: { id: true },
      });

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

      await prisma.user.update({
        where: { id: body.authUserId },
        data: { name: body.slug },
      });

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
      const [actor, target] = await Promise.all([
        prisma.user.findUnique({
          where: { id: body.actorAuthUserId },
          select: { id: true, role: true },
        }),
        prisma.user.findUnique({
          where: { id: body.targetAuthUserId },
          select: { id: true, role: true, banned: true },
        }),
      ]);

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
      const session = await prisma.session.create({
        data: {
          userId: target.id,
          token,
          expiresAt,
          impersonatedBy: actor.id,
        },
        select: {
          id: true,
          token: true,
          userId: true,
          expiresAt: true,
          impersonatedBy: true,
          createdAt: true,
        },
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
      const user = await prisma.user.findUnique({
        where: { id: body.authUserId },
        select: { id: true },
      });

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

      const sessions = await prisma.session.findMany({
        where: { userId: user.id, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          userId: true,
          expiresAt: true,
          ipAddress: true,
          userAgent: true,
          impersonatedBy: true,
          createdAt: true,
          updatedAt: true,
        },
      });

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
      const user = await prisma.user.findUnique({
        where: { id: body.authUserId },
        select: { id: true },
      });

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

      const deleted = await prisma.session.deleteMany({
        where: { id: body.sessionId, userId: user.id },
      });

      return {
        success: true,
        revokedSessions: deleted.count,
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
      const user = await prisma.user.findUnique({
        where: { id: body.authUserId },
        select: { id: true },
      });

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

      const deleted = await prisma.session.deleteMany({
        where: { userId: user.id },
      });

      return {
        success: true,
        revokedSessions: deleted.count,
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
      const users = await prisma.user.findMany({
        where: {
          emailVerified: false,
          createdAt: { lt: cutoff },
        },
        select: { id: true, email: true },
      });

      const userIds = users.map((user) => user.id);
      const emails = users.map((user) => user.email);

      if (userIds.length === 0) {
        return { success: true, deleted: 0, cutoff: cutoff.toISOString() };
      }

      await prisma.$transaction([
        prisma.oAuthAccessToken.deleteMany({
          where: { userId: { in: userIds } },
        }),
        prisma.oAuthRefreshToken.deleteMany({
          where: { userId: { in: userIds } },
        }),
        prisma.oAuthConsent.deleteMany({ where: { userId: { in: userIds } } }),
        prisma.session.deleteMany({ where: { userId: { in: userIds } } }),
        prisma.account.deleteMany({ where: { userId: { in: userIds } } }),
        prisma.verification.deleteMany({
          where: {
            OR: [
              { identifier: { in: userIds } },
              { identifier: { in: emails } },
              ...emails.map((email) => ({
                identifier: { contains: email },
              })),
            ],
          },
        }),
        prisma.user.deleteMany({ where: { id: { in: userIds } } }),
      ]);

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
