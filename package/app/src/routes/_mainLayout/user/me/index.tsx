import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const UserPage = lazyRouteComponent(
  () => import('@/user/page/UserPage'),
  'UserPage',
);

export const Route = createFileRoute('/_mainLayout/user/me/')({
  component: () => <UserPage isCurrentUser={true} />,
});
