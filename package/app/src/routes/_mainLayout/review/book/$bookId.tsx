import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const ReviewByBookPage = lazyRouteComponent(
  () => import('@/page/Review/ReviewByBookPage'),
  'ReviewByBookPage',
);

export const Route = createFileRoute('/_mainLayout/review/book/$bookId')({
  component: ReviewByBookPage,
});
