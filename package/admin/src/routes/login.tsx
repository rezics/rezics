import { createFileRoute } from "@tanstack/react-router";

import LoginPage from "@/user/page/LoginPage";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: LoginPage,
});
