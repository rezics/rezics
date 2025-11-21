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
import {IconButton, Tooltip} from '@mui/material';
import React, {useState} from 'react';
import {ReactionBarToolBox} from './reactionBarToolBox';
import {useAlertStore} from '@/global/windowAlertStore';

import {
  useCreateReactionMutation,
  useDeleteReactionMutation,
} from '@/api/reaction/reaction.mutations';

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
}) => {
  const handleReply = () => {
    onReply?.();
  };

  const [isToolBoxOpen, setIsToolBoxOpen] = useState(false);
  const {show: showAlert} = useAlertStore();

  return (
    <div
      className={`flex justify-between items-center w-full max-w-sm mx-auto ${className}`}
    >
      {!hideLike && (
        <div>
          <IconButton size={size} sx={{fontSize}}>
            <ThumbUpAltOutlinedIcon fontSize="inherit" />
          </IconButton>
        </div>
      )}
      {!hideDislike && (
        <div>
          <IconButton size={size} sx={{fontSize}}>
            <ThumbDownAltOutlinedIcon fontSize="inherit" />
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
          <IconButton size={size} sx={{fontSize}}>
            <StarBorder fontSize="inherit" />
          </IconButton>
        </div>
      )}

      {!hideShare && (
        <div>
          <IconButton
            size={size}
            sx={{fontSize}}
            onClick={() => {
              showAlert('链接已经复制到剪贴板');
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
