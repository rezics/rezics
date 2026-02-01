import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const RegisterPage = lazyRouteComponent(
  () => import('@/page/Auth/RegisterPage'),
  'RegisterPage',
);

export const Route = createFileRoute('/_mainLayout/register')({
  component: RegisterPage,
});
