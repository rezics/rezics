import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

const SettingsPreferencesSection = lazyRouteComponent(
  () => import('@/user/sections/SettingsPreferencesSection'),
  'SettingsPreferencesSection',
);

export const Route = createFileRoute(
  '/_mainLayout/user/me/setting/preferences',
)({
  component: SettingsPreferencesSection,
});
