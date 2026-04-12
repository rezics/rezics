import "github-markdown-css/github-markdown-light.css";
import { AppShell, AuthProvider, WindowAlert } from "@rezics/app-shell";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "@/router";

export default function App() {
  return (
    <AppShell
      features={
        <>
          <AuthProvider />
          <WindowAlert />
        </>
      }
    >
      <RouterProvider router={router} />
    </AppShell>
  );
}
