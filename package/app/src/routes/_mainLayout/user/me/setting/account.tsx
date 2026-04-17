import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

const SettingsAccountSection = lazyRouteComponent(
  () => import('@/user/sections/SettingsAccountSection'),
  'SettingsAccountSection',
);

export const Route = createFileRoute(
  '/_mainLayout/user/me/setting/account',
)({
  component: SettingsAccountSection,
});
