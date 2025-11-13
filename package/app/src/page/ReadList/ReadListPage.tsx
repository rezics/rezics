import {AccentBarContainer} from '@component/Common/AccentBar.tsx';
// import {CollapsibleText} from '@component/Common/CollapsibleText.tsx';
import {TreeReplyComponents} from '@component/Form/TreeReplyComponents.tsx';
import {
  Add,
  ChatBubbleOutline,
  Comment,
  FavoriteBorder,
} from '@mui/icons-material';
import {IconButton} from '@mui/material';
import React, {useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useParams} from 'wouter';

import {readlistQueries} from '@/api/readlist/readlist';
import {useQuery} from '@tanstack/react-query';
import {BookReviewGroup} from '@/component/ReadList/Review.tsx';
import {ReplyDrawerContainer} from '@/component/Form/ReplyDrawer.tsx';
import {useDialogStore} from '@/global/dialogStore';
import {useCreateCommentMutation} from '@/api/comment/comment.mutations';
// Collapsible single review component moved to component/ReadList/Review.tsx

export const ReadListPage: React.FC = () => {
  const {t} = useTranslation();
  const {readlistId} = useParams<{readlistId: string}>();

  const commentRef = useRef<HTMLDivElement>(null);
  const [currentReplyId, setCurrentReplyId] = useState<string | null>(null);
  const setDialogVisible = useDialogStore(state => state.setDialogVisible);

  const handleGoToComments = () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: scrollIntoView is not defined in the type declaration
    commentRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const handleReply = () => {
    console.log('reply', readlistId);
    setCurrentReplyId(readlistId);
    setDialogVisible(`reply-${readlistId}`, true);
  };

  const createCommentMutation = useCreateCommentMutation();

  const handleSubmit = (content: string) => {
    createCommentMutation.mutate({
      rootPostId: readlistId || '',
      content,
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

  function getReviewForBook(book: {unitId: string}) {
    // 暂时使用fake 逻辑
    return bookList?.reviews?.find(
      review => review.targetUnitId === book.unitId,
    );
  }

  return (
    <div
      className="w-full max-w-4xl mt-[60px] mx-auto"
      data-testid="booklist-page"
    >
      {/* Head */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold">{bookList.title}</h2>
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

      {/* Book List */}
      {/* 新 API 暂不直接返回 books 列表，这里占位或从 metadata.items 进一步查询渲染 */}
      {/* <div className="grid grid-cols-1 gap-4 mt-6"> ... </div> */}

      {/* Likes & Comments */}
      <div className="text-sm mt-5 text-gray-700">
        <span>{bookList.likes ?? 0}</span> <span className="ml-1">likes</span>
        {/* 新 API 暂无 commentsNumber */}
      </div>

      {bookList.books?.length > 0 &&
        bookList.books.map(book => (
          <BookReviewGroup
            key={book.unitId}
            book={book}
            review={getReviewForBook(book) ?? {title: '', content: ''}}
            className="mt-4"
          />
        ))}

      {/* 评论区 */}
      <div ref={commentRef} className="mt-5">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <AccentBarContainer />
            <p className="text-2xl font-bold">评论</p>
          </div>

          <IconButton
            size="large"
            sx={{fontSize: '1.5rem'}}
            onClick={handleReply}
          >
            <ChatBubbleOutline fontSize="inherit" />
          </IconButton>
        </div>

        <TreeReplyComponents unitId={readlistId || ''} />
        {/* 供评论区占位符 */}
        <div className="mb-[200px]" />
      </div>
      {currentReplyId && (
        <ReplyDrawerContainer
          dialogId={`reply-${currentReplyId}`}
          onSubmit={(content: string) => handleSubmit(content)}
        />
      )}
    </div>
  );
};

export default ReadListPage;
