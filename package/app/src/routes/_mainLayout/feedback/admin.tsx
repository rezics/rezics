import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const FeedbackAdminPage = lazyRouteComponent(
  () => import('@/page/Feedback/Admin/FeedbackAdminPage'),
  'FeedbackAdminPage',
);

export const Route = createFileRoute('/_mainLayout/feedback/admin')({
  component: FeedbackAdminPage,
});

