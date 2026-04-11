import type { Prisma } from "#/prisma/client";

// Internal shelf type with relations
export type ShelfWithRelations = Prisma.ShelfGetPayload<{
  include: typeof shelfInclude;
}>;

// Prisma include for shelf relations
export const shelfInclude = {
  unit: {
    include: {
      user: true,
      translations: true,
      reactionSummaries: true,
    },
  },
  items: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      item: {
        include: {
          user: true,
          translations: true,
        },
      },
      reviewPost: true,
    },
  },
} satisfies Prisma.ShelfInclude;

// Lighter select for list queries (no items)
export const shelfListSelect = {
  unitId: true,
  kindKey: true,
  extra: true,
  createdAt: true,
  updatedAt: true,
  unit: {
    select: {
      id: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { unitId: true, slug: true, name: true, avatar: true } },
      translations: true,
      reactionSummaries: true,
    },
  },
} satisfies Prisma.ShelfSelect;

export type ShelfListSelected = Prisma.ShelfGetPayload<{
  select: typeof shelfListSelect;
}>;
