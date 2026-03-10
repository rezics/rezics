import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const OAuthOnboardingPage = lazyRouteComponent(
  () => import('@/user/page/OAuthOnboardingPage'),
  'OAuthOnboardingPage',
);

export const Route = createFileRoute('/_mainLayout/onboarding')({
  component: OAuthOnboardingPage,
});
