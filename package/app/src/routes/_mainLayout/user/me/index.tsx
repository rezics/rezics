import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const UserPage = lazyRouteComponent(
  () => import('@/page/User/UserPage'),
  'UserPage',
);

export const Route = createFileRoute('/_mainLayout/user/me/')({
  component: () => <UserPage isCurrentUser={true} />,
});
