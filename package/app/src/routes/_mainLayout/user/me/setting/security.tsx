import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

const SettingsSecuritySection = lazyRouteComponent(
  () => import('@/user/sections/SettingsSecuritySection'),
  'SettingsSecuritySection',
);

export const Route = createFileRoute(
  '/_mainLayout/user/me/setting/security',
)({
  component: SettingsSecuritySection,
});
