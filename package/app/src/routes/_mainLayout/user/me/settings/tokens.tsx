import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

const SettingsTokensSection = lazyRouteComponent(
  () => import('@/user/section/SettingsTokensSection'),
  'SettingsTokensSection',
);

export const Route = createFileRoute(
  '/_mainLayout/user/me/settings/tokens',
)({
  component: SettingsTokensSection,
});
