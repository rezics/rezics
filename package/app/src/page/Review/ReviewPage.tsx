import {useQuery} from '@tanstack/react-query';
import {Avatar, Box, Button, Rating, Typography} from '@mui/material';
import {Link} from 'wouter';
import {useTranslation} from 'react-i18next';

import {reviewQueries} from '@/api/review/review';
import {ReactionBarShow} from '@/component/Common/ReactionBar';
import {AccentBarWithTextShow} from '@/component/Common/AccentBar';
import {bookQueries} from '@/api/book/book';
import {BookListViewItem} from '@/component/BookLib/BookList/BookListView';
import FullScreenModal from '@/component/Common/FullScreenModal';
import {useState} from 'react';
import TreeReplyComponents from '@/component/Form/Comment/TreeReplyComponents';

export function ReviewPage({reviewId}: {reviewId: string}) {
  const {t} = useTranslation();

  const {
    data: review,
    isLoading,
    error,
  } = useQuery(reviewQueries.detail(reviewId || ''));

  const {
    data: book,
    isLoading: bookLoading,
    error: bookError,
  } = useQuery(bookQueries.detail(review?.bookId || ''));

  const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);

  return (
    <div className="w-11/12 mx-auto mt-10 max-w-4xl">
      {/* <AccentBarWithTextShow text={`${t('pages.review_page')}`} /> */}
      <div className="flex items-center justify-between">
        <div className="text-2xl font-bold">{t('pages.review_page')}</div>
        <div>
          <Button variant="contained" color="primary">
            <Link href={`/review/${reviewId}/edit`}>{t('common.edit')}</Link>
          </Button>
        </div>
      </div>
      {bookLoading ? (
        <div className="mt-6">Loading...</div>
      ) : bookError instanceof Error ? (
        <div className="mt-6 text-red-500">Error: {bookError.message}</div>
      ) : !book ? (
        <div className="mt-6">No data</div>
      ) : (
        <div className="mt-6">
          <BookListViewItem book={book} />
        </div>
      )}

      {isLoading ? (
        <div className="mt-6">Loading...</div>
      ) : error instanceof Error ? (
        <div className="mt-6 text-red-500">Error: {error.message}</div>
      ) : !review ? (
        <div className="mt-6">No data</div>
      ) : (
        <div className="mt-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            <Avatar
              src={review.user?.avatar ?? ''}
              sx={{width: 56, height: 56, borderRadius: 1}}
            />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <Typography variant="h6" className="font-bold">
                    {review.title || t('pages.review_page')}
                  </Typography>
                  <div className="text-sm text-gray-500 mt-1">
                    <span className="mr-2">{review.user?.name}</span>
                    <span className="mx-2">·</span>
                    <span>{review.created_at}</span>
                  </div>
                </div>
                <div className="text-right">
                  {!!review.rating && (
                    <Rating
                      value={review.rating / 2}
                      precision={0.5}
                      max={5}
                      readOnly
                    />
                  )}
                  <div className="text-xs text-gray-500">
                    <Link
                      href={`/book/${review.bookId}`}
                    >{`/book/${review.bookId}`}</Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <Box sx={{mt: 3}}>
            <div>{review.content}</div>
          </Box>

          {/* Reactions */}
          <Box className="w-full flex justify-end mt-4">
            <Box
              sx={{
                width: {
                  xs: '100%',
                  sm: '75%',
                  md: '50%',
                  lg: '50%',
                  xl: '33.33%',
                },
              }}
            >
              <ReactionBarShow
                onReply={() => {
                  setIsReplyModalOpen(true);
                }}
                itemUrl={`/review/${review.unitId}`}
              />
            </Box>
          </Box>
          <TreeReplyComponents unitId={review.unitId || ''} />
          {/* Footer meta */}
          <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
            <FullScreenModal
              open={isReplyModalOpen}
              onClose={() => setIsReplyModalOpen(false)}
              title="回复"
            >
              <Box>
                <TreeReplyComponents unitId={review.unitId || ''} />
              </Box>
            </FullScreenModal>
          </div>
        </div>
      )}
    </div>
  );
}
