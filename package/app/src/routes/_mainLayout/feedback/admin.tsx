import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const FeedbackAdminPage = lazyRouteComponent(
  () => import('@/feedback/page/FeedbackAdminPage'),
  'FeedbackAdminPage',
);

export const Route = createFileRoute('/_mainLayout/feedback/admin')({
  component: FeedbackAdminPage,
});
