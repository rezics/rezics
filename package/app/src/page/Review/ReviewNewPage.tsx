import {type ReviewResponse} from '@package/contract';
import {ReviewEditPage} from './ReviewEditPage';
import {useState} from 'react';
import {TextField} from '@mui/material';
import {CooldownButton} from '@/component/Common/UI/Button/CooldownButton';

import {useCreateReviewMutation} from '@/api/review/review.mutations';
import {useAlertStore} from '@/global/windowAlertStore';
import {useUserStore} from '@/global/userStore';
import {useRouterState} from '@tanstack/react-router';
import {UnitType} from '@package/contract';
import {reviewNewRoute} from '@/router/router';

export function ReviewNewPage() {
  const {bookUnitId} = reviewNewRoute.useParams();
  const search = useRouterState({select: s => s.location.search ?? ''});
  const searchParams = new URLSearchParams(search);
  const [reviewData, setReviewData] = useState<ReviewResponse>(
    {} as ReviewResponse,
  );
  const {show} = useAlertStore();
  const {user} = useUserStore();
  const unitType =
    searchParams.get('tab') === 'remark' ? UnitType.REMARK : UnitType.REVIEW;
  const {mutate, isPending} = useCreateReviewMutation(
    {
      onSuccess: data => {
        show('Review created successfully');
        console.log('create review success', data);
      },
      onError: error => {
        show(`Create review failed: ${error}`);
        console.error('create review failed', error);
      },
    },
    unitType,
  );

  function handleSave() {
    console.log(reviewData);
    const userId = user?.unitId as string;
    if (!userId) {
      show('Please login first');
      return;
    }
    mutate({
      bookId: bookUnitId,
      title: reviewData.title || '',
      content: reviewData.content || '',
      rating: reviewData.rating || 0,
      userId: userId,
    });
  }
  return (
    <div>
      <div className="max-w-4xl mx-auto mt-4">
        <h1 className="text-xl font-semibold">New {unitType}</h1>
        <TextField
          label="Book Unit ID"
          variant="filled"
          className="w-full !mt-4"
          value={bookUnitId}
          disabled
        />
        <ReviewEditPage data={reviewData} setData={setReviewData} />
        <div className="flex justify-end gap-2">
          <CooldownButton
            cooldownMs={10000}
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending ? 'Submitting...' : 'Submit'}
          </CooldownButton>
        </div>
      </div>
    </div>
  );
}
