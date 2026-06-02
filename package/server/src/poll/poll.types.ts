// Server-only types for the Poll voting domain (Poll + PollOption + PollVote).

import type {
  Poll,
  PollOption,
  Prisma,
  UnitTranslation,
} from "#/prisma/client";

/** A poll extension row with its options resolved, ordered by position. */
export type PollWithOptions = Poll & {
  options: PollOption[];
  unit?: { translations: UnitTranslation[] } | null;
};

/** Prisma include for fetching a poll with its options in display order. */
export const pollInclude = {
  options: {
    orderBy: [{ position: "asc" }, { optionId: "asc" }],
  },
  unit: {
    include: {
      translations: true,
    },
  },
} satisfies Prisma.PollInclude;
