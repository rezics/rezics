import type { Prisma } from "#/prisma/client";
import { publicUserSelect } from "@/utils/sanitizeUser";

// Prisma include for realm relations
export const realmInclude = {
  unit: {
    include: {
      user: { select: publicUserSelect },
      translations: true,
    },
  },
  members: true,
} satisfies Prisma.RealmInclude;

// Internal realm type with relations
export type RealmWithRelations = Prisma.RealmGetPayload<{
  include: typeof realmInclude;
}>;

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
      slug: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { unitId: true, slug: true, name: true, avatar: true } },
      translations: true,
    },
  },
} satisfies Prisma.RealmSelect;

export type RealmListSelected = Prisma.RealmGetPayload<{
  select: typeof realmListSelect;
}>;
