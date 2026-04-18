import { ThemeProvider } from "@mui/material";
import CssBaseline from "@mui/material/CssBaseline";
import { StyledEngineProvider } from "@mui/material/styles";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { getTheme } from "./config/theme";

import "virtual:uno.css";

function MockRouterWrapper({ children }: { children: ReactNode }) {
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
    path: "/",
    component: () => null,
  });

  const routeTree = rootRoute.addChildren([indexRoute]);
  const router = createRouter({ routeTree });

  return <RouterProvider router={router} />;
}

export default function CosmosDecorator({ children }: { children: ReactNode }) {
  const theme = getTheme("light");

  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <MockRouterWrapper>{children}</MockRouterWrapper>
      </ThemeProvider>
    </StyledEngineProvider>
  );
}
