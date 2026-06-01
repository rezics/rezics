import {
  useCreateReactionMutation,
  useDeleteReactionMutation,
} from "@rezics/api/reaction/reaction.mutations";
import { useTranslation } from "@rezics/i18n/react";
import { useRetryToast } from "@/shared/hooks/useRetryToast";
import { useAuthModal } from "@/user/components/useAuthModal";
import { useAuth } from "@/user/pages/useAuth";
import { decideVoteAction, type VoteValue } from "./voteAction";

export type { VoteAction, VoteValue } from "./voteAction";
export { decideVoteAction };

export type UseVoteControllerArgs = {
  targetUnitId: string;
  scopeKey?: string;
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
  scopeKey,
  userVote,
}: UseVoteControllerArgs): UseVoteControllerReturn {
  const { isAuthenticated } = useAuth();
  const auth = useAuthModal("login");
  const createReaction = useCreateReactionMutation();
  const deleteReaction = useDeleteReactionMutation();
  const { t } = useTranslation(["community"]);
  const showRetryToast = useRetryToast();

  const retryMessage = () => t("community:progress_status_toast_generic_retry");

  const runDelete = (reaction: NonNullable<VoteValue>) => {
    deleteReaction.mutate(
      { targetId: targetUnitId, reaction, scopeKey },
      {
        onError: () =>
          showRetryToast(
            `reaction:${targetUnitId}:delete:${reaction}`,
            retryMessage(),
            async () => runDelete(reaction),
          ),
      },
    );
  };

  const runCreate = (reaction: NonNullable<VoteValue>) => {
    createReaction.mutate(
      { targetId: targetUnitId, reaction, scopeKey },
      {
        onError: () =>
          showRetryToast(
            `reaction:${targetUnitId}:create:${reaction}`,
            retryMessage(),
            async () => runCreate(reaction),
          ),
      },
    );
  };

  const apply = (next: VoteValue) => {
    const action = decideVoteAction({ isAuthenticated, userVote, next });
    switch (action.kind) {
      case "auth-required":
        auth.openLogin();
        return;
      case "noop":
        return;
      case "delete":
        runDelete(action.reaction);
        return;
      case "create":
        runCreate(action.reaction);
        return;
      case "swap":
        runDelete(action.remove);
        runCreate(action.add);
        return;
    }
  };

  return {
    toggleUp: () => apply(userVote === "like" ? null : "like"),
    toggleDown: () => apply(userVote === "dislike" ? null : "dislike"),
    auth,
  };
}
