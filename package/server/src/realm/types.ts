import type { Prisma } from "#/prisma/client";

// Internal realm type with relations
export type RealmWithRelations = Prisma.RealmGetPayload<{
  include: typeof realmInclude;
}>;

// Prisma include for realm relations
export const realmInclude = {
  unit: {
    include: {
      user: true,
      translations: true,
      reactionSummaries: true,
    },
  },
  members: true,
} satisfies Prisma.RealmInclude;

// Lighter select for list queries (no members)
export const realmListSelect = {
  unitId: true,
  isPublic: true,
  isOfficial: true,
  memberCount: true,
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
} satisfies Prisma.RealmSelect;

export type RealmListSelected = Prisma.RealmGetPayload<{
  select: typeof realmListSelect;
}>;
