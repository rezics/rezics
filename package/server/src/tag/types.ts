// Types only used in server for Tag (scored UnitTag system)

import type {
  Prisma,
  Unit,
  UnitTag,
  UnitTranslation,
} from "#/prisma/client";

/**
 * A tag Unit with its translations.
 * Tags are Units with type=TAG, isLanguageNeutral=true.
 */
export type TagWithTranslations = Unit & {
  translations: UnitTranslation[];
};

/**
 * A UnitTag junction row with the tag Unit and its translations resolved.
 */
export type UnitTagWithRelations = UnitTag & {
  tag: Unit & { translations: UnitTranslation[] };
};

/**
 * Prisma include for fetching a tag Unit with translations.
 */
export const tagUnitInclude = {
  translations: true,
} satisfies Prisma.UnitInclude;

/**
 * Prisma include for fetching UnitTag rows with tag labels.
 */
export const unitTagInclude = {
  tag: {
    include: { translations: true },
  },
} satisfies Prisma.UnitTagInclude;
