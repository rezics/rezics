import { Elysia, t } from "elysia";
import { authMacro } from "@/middleware";
import { prisma } from "#/prisma/client";

const MAX_KEYWORDS = 500;

export const keywordsRoute = new Elysia()
  .use(authMacro)
  .get(
    "/me/keywords",
    async ({ identity }) => {
      const user = await prisma.user.findUniqueOrThrow({
        where: { unitId: identity.unitId },
        select: { keywords: true },
      });
      return user.keywords;
    },
    {
      requireLogin: true,
      detail: {
        summary: "Get my keywords",
        description: "Get the current user's keyword vocabulary for autocomplete",
        tags: ["Users"],
      },
    },
  )
  .patch(
    "/me/keywords",
    async ({ body, identity, set }) => {
      const { add = [], remove = [] } = body;

      const user = await prisma.user.findUniqueOrThrow({
        where: { unitId: identity.unitId },
        select: { keywords: true },
      });

      let keywords = user.keywords;

      // Remove first
      if (remove.length > 0) {
        const removeSet = new Set(remove);
        keywords = keywords.filter((k) => !removeSet.has(k));
      }

      // Then add
      if (add.length > 0) {
        const existing = new Set(keywords);
        const toAdd = add.filter((k) => !existing.has(k));
        if (keywords.length + toAdd.length > MAX_KEYWORDS) {
          set.status = 400;
          throw new Error(
            `Keyword vocabulary limit exceeded (max ${MAX_KEYWORDS}). Current: ${keywords.length}, trying to add: ${toAdd.length}.`,
          );
        }
        keywords = [...keywords, ...toAdd];
      }

      await prisma.user.update({
        where: { unitId: identity.unitId },
        data: { keywords },
      });

      return keywords;
    },
    {
      requireLogin: true,
      body: t.Object({
        add: t.Optional(t.Array(t.String())),
        remove: t.Optional(t.Array(t.String())),
      }),
      detail: {
        summary: "Update my keywords",
        description:
          "Add or remove keywords from the user's vocabulary (max 500)",
        tags: ["Users"],
      },
    },
  );
