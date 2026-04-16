import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

const SettingsConnectionsSection = lazyRouteComponent(
  () => import('@/user/section/SettingsConnectionsSection'),
  'SettingsConnectionsSection',
);

export const Route = createFileRoute(
  '/_mainLayout/user/me/settings/connections',
)({
  component: SettingsConnectionsSection,
});
