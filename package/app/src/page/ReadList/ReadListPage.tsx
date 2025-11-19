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
import {IconButton, Tooltip} from '@mui/material';
import React, {useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {useLocation, useParams} from 'wouter';

import {readlistQueries} from '@/api/readlist/readlist';
import {useQuery} from '@tanstack/react-query';
import {BookReviewGroup} from '@/component/ReadList/Review.tsx';
import {SingleCommentElementWrapper} from '@/component/Form/Comment/SingleCommentElementWrapper';
// Collapsible single review component moved to component/ReadList/Review.tsx

export const ReadListPage: React.FC = () => {
  const {t} = useTranslation();
  const {readlistId} = useParams<{readlistId: string}>();
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

  const {
    data: bookList,
    isLoading,
    error: _error,
  } = useQuery(readlistQueries.detail(readlistId || ''));

  if (isLoading) {
    return <div className="text-center py-10">加载中...</div>;
  }

  if (!bookList?.id) {
    return <div className="text-center py-10 text-red-500">未找到书单</div>;
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
            <h2 className="text-2xl font-bold">{bookList.title}</h2>

            <div className="ml-auto">
              <Tooltip title={t('common.edit')} placement="top">
                <IconButton
                  aria-label={t('common.edit')}
                  size="small"
                  onClick={() => {
                    navigate(`/readlist/${readlistId}/edit`);
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
          {bookList.creator && (
            <div className="flex items-center gap-3">
              <img
                src={bookList.creator.avatar || ''}
                alt="creator avatar"
                className="w-10 h-10 rounded-full shadow"
              />
              <p className="text-sm text-gray-700">{bookList.creator.name}</p>
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

      <div>
        {bookList.content && <div className="mt-4">{bookList.content}</div>}
      </div>

      {/* Book List */}
      {/* 新 API 暂不直接返回 books 列表，这里占位或从 metadata.items 进一步查询渲染 */}
      {/* <div className="grid grid-cols-1 gap-4 mt-6"> ... </div> */}

      {/* Likes & Comments */}
      <div className="text-sm mt-5 text-gray-700">
        <span>{bookList.likes ?? 0}</span> <span className="ml-1">likes</span>
        {/* 新 API 暂无 commentsNumber */}
      </div>

      {bookList?.order?.length === 0 && (
        <div className="text-sm text-gray-500">暂无书评</div>
      )}
      {bookList?.order?.map(unitId => {
        const reviewData = bookList?.reviews.find(r => r.unitId === unitId);
        const bookData = bookList?.books.find(
          b => b.unitId === reviewData?.targetUnitId,
        );
        if (!bookData || !reviewData) return null;
        return (
          <BookReviewGroup key={unitId} review={reviewData} book={bookData} />
        );
      })}

      {/* 评论区 */}
      <div ref={commentRef} className="mt-5">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <AccentBarContainer />
            <p className="text-2xl font-bold">评论</p>
          </div>

          <SingleCommentElementWrapper replyUnitId={readlistId || ''}>
            <IconButton size="large" sx={{fontSize: '1.5rem'}}>
              <ChatBubbleOutline fontSize="inherit" />
            </IconButton>
          </SingleCommentElementWrapper>
        </div>

        <TreeReplyComponents unitId={readlistId || ''} />
        {/* 供评论区占位符 */}
        <div className="mb-[200px]" />
      </div>
    </div>
  );
};

export default ReadListPage;
