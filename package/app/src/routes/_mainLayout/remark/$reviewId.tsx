import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const ReviewPage = lazyRouteComponent(() => import('@/page/Review/ReviewPage'), 'ReviewPage');

export const Route = createFileRoute('/_mainLayout/remark/$reviewId')({
  component: ReviewPage,
});

