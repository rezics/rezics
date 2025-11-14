import {
  ChatBubbleOutline,
  KeyboardArrowDown,
  KeyboardArrowUp,
  Send,
  StarBorder,
  OpenInNew,
  DeleteOutlined,
  EditOutlined,
} from '@mui/icons-material';
import {Box, IconButton, Tooltip} from '@mui/material';
import React from 'react';
import {RouterLink} from './RouterLink';

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

export type ReactionBarShowProps = {
  onReply?: () => void;
  className?: string;
  size?: 'small' | 'medium' | 'large';
  fontSize?: string;
};

export const ReactionBarShow: React.FC<ReactionBarShowProps> = ({
  onReply,
  className,
  size = 'large',
  fontSize = '1.5rem',
}) => {
  const handleReply = () => {
    onReply?.();
  };

  return (
    <div
      className={`flex justify-between items-center w-full max-w-sm mx-auto ${className}`}
    >
      <div>
        <IconButton size={size} sx={{fontSize}}>
          <KeyboardArrowUp fontSize="inherit" />
        </IconButton>
        <IconButton size={size} sx={{fontSize, ml: 1}}>
          <KeyboardArrowDown fontSize="inherit" />
        </IconButton>
      </div>

      <div>
        <IconButton size={size} sx={{fontSize}} onClick={handleReply}>
          <ChatBubbleOutline fontSize="inherit" />
        </IconButton>
      </div>

      <div>
        <IconButton size={size} sx={{fontSize}}>
          <StarBorder fontSize="inherit" />
        </IconButton>
      </div>

      <div>
        <IconButton component={RouterLink} href="#" size={size} sx={{fontSize}}>
          {/* TODO 添加一个模态框，专门处理这个元素，将分享和打开全文集成在模态框里面，打开模态框的同时就复制链接 */}
          <OpenInNew fontSize="inherit" />
        </IconButton>
      </div>
    </div>
  );
};

export type ReactionBarContainerProps = ReactionBarShowProps;
export const ReactionBarContainer: React.FC<
  ReactionBarContainerProps
> = props => {
  return <ReactionBarShow {...props} />;
};
