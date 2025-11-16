import {
  ChatBubbleOutline,
  KeyboardArrowDown,
  KeyboardArrowUp,
  StarBorder,
  OpenInNew,
  DeleteOutlined,
  EditOutlined,
} from '@mui/icons-material';
import {IconButton} from '@mui/material';
import React, {useState} from 'react';
import {ReactionBarToolBox} from './reactionBarToolBox';
import {useAlertStore} from '@/global/windowAlertStore';

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
  itemUrl?: string;
};

export const ReactionBarShow: React.FC<ReactionBarShowProps> = ({
  onReply,
  className,
  size = 'large',
  fontSize = '1.5rem',
  itemUrl,
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

export type ReactionBarContainerProps = ReactionBarShowProps;
export const ReactionBarContainer: React.FC<
  ReactionBarContainerProps
> = props => {
  return <ReactionBarShow {...props} />;
};
