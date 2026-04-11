import { Elysia, t } from "elysia";
import { prisma } from "#/prisma/client";
import { env } from "../env";

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
    },
  );
