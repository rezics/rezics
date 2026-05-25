import {
  useIsSubscribed,
  useSubscribeMutation,
  useUnsubscribeMutation,
} from "@rezics/api/subscription/subscription";
import {
  profile_follow,
  profile_followers_count,
  profile_following,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/shared/utils/css-util";
import { selectHasMemberSession, useAuthSessionStore } from "@/user/states";

const i18nMessages = {
  profile_follow,
  profile_followers_count,
  profile_following,
};

type ButtonVariant =
  | "default"
  | "outline"
  | "ghost"
  | "destructive"
  | "secondary"
  | "link";
type ButtonSize = "sm" | "default" | "lg" | "icon";

type FollowButtonProps = {
  /** Target user's userId. */
  userId: string | undefined;
  /** 初始关注状态；真实状态加载后会同步覆盖。 */
  initialIsFollowing?: boolean;
  /**
   * 初始粉丝数，用于本地即时更新显示。
   * 若不传，则仅展示「是否关注」状态，不显示统计。
   */
  initialFollowersCount?: number;
  /** 是否显示粉丝统计文案，例如 "123 followers" */
  showFollowersText?: boolean;
  /** 覆盖 Button 尺寸 */
  size?: ButtonSize;
  /** 覆盖 Button 变体 */
  variant?: ButtonVariant;
  /** 是否铺满宽度 */
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
  const m = useMessage(i18nMessages);
  const navigate = useNavigate();
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

  const handleClick = async () => {
    if (!userId || loading) return;

    if (!hasMemberSession) {
      navigate({ to: "/login" });
      return;
    }

    const willUnfollow = isFollowing;
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
        await subscribeMutation.mutateAsync({ targetUnitId: userId });
      }
    } catch {
      if (hasLocalCount) {
        setLocalFollowers((prev) => (prev ?? 0) - delta);
      }
      setLocalIsFollowing(willUnfollow);
    }
  };

  const label = isFollowing ? m.profile_following() : m.profile_follow();

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
      ? m.profile_followers_count({ count: localFollowers })
      : null;

  if (!followersText) {
    return button;
  }

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger render={button} />
          <TooltipContent>{followersText}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <span className="text-xs text-text-secondary">{followersText}</span>
    </div>
  );
};

export default FollowButton;
