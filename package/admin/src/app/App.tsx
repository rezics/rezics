import "github-markdown-css/github-markdown-light.css";
import { createTokenRefreshRegistry } from "@rezics/api/react-query/tokenRefreshRegistry";
import { AppShell, AuthProvider, WindowAlert } from "@rezics/app-shell";
import { NormalizedTokenName } from "@rezics/contract";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "@/router";

const AUTH_TOKENS = [
  NormalizedTokenName.AUTH_IDENTITY,
  NormalizedTokenName.REZICS_SESSION,
];

const TOKEN_REGISTRY = createTokenRefreshRegistry();

export default function App() {
  return (
    <AppShell
      features={
        <>
          <AuthProvider tokens={AUTH_TOKENS} registry={TOKEN_REGISTRY} />
          <WindowAlert />
        </>
      }
    >
      <RouterProvider router={router} />
    </AppShell>
  );
}
