import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const LoginPage = lazyRouteComponent(
  () => import('@/user/page/LoginPage'),
  'LoginPage',
);

export const Route = createFileRoute('/_mainLayout/login')({
  component: LoginPage,
});
