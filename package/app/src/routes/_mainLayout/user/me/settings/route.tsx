import {
  createFileRoute,
  lazyRouteComponent,
} from '@tanstack/react-router';

export const Route = createFileRoute('/_mainLayout/user/me/settings')({
  component: lazyRouteComponent(
    () => import('@/user/component/SettingsShell'),
    'SettingsShell',
  ),
});
