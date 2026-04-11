// Type only used in server, otherwise use contract

import type {
  Prisma,
  ReactionSummary,
  Unit,
  UnitSupportLanguage,
  UnitTranslation,
  User,
} from "#/prisma/client";

/**
 * Internal Unit type with relations
 */
export type UnitWithRelations = Unit & {
  user: User | null;
  translations: UnitTranslation[];
  supportLanguages: UnitSupportLanguage[];
  reactionSummaries: ReactionSummary[];
};

/**
 * Prisma include for unit relations
 */
export const unitInclude = {
  user: true,
  translations: true,
  supportLanguages: true,
  reactionSummaries: true,
} satisfies Prisma.UnitInclude;
