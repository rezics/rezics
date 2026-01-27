import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const ThemeSwitch = lazyRouteComponent(
  () => import('@/component/ui/theme-switch'),
  'ThemeSwitch',
);

export const Route = createFileRoute('/_mainLayout/theme-switch')({
  component: ThemeSwitch,
});

