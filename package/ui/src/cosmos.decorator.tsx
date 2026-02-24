import type {ReactNode} from 'react';
import {ThemeProvider} from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import {StyledEngineProvider} from '@mui/material/styles';
import {getTheme} from '@package/app-shell/foundation';
import {
  RouterProvider,
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
} from '@tanstack/react-router';

function MockRouterWrapper({children}: {children: ReactNode}) {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <Outlet />
        {children}
      </>
    ),
  });

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  });

  const routeTree = rootRoute.addChildren([indexRoute]);
  const router = createRouter({routeTree});

  return <RouterProvider router={router} />;
}

export default function CosmosDecorator({children}: {children: ReactNode}) {
  const theme = getTheme('light');

  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <MockRouterWrapper>{children}</MockRouterWrapper>
      </ThemeProvider>
    </StyledEngineProvider>
  );
}
