import type { Prisma } from "#/prisma/client";

// Attribution with entity (and entity's unit + translations)
export type AttributionWithRelations = Prisma.AttributionGetPayload<{
  include: typeof attributionInclude;
}>;

export const attributionInclude = {
  entity: {
    include: {
      entity: true,
      translations: true,
    },
  },
} satisfies Prisma.AttributionInclude;
