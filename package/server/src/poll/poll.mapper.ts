import type { PollDTO, PollOptionDTO, PollResultsDTO } from "@rezics/contract";
import type { PollOption } from "../db/schema";
import type { PollWithOptions } from "./poll.types";

type PollOptionRow = typeof PollOption.$inferSelect;

/**
 * Map a PollOption row to its DTO. `voteCount` is included only when
 * `withTally` is true (results are visible to the caller).
 */
export function mapPollOptionToDTO(
  option: PollOptionRow,
  withTally: boolean,
): PollOptionDTO {
  return {
    pollUnitId: option.pollUnitId,
    optionId: option.optionId,
    position: option.position,
    label: option.label ?? null,
    unitId: option.unitId ?? null,
    ...(withTally ? { voteCount: option.voteCount } : {}),
  };
}

/** Whether a poll is past its close time as of `now`. */
export function isPollClosed(
  poll: { closesAt: Date | null },
  now: Date = new Date(),
): boolean {
  return poll.closesAt !== null && poll.closesAt.getTime() <= now.getTime();
}

/**
 * Map a poll (with options) to its DTO. Tallies are always present in the base
 * poll DTO; result gating lives in {@link mapPollResultsToDTO}.
 */
export function mapPollToDTO(poll: PollWithOptions, now?: Date): PollDTO {
  const translation = poll.unit?.translations.find(
    (item) => item.title && item.title.trim().length > 0,
  );
  return {
    unitId: poll.unitId,
    title: translation?.title ?? null,
    description: translation?.summary ?? null,
    voteMode: poll.voteMode,
    resultVisibility: poll.resultVisibility,
    anonymous: poll.anonymous,
    closesAt: poll.closesAt ? poll.closesAt.toISOString() : null,
    closed: isPollClosed(poll, now),
    usageCount: poll.usageCount,
    used: poll.usageCount > 0,
    options: poll.options.map((o) => mapPollOptionToDTO(o, true)),
    createdAt: poll.createdAt.toISOString(),
    updatedAt: poll.updatedAt.toISOString(),
  };
}

/**
 * Map a poll to its results DTO, applying result-visibility and anonymity
 * gating. When `resultsVisible` is false (AFTER_CLOSE before close and the
 * caller is not privileged) option `voteCount` and `totalVotes` are withheld.
 * The voter↔option mapping is never serialized here regardless of anonymity;
 * `myVote` carries only the calling user's own selection. Privileged audit
 * access (if ever added) must use a separate path, never this public read.
 */
export function mapPollResultsToDTO(
  poll: PollWithOptions,
  input: {
    myVote: string[];
    myVoteContexts: { optionId: string; realmUnitId: string | null }[];
    resultsVisible: boolean;
    now?: Date;
  },
): PollResultsDTO {
  const { myVote, myVoteContexts, resultsVisible } = input;
  return {
    pollUnitId: poll.unitId,
    voteMode: poll.voteMode,
    resultVisibility: poll.resultVisibility,
    anonymous: poll.anonymous,
    closed: isPollClosed(poll, input.now),
    closesAt: poll.closesAt ? poll.closesAt.toISOString() : null,
    resultsVisible,
    options: poll.options.map((o) => mapPollOptionToDTO(o, resultsVisible)),
    ...(resultsVisible
      ? { totalVotes: poll.options.reduce((sum, o) => sum + o.voteCount, 0) }
      : {}),
    myVote,
    myVoteContexts,
  };
}
