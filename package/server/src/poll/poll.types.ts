// Server-only types for the Poll voting domain (Poll + PollOption + PollVote).

import type { Poll, PollOption, Prisma } from "#/prisma/client";

/** A poll extension row with its options resolved, ordered by position. */
export type PollWithOptions = Poll & {
  options: PollOption[];
};

/** Prisma include for fetching a poll with its options in display order. */
export const pollInclude = {
  options: {
    orderBy: [{ position: "asc" }, { optionId: "asc" }],
  },
} satisfies Prisma.PollInclude;
