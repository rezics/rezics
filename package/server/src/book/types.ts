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
      attributions: {
        include: {
          entity: {
            include: { entity: true, translations: true },
          },
        },
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
