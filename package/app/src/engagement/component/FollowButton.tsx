import React, {useEffect, useMemo, useState} from 'react';
import {Button, type ButtonProps, Tooltip} from '@mui/material';
import {useQuery} from '@tanstack/react-query';
import {userQueries, userMutations} from '@rezics/api/user/user';

type FollowButtonProps = {
  /** 目标用户的 unitId */
  userId: string | undefined;
  /**
   * 初始粉丝数，用于本地即时更新显示。
   * 若不传，则仅展示「是否关注」状态，不显示统计。
   */
  initialFollowersCount?: number;
  /** 是否显示粉丝统计文案，例如 “123 followers” */
  showFollowersText?: boolean;
  /** 覆盖 Button 尺寸 */
  size?: ButtonProps['size'];
  /** 覆盖 Button 变体 */
  variant?: ButtonProps['variant'];
  /** 是否铺满宽度 */
  fullWidth?: boolean;
  className?: string;
};

export const FollowButton: React.FC<FollowButtonProps> = ({
  userId,
  initialFollowersCount,
  showFollowersText = false,
  size = 'small',
  variant = 'outlined',
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

  const {data: followStatus, isLoading: statusLoading} = useQuery({
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
    const hasLocalCount = typeof localFollowers === 'number';

    if (hasLocalCount) {
      setLocalFollowers(prev => (prev ?? 0) + delta);
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
        setLocalFollowers(prev => (prev ?? 0) - delta);
      }
    }
  };

  const label = isFollowing ? 'Following' : 'Follow';
  const color: ButtonProps['color'] = isFollowing ? 'secondary' : 'primary';

  const button = (
    <Button
      variant={variant}
      size={size}
      color={color}
      disabled={!enabled || loading}
      onClick={handleClick}
      className={className}
      fullWidth={fullWidth}
      sx={{py: size === 'small' ? 0.5 : 1}}
    >
      {label}
    </Button>
  );

  const followersText =
    showFollowersText && typeof localFollowers === 'number'
      ? `${localFollowers} followers`
      : null;

  if (!followersText) {
    return button;
  }

  return (
    <div className="flex items-center gap-2">
      <Tooltip title={followersText}>{button}</Tooltip>
      <span className="text-xs text-gray-500">{followersText}</span>
    </div>
  );
};

export default FollowButton;
