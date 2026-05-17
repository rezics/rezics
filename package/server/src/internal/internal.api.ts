import { Elysia, t } from "elysia";
import { prisma } from "#/prisma/client";
import { syncUserToMeili } from "@/meili/user/sync";
import { bootstrapSystemShelves } from "@/shelf/system-shelves";
import { env } from "../env";
import { getDefaultRealmId } from "../infra/default-realm";

export const internalApi = new Elysia({ prefix: "/internal" })
  .onBeforeHandle(({ headers, set }) => {
    const secret = headers["x-internal-secret"];
    if (!env.SERVER_INTERNAL_SECRET || secret !== env.SERVER_INTERNAL_SECRET) {
      set.status = 401;
      return { error: "Unauthorized: Invalid or missing internal secret" };
    }
  })
  .get(
    "/units/owner",
    async ({ query, set }) => {
      const unit = await prisma.unit.findUnique({
        where: { id: query.id },
        select: { userId: true },
      });

      if (!unit) {
        set.status = 404;
        return { error: "Unit not found" };
      }

      return { ownerId: unit.userId };
    },
    {
      query: t.Object({ id: t.String() }),
      detail: {
        summary: "Get unit owner",
        description: "Look up the owner of a unit by its ID",
        tags: ["Internal"],
      },
    },
  )
  .post(
    "/users/provision",
    async ({ body }) => {
      const { userId, slug, name } = body;
      const finalSlug = slug?.trim() || userId;
      const finalName = name?.trim() || finalSlug;

      await prisma.$transaction(async (tx) => {
        const existing = await tx.user.findUnique({
          where: { unitId: userId },
          select: { unitId: true },
        });
        if (existing) return;

        const { requireSlugScopeId } = await import("@/infra/slug-scopes");
        const userScope = requireSlugScopeId("user");
        await tx.unit.upsert({
          where: { id: userId },
          update: { slug: finalSlug, slugScope: userScope },
          create: {
            id: userId,
            type: "USER",
            slug: finalSlug,
            slugScope: userScope,
            status: "PUBLISHED",
            visibility: "PUBLIC",
            isLanguageNeutral: true,
          },
        });
        await tx.user.create({
          data: {
            unitId: userId,
            name: finalName,
            joinDate: new Date(),
          },
        });
        await bootstrapSystemShelves(userId, finalSlug, tx);
      });

      await syncUserToMeili(userId).catch(() => {});

      // Fire-and-forget: join user to default realm
      const defaultRealmId = getDefaultRealmId();
      if (defaultRealmId) {
        prisma.realmMember
          .create({
            data: {
              realmUnitId: defaultRealmId,
              userId,
              roleKey: "member",
            },
          })
          .catch((err: unknown) => {
            // Silently ignore duplicate membership or other errors
            console.log(
              `[provision] auto-join default realm failed for ${userId}:`,
              err instanceof Error ? err.message : err,
            );
          });
      }

      return { ok: true };
    },
    {
      body: t.Object({
        userId: t.String(),
        slug: t.Optional(t.String()),
        name: t.Optional(t.String()),
      }),
      detail: {
        summary: "Provision user for internal tooling",
        description:
          "Create or update a user record for non-registration internal tooling. Public registration uses /auth/account/materialize and /auth/account/profile-setup.",
        tags: ["Internal"],
      },
    },
  );
