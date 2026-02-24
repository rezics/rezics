import React from 'react';
import {
  RouterProvider,
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
} from '@tanstack/react-router';

export const decorators = [
  (Fixture: React.FC) => {
    const rootRoute = createRootRoute({
      component: () => <Outlet />,
    });

    const fixtureRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: Fixture,
    });

    const routeTree = rootRoute.addChildren([fixtureRoute]);

    const router = createRouter({routeTree});

    return <RouterProvider router={router} />;
  },
];
