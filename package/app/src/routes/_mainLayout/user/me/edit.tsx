import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const UserEditPage = lazyRouteComponent(
  () => import('@/page/User/UserEditPage'),
  'UserEditPage',
);

export const Route = createFileRoute('/_mainLayout/user/me/edit')({
  component: UserEditPage,
});
