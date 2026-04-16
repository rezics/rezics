import type { Prisma } from "#/prisma/client";

// Entity with unit and translations
export type EntityWithRelations = Prisma.EntityGetPayload<{
  include: typeof entityInclude;
}>;

export const entityInclude = {
  unit: {
    include: {
      translations: true,
    },
  },
} satisfies Prisma.EntityInclude;

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
