import {createRootRoute, Outlet} from '@tanstack/react-router';
import {TanStackRouterDevtools} from '@tanstack/react-router-devtools';
import {AuthGuardProvider} from '@/app/provider/AuthGuardProvider';

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <AuthGuardProvider />
      <TanStackRouterDevtools />
    </>
  ),
});
