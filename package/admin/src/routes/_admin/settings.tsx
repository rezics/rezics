import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

export const Route = createFileRoute('/_admin/settings')({
  component: lazyRouteComponent(() => import('@/page/SettingsPage'), 'default'),
});

