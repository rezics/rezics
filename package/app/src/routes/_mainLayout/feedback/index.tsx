import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const FeedbackPage = lazyRouteComponent(
  () => import('@/feedback/page/FeedbackPage'),
  'FeedbackPage',
);

export const Route = createFileRoute('/_mainLayout/feedback/')({
  component: FeedbackPage,
});
