import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

const SettingsPreferencesSection = lazyRouteComponent(
  () => import('@/user/section/SettingsPreferencesSection'),
  'SettingsPreferencesSection',
);

export const Route = createFileRoute(
  '/_mainLayout/user/me/settings/preferences',
)({
  component: SettingsPreferencesSection,
});
