import type { PollVoteMode } from "@rezics/contract";
import {
  useCastPollVoteMutation,
  useWithdrawPollVoteMutation,
} from "@rezics/api/poll/poll.mutations";

export interface UsePollVoteArgs {
  pollUnitId: string;
  voteMode: PollVoteMode;
  /** The option ids the caller currently holds (`PollResultsDTO.myVote`). */
  myVote: string[];
  realmUnitId?: string | null;
  canVote?: boolean;
}

export interface UsePollVoteReturn {
  /**
   * Act on an option. SINGLE: casts/changes the caller's single vote. MULTI:
   * toggles — casts when the option is not already held, withdraws (with its
   * `optionId`) when it is. The underlying mutations write the refreshed
   * `PollResultsDTO` into the detail cache and invalidate it, so the display
   * picks up new tallies without local state.
   */
  select: (optionId: string) => void;
  isPending: boolean;
  error: Error | null;
}

/**
 * Voting semantics over the existing poll mutations. Mirrors how the tag and
 * engagement features defer all tally state to the mutation cache write +
 * invalidate rather than tracking it locally.
 */
export function usePollVote({
  pollUnitId,
  voteMode,
  myVote,
  realmUnitId,
  canVote = true,
}: UsePollVoteArgs): UsePollVoteReturn {
  const castVote = useCastPollVoteMutation(pollUnitId);
  const withdrawVote = useWithdrawPollVoteMutation(pollUnitId);

  const select = (optionId: string) => {
    if (!canVote) return;
    if (voteMode === "MULTI" && myVote.includes(optionId)) {
      withdrawVote.mutate({ optionId, realmUnitId: realmUnitId ?? undefined });
      return;
    }
    castVote.mutate({ optionId, realmUnitId: realmUnitId ?? undefined });
  };

  return {
    select,
    isPending: castVote.isPending || withdrawVote.isPending,
    error: castVote.error ?? withdrawVote.error,
  };
}
