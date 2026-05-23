import type { Prisma } from "#/prisma/client";
import { publicUserSelect } from "@/utils/sanitizeUser";

/**
 * Prisma include for post relations.
 */
export const postInclude = {
  unit: {
    include: {
      user: { select: publicUserSelect },
    },
  },
} satisfies Prisma.PostInclude;

/**
 * Internal post type with relations.
 *
 * Post has its own `content` field (fast path, no UnitTranslation),
 * but still links to Unit for user/reaction data.
 */
export type PostWithRelations = Prisma.PostGetPayload<{
  include: typeof postInclude;
}>;
