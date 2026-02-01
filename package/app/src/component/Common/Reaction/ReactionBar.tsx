import {
  ChatBubbleOutline,
  StarBorder,
  OpenInNew,
  DeleteOutlined,
  EditOutlined,
  SentimentSatisfiedAlt,
  EmojiEvents,
} from '@mui/icons-material';
import ThumbDownAltOutlinedIcon from '@mui/icons-material/ThumbDownAltOutlined';
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import {IconButton, Popper, Tooltip} from '@mui/material';
import React, {useEffect, useState} from 'react';
import {ReactionBarToolBox} from './reactionBarToolBox';
import {useAlertStore} from '@/global/windowAlertStore';
import {BookmarkTagManager} from './BookmarkTagManager';

import {
  useCreateReactionMutation,
  useDeleteReactionMutation,
} from '@package/api/reaction/reaction.mutations';

async function copyCurrentUrl(url?: string) {
  const theUrl = url || window.location.href;
  try {
    await navigator.clipboard.writeText(theUrl);
    console.log('URL 已复制到剪贴板');
  } catch (err) {
    console.error('复制失败：', err);
  }
}

export type ReactionAdminBarProps = {
  className?: string;
  size?: 'small' | 'medium' | 'large';
  fontSize?: string;
  onEdit: () => void;
  onDelete: () => void;
};

export function ReactionAdminBar({
  className,
  size = 'large',
  fontSize = '1.5rem',
  onEdit,
  onDelete,
}: ReactionAdminBarProps) {
  return (
    <div className={`flex items-center ${className}`}>
      <IconButton size={size} sx={{fontSize}} onClick={onEdit} className="ml-2">
        <EditOutlined fontSize="inherit" />
      </IconButton>

      <IconButton
        size={size}
        sx={{fontSize}}
        onClick={onDelete}
        className="ml-2"
      >
        <DeleteOutlined fontSize="inherit" />
      </IconButton>
    </div>
  );
}

export type ReactionBarProps = {
  onReply?: () => void;
  unitId?: string;
  className?: string;
  size?: 'small' | 'medium' | 'large';
  fontSize?: string;
  itemUrl?: string;
  hideLike?: boolean;
  hideDislike?: boolean;
  hideReply?: boolean;
  hideBookmark?: boolean;
  hideShare?: boolean;
  /** 当前用户在该 target 上的所有 reaction（例如 ['like'] 或 ['like','bookmark']） */
  currentUserReactions?: string[];
};

export const ReactionBar: React.FC<ReactionBarProps> = ({
  onReply,
  unitId,
  className,
  size = 'large',
  fontSize = '1.5rem',
  itemUrl,
  hideLike = false,
  hideDislike = false,
  hideReply = false,
  hideBookmark = false,
  hideShare = false,
  currentUserReactions,
}) => {
  const handleReply = () => {
    onReply?.();
  };

  const [isToolBoxOpen, setIsToolBoxOpen] = useState(false);
  const {show: showAlert} = useAlertStore();

  const [anchorBookmarkEl, setBookmarkAnchorEl] = useState<null | HTMLElement>(
    null,
  );
  const openBookmarkMenu = Boolean(anchorBookmarkEl);

  const handleBookmarkMenuToggle = (event: React.MouseEvent<HTMLElement>) => {
    if (!unitId) return;
    setBookmarkAnchorEl(anchorBookmarkEl ? null : event.currentTarget);
  };

  const [userReactions, setUserReactions] = useState<string[]>(
    currentUserReactions ?? [],
  );

  useEffect(() => {
    setUserReactions(currentUserReactions ?? []);
  }, [currentUserReactions]);

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

  const hasLike = userReactions.includes('like');
  const hasDislike = userReactions.includes('dislike');
  const hasBookmark = userReactions.includes('bookmark');

  const handleToggleReaction = (reaction: 'like' | 'dislike') => {
    if (!unitId) return;

    const hasReaction = userReactions.includes(reaction);

    if (hasReaction) {
      deleteReactionMutation.mutate({targetId: unitId, reaction});
      setUserReactions(prev => prev.filter(r => r !== reaction));
    } else {
      createReactionMutation.mutate({targetId: unitId, reaction});
      setUserReactions(prev => [...prev, reaction]);
    }
  };

  return (
    <div className={`flex items-start w-full max-w-2xl mx-auto ${className}`}>
      <div className="flex justify-between items-center flex-1">
        {!hideLike && (
          <div>
            <IconButton
              size={size}
              sx={{fontSize}}
              onClick={() => handleToggleReaction('like')}
            >
              <ThumbUpAltOutlinedIcon
                fontSize="inherit"
                color={hasLike ? 'primary' : 'inherit'}
              />
            </IconButton>
          </div>
        )}
        {!hideDislike && (
          <div>
            <IconButton
              size={size}
              sx={{fontSize}}
              onClick={() => handleToggleReaction('dislike')}
            >
              <ThumbDownAltOutlinedIcon
                fontSize="inherit"
                color={hasDislike ? 'error' : 'inherit'}
              />
            </IconButton>
          </div>
        )}

        {!hideReply && (
          <div>
            <IconButton size={size} sx={{fontSize}} onClick={handleReply}>
              <ChatBubbleOutline fontSize="inherit" />
            </IconButton>
          </div>
        )}

        {!hideBookmark && (
          <div>
            <IconButton
              size={size}
              sx={{fontSize}}
              onClick={event => {
                handleBookmarkMenuToggle(event);
              }}
            >
              <StarBorder
                fontSize="inherit"
                color={hasBookmark ? 'primary' : 'inherit'}
              />
            </IconButton>
          </div>
        )}

        <Popper
          open={openBookmarkMenu}
          anchorEl={anchorBookmarkEl}
          placement="right-start"
          modifiers={[
            {name: 'flip', enabled: true},
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
              hasBookmarked={hasBookmark}
              key={unitId}
              open={openBookmarkMenu}
              onClose={() => setBookmarkAnchorEl(null)}
            />
          )}
        </Popper>

        {!hideShare && (
          <div>
            <IconButton
              size={size}
              sx={{fontSize}}
              onClick={() => {
                showAlert('链接已经复制到剪贴板');
                const origin = window?.location?.origin;
                const theUrl = origin + itemUrl;
                copyCurrentUrl(theUrl);
                setIsToolBoxOpen(true);
              }}
            >
              <OpenInNew fontSize="inherit" />
            </IconButton>
          </div>
        )}
        <ReactionBarToolBox
          open={isToolBoxOpen}
          onClose={() => {
            setIsToolBoxOpen(false);
          }}
          itemUrl={itemUrl}
        />
      </div>
    </div>
  );
};

export function AwardReactionBar() {
  return (
    <div>
      <Tooltip title="Funny">
        <IconButton size="medium">
          <SentimentSatisfiedAlt style={{fontSize: '1rem'}} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Award">
        <IconButton size="medium">
          <EmojiEvents style={{fontSize: '1rem'}} />
        </IconButton>
      </Tooltip>
    </div>
  );
}
