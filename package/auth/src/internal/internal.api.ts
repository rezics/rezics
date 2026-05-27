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
