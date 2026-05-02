import {
  useCreateReactionMutation,
  useDeleteReactionMutation,
} from "@rezics/api/reaction/reaction.mutations";
import { useEffect, useState } from "react";

export type VoteValue = "like" | "dislike" | null;

export type UseVoteControllerArgs = {
  targetUnitId: string;
  initialScore: number;
  initialUserVote?: VoteValue;
};

export type UseVoteControllerReturn = {
  score: number;
  userVote: VoteValue;
  toggleUp: () => void;
  toggleDown: () => void;
};

export function useVoteController({
  targetUnitId,
  initialScore,
  initialUserVote = null,
}: UseVoteControllerArgs): UseVoteControllerReturn {
  const [userVote, setUserVote] = useState<VoteValue>(initialUserVote);
  const [score, setScore] = useState<number>(initialScore);

  useEffect(() => {
    setUserVote(initialUserVote);
  }, [initialUserVote]);

  useEffect(() => {
    setScore(initialScore);
  }, [initialScore]);

  const createReaction = useCreateReactionMutation();
  const deleteReaction = useDeleteReactionMutation();

  const apply = (next: VoteValue) => {
    const prev = userVote;
    if (prev === next) return;
    const delta =
      (next === "like" ? 1 : next === "dislike" ? -1 : 0) -
      (prev === "like" ? 1 : prev === "dislike" ? -1 : 0);
    setUserVote(next);
    setScore((s) => s + delta);
    if (prev) {
      deleteReaction.mutate({ targetId: targetUnitId, reaction: prev });
    }
    if (next) {
      createReaction.mutate({ targetId: targetUnitId, reaction: next });
    }
  };

  return {
    score,
    userVote,
    toggleUp: () => apply(userVote === "like" ? null : "like"),
    toggleDown: () => apply(userVote === "dislike" ? null : "dislike"),
  };
}
