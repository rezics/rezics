// Type only used in server, otherwise use contract

import type { Prisma } from "#/prisma/client";
import { publicUserSelect } from "@/utils/sanitizeUser";

/**
 * Prisma include for unit relations
 */
export const unitInclude = {
  user: { select: publicUserSelect },
  translations: true,
  supportLanguages: true,
} satisfies Prisma.UnitInclude;

/**
 * Internal Unit type with relations
 */
export type UnitWithRelations = Prisma.UnitGetPayload<{
  include: typeof unitInclude;
}>;
