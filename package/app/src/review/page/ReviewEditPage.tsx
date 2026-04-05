import {useState, useEffect} from 'react';
import {useQuery} from '@tanstack/react-query';
import {RezicsMarkdownEditor} from '@rezics/ui/editor';
import {Button} from '@mui/material';
import {reviewQueries} from '@rezics/api/review/review.queries';
import {
  useUpdateReviewMutation,
  useDeleteReviewMutation,
} from '@rezics/api/review/review.mutations';
import type {ReviewResponse, UpdateReviewInput} from '@rezics/contract';
import {TextField} from '@mui/material';
import {useTranslation} from 'react-i18next';
import {useAlertStore} from '@app/state/windowAlertStore';
import {DeleteButton} from '@rezics/ui/composite/form/DeleteWrapper.tsx';
import {useNavigate} from '@tanstack/react-router';
import {RatingWithInput} from '@rezics/ui/primitive/control/rating/Rating.tsx';
import {reviewEditRoute} from '@/router';

interface ReviewEditPageProps {
  data: ReviewResponse;
  setData: (data: ReviewResponse) => void;
}

export function ReviewEditPage({data, setData}: ReviewEditPageProps) {
  const {t} = useTranslation();
  return (
    <div className="flex flex-col gap-4 mt-2">
      <div className="flex flex-col gap-2">
        <TextField
          id="standard-basic"
          label={t('review.form.title')}
          variant="standard"
          value={data.title || ''}
          onChange={e => setData({...data, title: e.target.value})}
        />
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">{t('review.form.rating')}</span>
        <RatingWithInput
          value={data.rating || 0}
          onChange={value => setData({...data, rating: value ?? 0})}
          max={10}
          precision={0.5}
          size="large"
          name="score-rating-10"
        />
      </div>
      <div className="flex-1 min-h-[300px]">
        <RezicsMarkdownEditor
          value={data.content || ''}
          onChange={value => setData({...data, content: value})}
        />
      </div>
    </div>
  );
}

export function ReviewEditPageContainer() {
  const {reviewId} = reviewEditRoute.useParams();
  const {t} = useTranslation();
  const {data, isLoading, isError} = useQuery(reviewQueries.detail(reviewId));
  const navigate = useNavigate();
  const [reviewData, setReviewData] = useState<ReviewResponse>(
    {} as ReviewResponse,
  );
  useEffect(() => {
    if (data) {
      setReviewData(data);
    }
  }, [data]);

  const {show} = useAlertStore();

  const {mutate, isPending} = useUpdateReviewMutation({
    onSuccess: () => {
      show(t('review.messages.update_success'));
    },
    onError: error => {
      show(String(error));
    },
  });

  const {mutate: deleteReviewMutation, isPending: _isDeleting} =
    useDeleteReviewMutation({
      onSuccess: () => {
        show(t('review.messages.delete_success'));
      },
      onError: error => {
        show(String(error));
      },
    });
  function handleSave() {
    if (reviewData.rating) {
      if (reviewData.rating > 10 || reviewData.rating < 0) {
        show(t('review.messages.rating_range_error'));
        return;
      }
    }

    const input: UpdateReviewInput = {
      title: reviewData.title || undefined,
      content: reviewData.content || '',
      rating: reviewData.rating || 0,
    };

    mutate({id: reviewId, input});
  }

  function handleDelete() {
    deleteReviewMutation(reviewId, {
      onSuccess: () => {
        show(t('review.messages.delete_success'));
        navigate({to: `/review/book/${reviewData.bookId}`});
      },
      onError: error => {
        show(`Review delete failed: ${error}`);
      },
    });
  }

  if (isLoading) {
    return <div>{t('common.loading')}</div>;
  }

  if (isError || !data) {
    return <div>{t('review.messages.failed_load')}</div>;
  }

  return (
    <div>
      <div className="max-w-4xl mx-auto mt-4">
        <h1 className="text-xl font-semibold">Edit Review</h1>
        <ReviewEditPage data={reviewData} setData={setReviewData} />

        <div className="flex justify-end gap-2">
          <DeleteButton onDelete={handleDelete} />
          <Button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending ? t('common.submitting') : t('common.submit')}
          </Button>
        </div>
      </div>
    </div>
  );
}
