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
    "/users/sync",
    async ({ body }) => {
      const { unitId, name, slug, avatar } = body;

      const existing = await prisma.user.findUnique({
        where: { id: unitId },
        select: { id: true },
      });

      if (!existing) {
        return { ok: true };
      }

      const updateData: Record<string, string> = {};
      if (name !== undefined) updateData.name = name;
      if (slug !== undefined) updateData.slug = slug;
      if (avatar !== undefined) updateData.image = avatar;

      if (Object.keys(updateData).length > 0) {
        await prisma.user.update({
          where: { id: unitId },
          data: updateData,
        });
      }

      return { ok: true };
    },
    {
      body: t.Object({
        unitId: t.String(),
        name: t.Optional(t.String()),
        slug: t.Optional(t.String()),
        avatar: t.Optional(t.String()),
      }),
    },
  );
