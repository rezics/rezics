import type {
  Post,
  Prisma,
  Unit,
  User,
} from "#/prisma/client";

/**
 * Internal post type with relations.
 *
 * Post has its own `body` field (fast path, no UnitTranslation),
 * but still links to Unit for user/reaction data.
 */
export type PostWithRelations = Post & {
  unit: Unit & {
    user: User | null;
  };
};

/**
 * Prisma include for post relations.
 */
export const postInclude = {
  unit: {
    include: {
      user: true,
    },
  },
} satisfies Prisma.PostInclude;
