import {
  ChatBubbleOutline,
  KeyboardArrowDown,
  KeyboardArrowUp,
  Send,
  StarBorder,
  OpenInNew,
} from '@mui/icons-material';
import {Box, IconButton, Tooltip} from '@mui/material';
import React from 'react';
import {RouterLink} from './RouterLink';

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
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        maxWidth: '24rem', // max-w-sm in tailwindcss
        mx: 'auto',
      }}
      className={className}
    >
      <Box>
        <IconButton size={size} sx={{fontSize}}>
          <KeyboardArrowUp fontSize="inherit" />
        </IconButton>
        <IconButton size={size} sx={{fontSize, ml: 1}}>
          <KeyboardArrowDown fontSize="inherit" />
        </IconButton>
      </Box>
      <Box>
        <IconButton size={size} sx={{fontSize}} onClick={handleReply}>
          <ChatBubbleOutline fontSize="inherit" />
        </IconButton>
      </Box>
      <Box>
        <IconButton size={size} sx={{fontSize}}>
          <StarBorder fontSize="inherit" />
        </IconButton>
      </Box>
      <Box>
        <IconButton
          component={RouterLink}
          href={'#'}
          size={size}
          sx={{fontSize}}
        >
          {/* TODO 添加一个模态框，专门处理这个元素，将分享和打开全文集成在模态框里面，打开模态框的同时就复制链接 */}
          <OpenInNew fontSize="inherit" />
        </IconButton>
      </Box>
    </Box>
  );
};

export type ReactionBarContainerProps = ReactionBarShowProps;
export const ReactionBarContainer: React.FC<
  ReactionBarContainerProps
> = props => {
  return <ReactionBarShow {...props} />;
};
