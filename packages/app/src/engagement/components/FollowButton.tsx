import {
  useSubscribeMutation,
  useUnsubscribeMutation,
} from "@rezics/contract/api/subscription/subscription.mutations";
import { useIsSubscribed } from "@rezics/contract/api/subscription/subscription.queries";
import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRetryToast } from "@/shared/hooks/useRetryToast";
import { cn } from "@/shared/utils/css-util";
import {
  selectHasMemberSession,
  useAuthModal,
  useAuthSessionStore,
} from "@/user";

type ButtonVariant =
  | "default"
  | "outline"
  | "ghost"
  | "destructive"
  | "secondary"
  | "link";
type ButtonSize = "sm" | "default" | "lg" | "icon";

type FollowButtonProps = {
  /**
   * Target user's userId.
   * 目标用户的 userId。
   */
  userId: string | undefined;
  /**
   * Initial follow state; overwritten once the real state loads.
   * 初始关注状态；真实状态加载后会同步覆盖。
   */
  initialIsFollowing?: boolean;
  /**
   * Initial followers count, used for immediate local display updates.
   * If omitted, only the follow state is shown without statistics.
   * 初始粉丝数，用于本地即时更新显示。
   * 若不传，则仅展示「是否关注」状态，不显示统计。
   */
  initialFollowersCount?: number;
  /**
   * Whether to show the followers count text, e.g. "123 followers".
   * 是否显示粉丝统计文案，例如 "123 followers"。
   */
  showFollowersText?: boolean;
  /**
   * Override the Button size.
   * 覆盖 Button 尺寸。
   */
  size?: ButtonSize;
  /**
   * Override the Button variant.
   * 覆盖 Button 变体。
   */
  variant?: ButtonVariant;
  /**
   * Whether to span full width.
   * 是否铺满宽度。
   */
  fullWidth?: boolean;
  className?: string;
};

export const FollowButton: React.FC<FollowButtonProps> = ({
  userId,
  initialIsFollowing,
  initialFollowersCount,
  showFollowersText = false,
  size = "sm",
  variant = "outline",
  fullWidth = false,
  className,
}) => {
  const { t } = useTranslation(["settings", "community"]);
  const auth = useAuthModal("login");
  const showRetryToast = useRetryToast();
  const hasMemberSession = useAuthSessionStore(selectHasMemberSession);
  const authSessionLoading = useAuthSessionStore(
    (state) => state.status === "loading",
  );
  const [localFollowers, setLocalFollowers] = useState<number | undefined>(
    initialFollowersCount,
  );
  const [localIsFollowing, setLocalIsFollowing] = useState<boolean | undefined>(
    initialIsFollowing,
  );

  useEffect(() => {
    setLocalFollowers(initialFollowersCount);
  }, [initialFollowersCount]);

  useEffect(() => {
    setLocalIsFollowing(userId ? initialIsFollowing : undefined);
  }, [initialIsFollowing, userId]);

  const enabled = !!userId && hasMemberSession;

  const { data: subscriptionStatus, isLoading: statusLoading } =
    useIsSubscribed(enabled ? (userId as string) : "");

  const subscribeMutation = useSubscribeMutation();
  const unsubscribeMutation = useUnsubscribeMutation();

  useEffect(() => {
    if (!userId || !subscriptionStatus) return;
    setLocalIsFollowing(subscriptionStatus.subscribed);
  }, [subscriptionStatus, userId]);

  const isFollowing = useMemo(
    () => localIsFollowing ?? false,
    [localIsFollowing],
  );
  const hasFollowState = typeof localIsFollowing === "boolean";

  const loading =
    authSessionLoading ||
    (statusLoading && !hasFollowState) ||
    subscribeMutation.isPending ||
    unsubscribeMutation.isPending;

  const attemptToggle = async (willUnfollow: boolean) => {
    if (!userId) return;
    const delta = willUnfollow ? -1 : 1;
    const hasLocalCount = typeof localFollowers === "number";

    if (hasLocalCount) {
      setLocalFollowers((prev) => (prev ?? 0) + delta);
    }
    setLocalIsFollowing(!willUnfollow);

    try {
      if (willUnfollow) {
        await unsubscribeMutation.mutateAsync(userId);
      } else {
        await subscribeMutation.mutateAsync({ subscribedUnitId: userId });
      }
    } catch {
      if (hasLocalCount) {
        setLocalFollowers((prev) => (prev ?? 0) - delta);
      }
      setLocalIsFollowing(willUnfollow);
      showRetryToast(
        `follow:${userId}`,
        t("community:progress_status_toast_generic_retry"),
        () => attemptToggle(willUnfollow),
      );
    }
  };

  const handleClick = async () => {
    if (!userId || loading) return;

    // Prompt sign-in in place rather than navigating away, so the user keeps
    // their context (list/profile) and can follow right after authenticating.
    // 就地引导登录而非跳转离开，让用户保留所处上下文（列表/主页），
    // 登录后即可继续关注。
    if (!hasMemberSession) {
      auth.openLogin();
      return;
    }

    await attemptToggle(isFollowing);
  };

  const label = isFollowing
    ? t("settings:profile_following")
    : t("settings:profile_follow");

  const button = (
    <Button
      variant={variant}
      size={size}
      disabled={!userId || loading}
      onClick={handleClick}
      className={cn(
        size === "sm" ? "py-1" : "py-2",
        fullWidth && "w-full",
        className,
      )}
    >
      {label}
    </Button>
  );

  const followersText =
    showFollowersText && typeof localFollowers === "number"
      ? t("settings:profile_followers_count", { count: localFollowers })
      : null;

  const content = !followersText ? (
    button
  ) : (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger render={button} className="shrink-0" />
          <TooltipContent>{followersText}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <span className="text-xs text-text-secondary">{followersText}</span>
    </div>
  );

  return (
    <>
      {content}
      {!hasMemberSession && auth.AuthModal({})}
    </>
  );
};
