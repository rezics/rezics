// Type only used in server, otherwise use contract

import type {
  Prisma,
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
};

/**
 * Prisma include for unit relations
 */
export const unitInclude = {
  user: true,
  translations: true,
  supportLanguages: true,
} satisfies Prisma.UnitInclude;
