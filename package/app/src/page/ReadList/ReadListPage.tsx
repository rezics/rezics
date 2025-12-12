import {AccentBarContainer} from '@/component/Common/Navigation/AccentBar';
import {TreeReplyComponents} from '@/component/Form/Comment/TreeReplyComponents';
import {ChatBubbleOutline} from '@mui/icons-material';
import {Avatar, IconButton, Tooltip} from '@mui/material';
import React, {useRef} from 'react';
import {Link, useParams} from 'wouter';
import {useTranslation} from 'react-i18next';

import {readlistQueries} from '@/api/readlist/readlist';
import {useQuery} from '@tanstack/react-query';
import {BookReviewGroup} from '@/component/ReadList/Review.tsx';
import {SingleCommentElementWrapper} from '@/component/Form/Comment/SingleCommentElementWrapper';

import {
  MiniActionBar,
  MiniAdminActionBar,
} from '@/component/Common/Reaction/MiniActionBar';
import {parseReactionSummaries} from '@/util/reactionSummariesParser';
import {ReactionStatistics} from '@/component/Common/Reaction/ReactionStatistics';

export const ReadListPage: React.FC = () => {
  const {readlistId} = useParams<{readlistId: string}>();
  const commentRef = useRef<HTMLDivElement>(null);
  const {t} = useTranslation();
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
    return <div className="text-center py-10">{t('common.loading')}</div>;
  }

  if (!bookList?.id) {
    return (
      <div className="text-center py-10 text-red-500">
        {t('page.readlist.not_found')}
      </div>
    );
  }

  return (
    <div
      className="w-full max-w-4xl mt-[60px] mx-auto px-2"
      data-testid="booklist-page"
    >
      {/* Head */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center">
            <h2 className="text-2xl font-bold">{bookList.title}</h2>

            <div className="ml-auto">
              <MiniAdminActionBar
                editionURL={`/readlist/${readlistId}/edit`}
                userUnitId={bookList.creator?.unitId}
              />
            </div>
          </div>

          {/* 新 API 暂无 description 字段 */}
          {/* <p className="text-gray-600">{(bookList as any).description}</p> */}
        </div>

        <div className="flex justify-between items-center">
          {bookList.creator && (
            <Tooltip
              title={t('page.readlist.open_user_ui')}
              placement="top-start"
            >
              <Link
                href={`/user/${bookList.creator?.unitId}`}
                className="flex items-center"
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    src={bookList.creator.avatar || ''}
                    alt={bookList.creator.name || 'Avatar'}
                    variant="rounded"
                    className="shadow"
                  />
                  <p className="text-sm text-gray-700">
                    {bookList.creator.name}
                  </p>
                </div>
              </Link>
            </Tooltip>
          )}
          <div className="flex items-center gap-2">
            <MiniActionBar
              handleOnCommentClick={handleGoToComments}
              unitId={readlistId || ''}
            />
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
        <ReactionStatistics
          reactionSummaries={parseReactionSummaries(bookList.reactionSummaries)}
        />
      </div>

      {bookList?.order?.length === 0 && (
        <div className="text-sm text-gray-500">
          {t('page.readlist.no_reviews_small')}
        </div>
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
            <p className="text-2xl font-bold">{t('page.readlist.comments')}</p>
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
