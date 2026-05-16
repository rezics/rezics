import type { Prisma } from "#/prisma/client";

/**
 * Prisma include shape for hydrating an Entity row with everything the
 * mapper needs: the parent Unit (for slug, status, visibility, userId,
 * timestamps) and the Unit's translations (for the DTO's `translations`
 * array).
 */
export const entityInclude = {
  unit: {
    include: {
      translations: true,
    },
  },
} satisfies Prisma.EntityInclude;

export type EntityWithRelations = Prisma.EntityGetPayload<{
  include: typeof entityInclude;
}>;
