import {
  useCreateReactionMutation,
  useDeleteReactionMutation,
} from "@rezics/contract/api/reaction/reaction.mutations";
import { useTranslation } from "@rezics/i18n/react";
import { useRetryToast } from "@/shared/hooks/useRetryToast";
import { useAuth, useAuthModal } from "@/user";
import { decideVoteAction, type VoteValue } from "./voteAction";

export type { VoteAction, VoteValue } from "./voteAction";
export { decideVoteAction };

export type UseVoteControllerArgs = {
  targetId: string;
  contextUnitId?: string | null;
  /** Current user vote derived from the React Query cache by the caller. 由调用方从 React Query 缓存派生的当前用户投票。 */
  userVote: VoteValue;
};

export type UseVoteControllerReturn = {
  toggleUp: () => void;
  toggleDown: () => void;
  /** Modal helper. Consumers MUST render `auth.AuthModal({})` to surface the login UI. 模态框辅助对象。使用方必须渲染 `auth.AuthModal({})` 才能显示登录 UI。 */
  auth: ReturnType<typeof useAuthModal>;
};

export function useVoteController({
  targetId,
  contextUnitId,
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
      { targetId, reaction, contextUnitId },
      {
        onError: () =>
          showRetryToast(
            `reaction:${targetId}:delete:${reaction}`,
            retryMessage(),
            async () => runDelete(reaction),
          ),
      },
    );
  };

  const runCreate = (reaction: NonNullable<VoteValue>) => {
    createReaction.mutate(
      { targetId, reaction, contextUnitId },
      {
        onError: () =>
          showRetryToast(
            `reaction:${targetId}:create:${reaction}`,
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
    toggleUp: () => apply(userVote === "upvote" ? null : "upvote"),
    toggleDown: () => apply(userVote === "downvote" ? null : "downvote"),
    auth,
  };
}
