import { Elysia, t } from "elysia";
import { prisma } from "#/prisma/client";
import { syncUserToMeili } from "@/meili/user/sync";
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
      const { unitId, slug, name } = body;
      const finalSlug = slug?.trim() || unitId;
      const finalName = name?.trim() || finalSlug;

      await prisma.user.upsert({
        where: { unitId },
        update: {},
        create: {
          unitId,
          slug: finalSlug,
          name: finalName,
          joinDate: new Date(),
        },
      });

      await syncUserToMeili(unitId).catch(() => {});

      // Fire-and-forget: join user to default realm
      const defaultRealmId = getDefaultRealmId();
      if (defaultRealmId) {
        prisma.realmMember
          .create({
            data: {
              realmUnitId: defaultRealmId,
              userId: unitId,
              roleKey: "member",
            },
          })
          .catch((err: unknown) => {
            // Silently ignore duplicate membership or other errors
            console.log(
              `[provision] auto-join default realm failed for ${unitId}:`,
              err instanceof Error ? err.message : err,
            );
          });
      }

      return { ok: true };
    },
    {
      body: t.Object({
        unitId: t.String(),
        slug: t.Optional(t.String()),
        name: t.Optional(t.String()),
      }),
      detail: {
        summary: "Provision user",
        description:
          "Create or update a user record from auth service provisioning",
        tags: ["Internal"],
      },
    },
  );
