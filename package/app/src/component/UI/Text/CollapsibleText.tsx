import {Box, Link, useTheme} from '@mui/material';
import React, {useMemo, useState} from 'react';

export type CollapsibleTextShowProps = {
  content: string;
  threshold?: number;
  isExpanded: boolean;
  onToggle: () => void;
};

export const CollapsibleTextShow: React.FC<CollapsibleTextShowProps> = ({
  content,
  threshold = 200,
  isExpanded,
  onToggle,
}) => {
  const theme = useTheme();

  const truncatedContent = useMemo(() => {
    return content.length > threshold ? content.slice(0, threshold) : content;
  }, [content, threshold]);

  return (
    <Box sx={{position: 'relative'}}>
      <Box>
        {isExpanded ? content : truncatedContent}
        {content.length > threshold && (
          <>
            {!isExpanded && '…'}{' '}
            <Link
              component="button"
              onClick={onToggle}
              sx={{
                fontSize: '0.875rem',
                color: theme.palette.primary.main,
                textDecoration: 'none',
                '&:hover': {
                  textDecoration: 'underline',
                  cursor: 'pointer',
                },
                transition: 'color 0.2s',
              }}
            >
              {isExpanded ? '收起' : '展開'}
            </Link>
          </>
        )}
      </Box>
    </Box>
  );
};

export type CollapsibleTextContainerProps = {
  content: string;
  threshold?: number;
};

export const CollapsibleTextContainer: React.FC<
  CollapsibleTextContainerProps
> = ({content, threshold = 200}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggle = () => {
    setIsExpanded(prev => !prev);
  };

  return (
    <CollapsibleTextShow
      content={content}
      threshold={threshold}
      isExpanded={isExpanded}
      onToggle={toggle}
    />
  );
};
