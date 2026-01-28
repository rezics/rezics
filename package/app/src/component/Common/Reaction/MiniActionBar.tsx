import { IconButton, Popper, Tooltip } from '@mui/material';

import { Add, Comment, Edit, FavoriteBorder } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { useUserStore } from '@/global/userStore';
import { useQuery } from '@tanstack/react-query';
import {
  useCreateReactionMutation,
  useDeleteReactionMutation,
} from '@package/api/reaction/reaction.mutations';
import { reactionQueries } from '@package/api/reaction/reaction.queries';
import React, { useEffect, useState } from 'react';
import { BookmarkTagManager } from './BookmarkTagManager';
import { useAlertStore } from '@/global/windowAlertStore';

interface MiniAdminActionBarProps {
  editionURL: string;
  textColor?: string;
  userUnitId?: string;
}

export function MiniAdminActionBar({
  editionURL,
  textColor,
  userUnitId,
}: MiniAdminActionBarProps) {
  const { t } = useTranslation();
  const user = useUserStore(state => state.user);
  const isAdmin = user?.permission?.role.includes('ADMIN');
  const isOwner = user?.unitId === userUnitId;
  const navigate = useNavigate();

  if (!isAdmin && !isOwner) {
    return null;
  }
  return (
    <span>
      <Tooltip title={t('common.edit')} placement="top">
        <IconButton
          aria-label={t('common.edit')}
          size="small"
          onClick={() => {
            navigate({ to: editionURL });
          }}
        >
          <Edit fontSize="small" className={textColor} />
        </IconButton>
      </Tooltip>
    </span>
  );
}

interface MiniActionBarProps {
  hideReply?: boolean;
  className?: string;
  textColor?: string;
  unitId?: string;
  handleOnCommentClick?: () => void;
  reactionSummaries?: any[];
}

export function MiniActionBar({
  hideReply = false,
  className,
  textColor,
  unitId,
  handleOnCommentClick,
}: MiniActionBarProps) {
  const { t } = useTranslation();
  const { show: showAlert } = useAlertStore();
  const { data } = useQuery(reactionQueries.my(unitId ?? ''));
  const [userReactions, setUserReactions] = useState<string[]>(
    data?.reactionsByTarget?.[unitId ?? ''] ?? [],
  );

  useEffect(() => {
    if (data?.reactionsByTarget?.[unitId ?? '']) {
      setUserReactions(data?.reactionsByTarget?.[unitId ?? '']);
    }
  }, [data, unitId]);

  const hasLike = userReactions.includes('like');
  const hasBookmark = userReactions.includes('bookmark');

  const [anchorBookmarkEl, setBookmarkAnchorEl] = useState<null | HTMLElement>(
    null,
  );
  const openBookmarkMenu = Boolean(anchorBookmarkEl);

  const createReactionMutation = useCreateReactionMutation({
    onSuccess: () => {
      showAlert('Reaction updated successfully');
    },
  });

  const deleteReactionMutation = useDeleteReactionMutation({
    onSuccess: () => {
      showAlert('Reaction updated successfully');
    },
  });

  const handleToggleReaction = (reaction: 'like' | 'dislike') => {
    if (!unitId) return;

    const hasReaction = userReactions?.includes(reaction);

    if (hasReaction) {
      deleteReactionMutation.mutate({ targetId: unitId, reaction });
      setUserReactions(prev => prev.filter(r => r !== reaction));
    } else {
      createReactionMutation.mutate({ targetId: unitId, reaction });
      setUserReactions(prev => [...prev, reaction]);
    }
  };

  const handleBookmarkMenuToggle = (event: React.MouseEvent<HTMLElement>) => {
    if (!unitId) return;
    setBookmarkAnchorEl(anchorBookmarkEl ? null : event.currentTarget);
  };
  // const [_location, navigate] = useLocation();
  return (
    <span className={className}>
      <Tooltip title={t('accessibility.favorite')} placement="top">
        <IconButton
          aria-label={t('accessibility.favorite')}
          size="small"
          onClick={() => handleToggleReaction('like')}
        >
          <FavoriteBorder
            fontSize="small"
            color={hasLike ? 'primary' : 'inherit'}
            className={textColor}
          />
        </IconButton>
      </Tooltip>
      {!hideReply && (
        <Tooltip title={t('accessibility.comments')} placement="top">
          <IconButton
            aria-label={t('accessibility.comments')}
            size="small"
            onClick={handleOnCommentClick ?? undefined}
          >
            <Comment fontSize="small" className={textColor} />
          </IconButton>
        </Tooltip>
      )}
      <Popper
        open={openBookmarkMenu}
        anchorEl={anchorBookmarkEl}
        placement="right-start"
        modifiers={[
          { name: 'flip', enabled: true },
          {
            name: 'preventOverflow',
            options: {
              altAxis: true, // 允许上下、左右溢出检测
              padding: 8,
            },
          },
        ]}
        sx={{
          zIndex: theme => theme.zIndex.modal + 1,
        }}
      >
        {unitId && (
          <BookmarkTagManager
            unitId={unitId}
            key={unitId}
            open={openBookmarkMenu}
            onClose={() => setBookmarkAnchorEl(null)}
            hasBookmarked={hasBookmark}
          />
        )}
      </Popper>
      <Tooltip title={t('accessibility.collection')} placement="top">
        <IconButton
          aria-label={t('accessibility.collection')}
          size="small"
          onClick={handleBookmarkMenuToggle}
        >
          <Add
            fontSize="small"
            color={hasBookmark ? 'primary' : 'inherit'}
            className={textColor}
          />
        </IconButton>
      </Tooltip>
    </span>
  );
}
