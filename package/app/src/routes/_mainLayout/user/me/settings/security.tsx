import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

const SettingsSecuritySection = lazyRouteComponent(
  () => import('@/user/section/SettingsSecuritySection'),
  'SettingsSecuritySection',
);

export const Route = createFileRoute(
  '/_mainLayout/user/me/settings/security',
)({
  component: SettingsSecuritySection,
});
