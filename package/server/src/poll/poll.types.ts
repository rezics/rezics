// Server-only types for the Poll voting domain (Poll + PollOption + PollVote).

import type { Poll, PollOption, UnitTranslation } from "../db/schema";

/** A poll extension row with its options resolved, ordered by position. */
export type PollWithOptions = typeof Poll.$inferSelect & {
  options: (typeof PollOption.$inferSelect)[];
  unit?: { translations: (typeof UnitTranslation.$inferSelect)[] } | null;
};
