// Type only used in server, otherwise use contract

import type { Prisma } from "#/prisma/client";
import { publicUserSelect } from "@/utils/sanitizeUser";

/**
 * Prisma include for book relations
 */
export const bookInclude = {
  unit: {
    include: {
      user: { select: publicUserSelect },
      translations: true,
      supportLanguages: true,
      unitTags: {
        include: { tag: { include: { translations: true } } },
        orderBy: { score: "desc" as const },
      },
      personCredits: {
        include: { person: true },
        orderBy: { sortOrder: "asc" as const },
      },
      organizationCredits: {
        include: { organization: true },
        orderBy: { sortOrder: "asc" as const },
      },
    },
  },
} satisfies Prisma.BookInclude;

/**
 * Internal book type with relations
 */
export type BookWithRelations = Prisma.BookGetPayload<{
  include: typeof bookInclude;
}>;
