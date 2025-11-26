import {useState, useEffect} from 'react';
import {useQuery} from '@tanstack/react-query';
import EasyEditor from '@/component/Form/EasyEditor';
import {Button, Rating} from '@mui/material';
import {reviewQueries} from '@/api/review/review.queries';
import {
  useUpdateReviewMutation,
  useDeleteReviewMutation,
} from '@/api/review/review.mutations';
import type {ReviewResponse, UpdateReviewInput} from '@package/contract';
import {TextField} from '@mui/material';
import {useAlertStore} from '@/global/windowAlertStore';
import {DeleteButton} from '@/component/Form/DeleteWrapper';
import {useLocation} from 'wouter';
interface ReviewEditPageProps {
  data: ReviewResponse;
  setData: (data: ReviewResponse) => void;
}

export function ReviewEditPage({data, setData}: ReviewEditPageProps) {
  const [ratingInput, setRatingInput] = useState('');

  useEffect(() => {
    const num = Number(ratingInput);
    if (!Number.isNaN(num)) {
      setData({...data, rating: num});
    }
  }, [ratingInput]);

  return (
    <div className="flex flex-col gap-4 mt-2">
      <div className="flex flex-col gap-2">
        <TextField
          id="standard-basic"
          label="Title"
          variant="standard"
          value={data.title || ''}
          onChange={e => setData({...data, title: e.target.value})}
        />
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Rating</span>
        <Rating
          name="score-rating-10"
          size="large"
          value={data.rating || 0}
          precision={0.5}
          max={10}
          onChange={(_event, value) => setRatingInput(String(value ?? 0))}
        />
        <TextField
          variant="standard"
          value={ratingInput}
          onChange={e => {
            const val = e.target.value;

            // 允许：空、整数、小数但最多一位，例如 "7", "7.", "7.3"
            if (/^\d{0,2}(\.\d?)?$/.test(val)) {
              setRatingInput(val);
            }
          }}
          onBlur={() => {
            // 失焦时自动修正，例如 "7." -> "7"
            if (ratingInput.endsWith('.')) {
              setRatingInput(ratingInput.slice(0, -1));
            }
          }}
        />
      </div>
      <div className="flex-1 min-h-[300px]">
        <EasyEditor
          value={data.content || ''}
          onChange={value => setData({...data, content: value})}
        />
      </div>
    </div>
  );
}

export function ReviewEditPageContainer({reviewId}: {reviewId: string}) {
  const {data, isLoading, isError} = useQuery(reviewQueries.detail(reviewId));
  const [_location, navigate] = useLocation();
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
      show('Review updated successfully');
    },
    onError: error => {
      show(String(error));
    },
  });

  const {mutate: deleteReviewMutation, isPending: _isDeleting} =
    useDeleteReviewMutation({
      onSuccess: () => {
        show('Review deleted successfully');
      },
      onError: error => {
        show(String(error));
      },
    });
  function handleSave() {
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
        show('Review deleted successfully');
        navigate(`/review/book/${reviewData.bookId}`);
      },
      onError: error => {
        show(`Review delete failed: ${error}`);
      },
    });
  }

  if (isLoading) {
    return <div>Loading review...</div>;
  }

  if (isError || !data) {
    return <div>Failed to load review.</div>;
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
            {isPending ? 'Submitting...' : 'Submit'}
          </Button>
        </div>
      </div>
    </div>
  );
}
