import {useState, useEffect} from 'react';
import {useQuery} from '@tanstack/react-query';
import EasyEditor from '@/component/Form/EasyEditor';
import {Button, Rating} from '@mui/material';
import {reviewQueries} from '@/api/review/review.queries';
import {useUpdateReviewMutation} from '@/api/review/review.mutations';
import type {UpdateReviewInput} from '@package/contract';
import {TextField} from '@mui/material';
import {useAlertStore} from '@/global/windowAlertStore';

export function ReviewEditPage({reviewId}: {reviewId: string}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [rating, setRating] = useState<number>(0);
  const [ratingInput, setRatingInput] = useState('');
  const {show} = useAlertStore();
  const {data, isLoading, isError} = useQuery(reviewQueries.detail(reviewId));

  useEffect(() => {
    if (data) {
      setTitle(data.title ?? '');
      setContent(data.content ?? '');
      setRatingInput(String(data.rating ?? 0));
    }
  }, [data]);

  useEffect(() => {
    const num = Number(ratingInput);
    if (!Number.isNaN(num)) {
      setRating(num);
    }
  }, [ratingInput]);

  const {mutate, isPending} = useUpdateReviewMutation({
    onSuccess: () => {
      show('Review updated successfully');
    },
    onError: error => {
      show(String(error));
    },
  });

  const handleSave = () => {
    const input: UpdateReviewInput = {
      title: title || undefined,
      content,
      rating,
    };

    mutate({id: reviewId, input});
  };

  if (isLoading) {
    return <div>Loading review...</div>;
  }

  if (isError || !data) {
    return <div>Failed to load review.</div>;
  }

  return (
    <div className="flex flex-col gap-4 h-full max-w-4xl mx-auto mt-4">
      <h1 className="text-xl font-semibold">Edit Review</h1>

      <div className="flex flex-col gap-2">
        <TextField
          id="standard-basic"
          label="Standard"
          variant="standard"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Rating</span>
        <Rating
          name="score-rating-10"
          size="large"
          value={rating}
          precision={0.5}
          max={10}
          onChange={(_event, value) => setRatingInput(String(value ?? 0))}
        />
        <TextField
          id="standard-basic"
          variant="standard"
          value={ratingInput}
          onChange={e => {
            const val = e.target.value;
            setRatingInput(val);
          }}
        />
      </div>
      <div className="flex-1 min-h-[300px]">
        <EasyEditor value={content} onChange={setContent} />
      </div>
      <div className="flex justify-end gap-2">
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
  );
}
