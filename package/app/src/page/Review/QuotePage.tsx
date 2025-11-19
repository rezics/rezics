import {AccentBarContainer} from '@component/Common/AccentBar.tsx';
// import {CollapsibleText} from '@component/Common/CollapsibleText.tsx';
import {TreeReplyComponents} from '@/component/Form/Comment/TreeReplyComponents';
import {
  Add,
  ChatBubbleOutline,
  Comment,
  Edit,
  FavoriteBorder,
} from '@mui/icons-material';
import {IconButton, Tooltip, Typography} from '@mui/material';
import React, {useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {useLocation} from 'wouter';

import {useQuery} from '@tanstack/react-query';
import {unitQueries} from '@/api/unit/unit.queries';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import {SingleCommentElementWrapper} from '@/component/Form/Comment/SingleCommentElementWrapper';
// Collapsible single review component moved to component/ReadList/Review.tsx

interface QuotePageProps {
  unitId: string;
}

export const QuotePage: React.FC<QuotePageProps> = ({unitId}) => {
  const {t} = useTranslation();
  const [, navigate] = useLocation();
  const commentRef = useRef<HTMLDivElement>(null);
  const handleGoToComments = () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: scrollIntoView is not defined in the type declaration
    commentRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  // TODO get stats from API
  const stats = {
    replies: 0,
    likes: 0,
    date: new Date().toISOString(),
  };

  const {
    data: Quote,
    isLoading,
    error: _error,
  } = useQuery(unitQueries.detail(unitId || ''));

  if (isLoading) {
    return <div className="text-center py-10">加载中...</div>;
  }

  if (!Quote?.id) {
    return <div className="text-center py-10 text-red-500">未找到摘录</div>;
  }

  return (
    <div
      className="w-full max-w-4xl mt-[60px] mx-auto"
      data-testid="booklist-page"
    >
      {/* Head */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center">
            <h2 className="text-2xl font-bold">{Quote.title}</h2>

            <div className="ml-auto">
              <Tooltip title={t('common.edit')} placement="top">
                <IconButton
                  aria-label={t('common.edit')}
                  size="small"
                  onClick={() => {
                    navigate(`/unit/${unitId}/edit`);
                  }}
                >
                  <Edit fontSize="small" />
                </IconButton>
              </Tooltip>
            </div>
          </div>

          {/* 新 API 暂无 description 字段 */}
          {/* <p className="text-gray-600">{(bookList as any).description}</p> */}
        </div>
        <div className="flex justify-between items-center">
          {Quote.user && (
            <div className="flex items-center gap-3">
              <img
                src={Quote.user.avatar || ''}
                alt="creator avatar"
                className="w-10 h-10 rounded-full shadow"
              />
              <p className="text-sm text-gray-700">{Quote.user.name}</p>
            </div>
          )}
          <div className="flex items-center gap-2">
            <IconButton aria-label={t('accessibility.favorite')} size="small">
              <FavoriteBorder fontSize="small" />
            </IconButton>
            <IconButton
              aria-label={t('accessibility.comments')}
              size="small"
              onClick={handleGoToComments}
            >
              <Comment fontSize="small" />
            </IconButton>
            <IconButton aria-label={t('accessibility.collection')} size="small">
              <Add fontSize="small" />
            </IconButton>
          </div>
        </div>
      </div>

      <div className="flex items-start mt-4">
        <FormatQuoteIcon
          sx={{
            fontSize: 30,
            color: 'text.secondary',
            mr: 1,
            mt: 0.5,
          }}
        />
        <div className="flex-1 mt-2">{Quote.content && Quote.content}</div>
      </div>

      {/* Book List */}
      {/* 新 API 暂不直接返回 books 列表，这里占位或从 metadata.items 进一步查询渲染 */}
      {/* <div className="grid grid-cols-1 gap-4 mt-6"> ... </div> */}

      {/* Likes & Comments */}

      <div className="flex items-center justify-between mt-3">
        <div className="flex gap-1">
          <Typography variant="caption" color="text.secondary">
            {stats?.replies} {t('common.reply')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {stats?.likes} {t('accessibility.favorite')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {stats?.date}
          </Typography>
        </div>
        <Typography variant="caption" color="text.disabled">
          —— {Quote.metadata?.source}
        </Typography>
      </div>

      {/* 评论区 */}
      <div ref={commentRef} className="mt-8">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <AccentBarContainer />
            <p className="text-2xl font-bold">评论</p>
          </div>

          <SingleCommentElementWrapper replyUnitId={unitId || ''}>
            <IconButton size="large" sx={{fontSize: '1.5rem'}}>
              <ChatBubbleOutline fontSize="inherit" />
            </IconButton>
          </SingleCommentElementWrapper>
        </div>

        <TreeReplyComponents unitId={unitId || ''} />
        {/* 供评论区占位符 */}
        <div className="mb-[200px]" />
      </div>
    </div>
  );
};

export default QuotePage;
