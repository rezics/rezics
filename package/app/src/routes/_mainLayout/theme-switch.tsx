import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const ThemeSwitch = lazyRouteComponent(
  () => import('@package/ui/shadcn/theme-switch.tsx'),
  'ThemeSwitch',
);

export const Route = createFileRoute('/_mainLayout/theme-switch')({
  component: ThemeSwitch,
});
