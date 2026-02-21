import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const ResetPasswordPage = lazyRouteComponent(
  () => import('@/user/page/ResetPasswordPage'),
  'ResetPasswordPage',
);

export const Route = createFileRoute('/_mainLayout/reset-password')({
  component: ResetPasswordPage,
});
