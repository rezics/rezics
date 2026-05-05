import { userMutations, userQueries } from "@rezics/api/user/user";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/shared/utils/css-util";

type ButtonVariant =
  | "default"
  | "outline"
  | "ghost"
  | "destructive"
  | "secondary"
  | "link";
type ButtonSize = "sm" | "default" | "lg" | "icon";
// Legacy MUI size names accepted at the prop boundary for backwards compatibility
// with un-migrated call sites; mapped onto shadcn sizes internally.
type LegacyButtonSize = "small" | "medium" | "large";

const SIZE_MAP: Record<LegacyButtonSize, ButtonSize> = {
  small: "sm",
  medium: "default",
  large: "lg",
};

type FollowButtonProps = {
  /** 目标用户的 unitId */
  userId: string | undefined;
  /**
   * 初始粉丝数，用于本地即时更新显示。
   * 若不传，则仅展示「是否关注」状态，不显示统计。
   */
  initialFollowersCount?: number;
  /** 是否显示粉丝统计文案，例如 "123 followers" */
  showFollowersText?: boolean;
  /** 覆盖 Button 尺寸 */
  size?: ButtonSize | LegacyButtonSize;
  /** 覆盖 Button 变体 */
  variant?: ButtonVariant;
  /** 是否铺满宽度 */
  fullWidth?: boolean;
  className?: string;
};

function normalizeSize(size: ButtonSize | LegacyButtonSize): ButtonSize {
  if (size === "small" || size === "medium" || size === "large") {
    return SIZE_MAP[size];
  }
  return size;
}

export const FollowButton: React.FC<FollowButtonProps> = ({
  userId,
  initialFollowersCount,
  showFollowersText = false,
  size = "sm",
  variant = "outline",
  fullWidth = false,
  className,
}) => {
  const [localFollowers, setLocalFollowers] = useState<number | undefined>(
    initialFollowersCount,
  );

  useEffect(() => {
    setLocalFollowers(initialFollowersCount);
  }, [initialFollowersCount]);

  const enabled = !!userId;

  const { data: followStatus, isLoading: statusLoading } = useQuery({
    ...userQueries.followStatus(userId ? [userId] : []),
    enabled,
  });

  const followMutation = userMutations.useFollow();
  const unfollowMutation = userMutations.useUnfollow();

  const isFollowing = useMemo(
    () => (userId && followStatus ? !!followStatus[userId] : false),
    [followStatus, userId],
  );

  const loading =
    statusLoading || followMutation.isPending || unfollowMutation.isPending;

  const handleClick = async () => {
    if (!userId || loading) return;

    const willUnfollow = isFollowing;
    const delta = willUnfollow ? -1 : 1;
    const hasLocalCount = typeof localFollowers === "number";

    if (hasLocalCount) {
      setLocalFollowers((prev) => (prev ?? 0) + delta);
    }

    try {
      if (willUnfollow) {
        await unfollowMutation.mutateAsync(userId);
      } else {
        await followMutation.mutateAsync(userId);
      }
    } catch {
      // 回滚本地计数
      if (hasLocalCount) {
        setLocalFollowers((prev) => (prev ?? 0) - delta);
      }
    }
  };

  const label = isFollowing ? "Following" : "Follow";

  const normalizedSize = normalizeSize(size);

  const button = (
    <Button
      variant={variant}
      size={normalizedSize}
      disabled={!enabled || loading}
      onClick={handleClick}
      className={cn(
        normalizedSize === "sm" ? "py-1" : "py-2",
        fullWidth && "w-full",
        className,
      )}
    >
      {label}
    </Button>
  );

  const followersText =
    showFollowersText && typeof localFollowers === "number"
      ? `${localFollowers} followers`
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
