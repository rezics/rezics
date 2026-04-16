import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

const SettingsAccountSection = lazyRouteComponent(
  () => import('@/user/section/SettingsAccountSection'),
  'SettingsAccountSection',
);

export const Route = createFileRoute(
  '/_mainLayout/user/me/settings/account',
)({
  component: SettingsAccountSection,
});
