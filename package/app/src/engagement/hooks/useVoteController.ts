import {
  useCreateReactionMutation,
  useDeleteReactionMutation,
} from "@rezics/api/reaction/reaction.mutations";
import { useAuthModal } from "@/user/components/useAuthModal";
import { useAuth } from "@/user/pages/useAuth";
import { decideVoteAction, type VoteValue } from "./voteAction";

export type { VoteAction, VoteValue } from "./voteAction";
export { decideVoteAction };

export type UseVoteControllerArgs = {
  targetUnitId: string;
  /** Current user vote derived from the React Query cache by the caller. */
  userVote: VoteValue;
};

export type UseVoteControllerReturn = {
  toggleUp: () => void;
  toggleDown: () => void;
  /** Modal helper. Consumers MUST render `auth.AuthModal({})` to surface the login UI. */
  auth: ReturnType<typeof useAuthModal>;
};

export function useVoteController({
  targetUnitId,
  userVote,
}: UseVoteControllerArgs): UseVoteControllerReturn {
  const { isAuthenticated } = useAuth();
  const auth = useAuthModal("login");
  const createReaction = useCreateReactionMutation();
  const deleteReaction = useDeleteReactionMutation();

  const apply = (next: VoteValue) => {
    const action = decideVoteAction({ isAuthenticated, userVote, next });
    switch (action.kind) {
      case "auth-required":
        auth.openLogin();
        return;
      case "noop":
        return;
      case "delete":
        deleteReaction.mutate({
          targetId: targetUnitId,
          reaction: action.reaction,
        });
        return;
      case "create":
        createReaction.mutate({
          targetId: targetUnitId,
          reaction: action.reaction,
        });
        return;
      case "swap":
        deleteReaction.mutate({
          targetId: targetUnitId,
          reaction: action.remove,
        });
        createReaction.mutate({
          targetId: targetUnitId,
          reaction: action.add,
        });
        return;
    }
  };

  return {
    toggleUp: () => apply(userVote === "like" ? null : "like"),
    toggleDown: () => apply(userVote === "dislike" ? null : "dislike"),
    auth,
  };
}
