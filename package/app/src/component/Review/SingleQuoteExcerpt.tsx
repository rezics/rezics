import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import {Avatar, Paper, Typography, Tooltip, IconButton} from '@mui/material';
import {Link} from 'wouter';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import React from 'react';
import {useTranslation} from 'react-i18next';

import {CollapsibleByLineTextContainer} from '../Common/CollapsibleByLineText';
import {RouterLink} from '../Common/RouterLink';

export type SingleQuoteExcerptShowProps = {
  author: {
    unitId: string;
    name: string;
    avatar: string;
  };
  content: string;
  stats: {
    replies: number;
    likes: number;
    date: string;
  };
  source: string;
  originalLink: string;
};

export const SingleQuoteExcerptShow: React.FC<SingleQuoteExcerptShowProps> = ({
  author,
  content,
  stats,
  source,
  originalLink,
}) => {
  const {t} = useTranslation();
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        position: 'relative',
        '& .MuiPaper-root': {
          borderColor: 'divider',
        },
      }}
    >
      <Tooltip title="打开全文">
        <IconButton
          component={RouterLink}
          href={originalLink}
          size="small"
          sx={{position: 'absolute', top: 8, right: 8}}
          aria-label="打开全文"
        >
          <OpenInNewIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <div className="flex items-center mb-2">
        <Tooltip title={'打开用户界面'} placement="top-start">
          <Link href={`/user/${author.unitId}`} className="flex items-center">
            <Avatar
              src={author.avatar}
              sx={{width: 20, height: 20, mr: 1}}
              variant="rounded"
            />
            <Typography variant="subtitle2" fontWeight="bold">
              {author.name}
            </Typography>
          </Link>
        </Tooltip>
      </div>

      <div className="flex items-start">
        <FormatQuoteIcon
          sx={{
            fontSize: 30,
            color: 'text.secondary',
            mr: 1,
            mt: 0.5,
          }}
        />
        <div className="flex-1">
          <Typography
            component="div"
            variant="body2"
            color="text.primary"
            sx={{lineHeight: 1.6}}
          >
            <CollapsibleByLineTextContainer content={content} />
          </Typography>

          <div className="flex items-center justify-between mt-3">
            <div className="flex gap-1">
              {/* <Typography variant="caption" color="text.secondary">
                {stats.replies} {t('common.reply')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {stats.likes} {t('accessibility.favorite')}
              </Typography> */}
              <Typography variant="caption" color="text.secondary">
                {stats.date}
              </Typography>
            </div>
            <Typography variant="caption" color="text.disabled">
              —— {source}
            </Typography>
          </div>
        </div>
      </div>
    </Paper>
  );
};

export type SingleQuoteExcerptContainerProps = any;
export const SingleQuoteExcerptContainer: React.FC<
  SingleQuoteExcerptContainerProps
> = () => {
  const res = {} as SingleQuoteExcerptShowProps;
  return <SingleQuoteExcerptShow {...res} />;
};
