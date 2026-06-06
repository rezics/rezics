/**
 * Poll API client functions.
 *
 * A poll is a Unit(type=POLL) with PollOption rows and per-user PollVote rows.
 * Reads return gated tallies (resultVisibility + anonymity) plus the caller's
 * own vote; writes cast/change/withdraw a vote and return refreshed results.
 */

import type {
  CastPollVoteInput,
  CreatePollInput,
  PollDTO,
  PollResultsDTO,
  WithdrawPollVoteInput,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";

export const pollApi = {
  /**
   * Create a poll with options (requires auth).
   */
  create: async (input: CreatePollInput): Promise<PollDTO> => {
    return apiFetch<PollDTO>(`/poll`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Read a poll, its options, and gated tallies plus the caller's own vote.
   */
  get: async (pollUnitId: string): Promise<PollResultsDTO> => {
    return apiFetch<PollResultsDTO>(`/poll/${encodeURIComponent(pollUnitId)}`);
  },

  /**
   * Cast or change a vote. Returns refreshed results.
   */
  vote: async (
    pollUnitId: string,
    input: CastPollVoteInput,
  ): Promise<PollResultsDTO> => {
    return apiFetch<PollResultsDTO>(
      `/poll/${encodeURIComponent(pollUnitId)}/vote`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  /**
   * Withdraw a vote. For multi-choice polls, `optionId` selects which to drop.
   */
  withdraw: async (
    pollUnitId: string,
    input?: WithdrawPollVoteInput,
  ): Promise<PollResultsDTO> => {
    return apiFetch<PollResultsDTO>(
      `/poll/${encodeURIComponent(pollUnitId)}/vote${buildQueryString(input)}`,
      { method: "DELETE" },
    );
  },
};
