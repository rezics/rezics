import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

const SettingsConnectionsSection = lazyRouteComponent(
  () => import('@/user/sections/SettingsConnectionsSection'),
  'SettingsConnectionsSection',
);

export const Route = createFileRoute(
  '/_mainLayout/user/me/setting/connections',
)({
  component: SettingsConnectionsSection,
});
