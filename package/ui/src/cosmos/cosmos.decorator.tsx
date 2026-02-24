import React from 'react';
import {ThemeProvider} from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import {StyledEngineProvider} from '@mui/material/styles';
import {getTheme} from '@package/design-system/foundation';
import {
  RouterProvider,
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
} from '@tanstack/react-router';

import '../foundation/style/layers.css';

function createMockRouter(Fixture: React.FC) {
  const rootRoute = createRootRoute({
    component: () => <Outlet />,
  });

  const fixtureRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: Fixture,
  });

  const routeTree = rootRoute.addChildren([fixtureRoute]);
  return createRouter({routeTree});
}

/**
 * Cosmos global decorators that provide:
 * - MUI design-system (Theme, CssBaseline, StyledEngineProvider)
 * - Mock TanStack Router environment
 * - Foundation CSS layers
 */
export const cosmosDecorators = [
  (Fixture: React.FC) => {
    const theme = getTheme('light');
    const router = createMockRouter(Fixture);

    return (
      <StyledEngineProvider injectFirst>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <RouterProvider router={router} />
        </ThemeProvider>
      </StyledEngineProvider>
    );
  },
];
