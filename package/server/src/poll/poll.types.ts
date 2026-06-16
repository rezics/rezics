// Server-only types for the Poll voting domain (Poll + PollOption + PollVote).
// 投票领域（Poll + PollOption + PollVote）的服务端专用类型。

import type { Poll, PollOption, UnitTranslation } from "../db/schema";

/**
 * A poll extension row with its options resolved, ordered by position.
 * 一条投票扩展记录，其选项已解析，并按 position 排序。
 */
export type PollWithOptions = typeof Poll.$inferSelect & {
  options: (typeof PollOption.$inferSelect)[];
  unit?: { translations: (typeof UnitTranslation.$inferSelect)[] } | null;
};
