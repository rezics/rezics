import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

const SettingsProfileSection = lazyRouteComponent(
  () => import('@/user/section/SettingsProfileSection'),
  'SettingsProfileSection',
);

export const Route = createFileRoute(
  '/_mainLayout/user/me/settings/profile',
)({
  component: SettingsProfileSection,
});
