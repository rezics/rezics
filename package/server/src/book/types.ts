// Type only used in server, otherwise use contract

import type {
  Book,
  OrgCredit,
  Organization,
  Person,
  PersonCredit,
  Prisma,
  ReactionSummary,
  Unit,
  UnitSupportLanguage,
  UnitTag,
  UnitTranslation,
  User,
} from "#/prisma/client";

/**
 * Internal book type with relations
 */
export type BookWithRelations = Book & {
  unit: Unit & {
    user: User | null;
    translations: UnitTranslation[];
    supportLanguages: UnitSupportLanguage[];
    reactionSummaries: ReactionSummary[];
    unitTags: (UnitTag & { tag: Unit & { translations: UnitTranslation[] } })[];
    personCredits: (PersonCredit & { person: Person })[];
    organizationCredits: (OrgCredit & { organization: Organization })[];
  };
};

/**
 * Prisma include for book relations
 */
export const bookInclude = {
  unit: {
    include: {
      user: true,
      translations: true,
      supportLanguages: true,
      reactionSummaries: true,
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
