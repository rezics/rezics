import { userQueries } from "@rezics/api/user/user.queries";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useUserProfileStore } from "../states/userProfileStore";

type UserScopedWorkspaceParams = {
  userSlug?: string;
  userId?: string;
};

export function useUserScopedWorkspaceTarget() {
  const params = useParams({ strict: false }) as UserScopedWorkspaceParams;
  const currentUserId = useUserProfileStore((state) => state.user?.unitId);
  const currentUserSlug = useUserProfileStore((state) => state.user?.slug);
  const userBySlugQuery = useQuery({
    ...userQueries.bySlug(params.userSlug ?? ""),
    enabled: Boolean(params.userSlug),
  });

  const targetUserId =
    params.userId ?? userBySlugQuery.data?.unitId ?? currentUserId ?? null;
  const targetUserSlug =
    params.userSlug ??
    (targetUserId === currentUserId ? (currentUserSlug ?? null) : null);

  return {
    targetUserId,
    targetUserSlug,
    isCurrentUser: Boolean(targetUserId && targetUserId === currentUserId),
    isLoading: Boolean(params.userSlug) && userBySlugQuery.isLoading,
    error: userBySlugQuery.error,
  };
}
