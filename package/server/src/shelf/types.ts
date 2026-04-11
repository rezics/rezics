import type { Prisma } from "#/prisma/client";

// Prisma include for shelf detail (with items + reviews)
export const shelfInclude = {
  unit: {
    include: {
      user: true,
      translations: true,
      reactionSummaries: true,
      unitTags: { orderBy: { score: "desc" as const } },
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
      reviews: true,
    },
  },
} satisfies Prisma.ShelfInclude;

export type ShelfWithRelations = Prisma.ShelfGetPayload<{
  include: typeof shelfInclude;
}>;

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
      unitTags: { orderBy: { score: "desc" as const } },
    },
  },
  _count: { select: { items: true } },
} satisfies Prisma.ShelfSelect;

export type ShelfListSelected = Prisma.ShelfGetPayload<{
  select: typeof shelfListSelect;
}>;

// Include for shelf items listing with pagination
export const shelfItemInclude = {
  item: {
    include: {
      user: true,
      translations: true,
    },
  },
  reviews: true,
} satisfies Prisma.ShelfItemInclude;

export type ShelfItemWithRelations = Prisma.ShelfItemGetPayload<{
  include: typeof shelfItemInclude;
}>;
