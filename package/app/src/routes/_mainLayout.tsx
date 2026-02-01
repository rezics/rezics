import {
  createFileRoute,
  lazyRouteComponent,
  Outlet,
} from '@tanstack/react-router';

const MainLayout = lazyRouteComponent(
  () => import('@/feature/core/layout/MainLayout'),
  'MainLayout',
);

export const Route = createFileRoute('/_mainLayout')({
  component: () => (
    <MainLayout>
      <Outlet />
    </MainLayout>
  ),
});
