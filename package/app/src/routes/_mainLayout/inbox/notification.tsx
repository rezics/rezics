import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const NotificationPage = lazyRouteComponent(
  () => import('@/inbox/page/NotificationPage'),
  'NotificationPage',
);

export const Route = createFileRoute('/_mainLayout/inbox/notification')({
  component: NotificationPage,
});
