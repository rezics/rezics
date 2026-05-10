import {
  hydrateAuthSessionState,
  useAuthSessionStore,
} from "@rezics/api/states";
import {
  createFileRoute,
  lazyRouteComponent,
  redirect,
} from "@tanstack/react-router";

const AuthJwtServicesPage = lazyRouteComponent(
  () => import("@/auth-jwt-service/pages/AuthJwtServicesPage"),
  "AuthJwtServicesPage",
);

export const Route = createFileRoute("/_admin/auth/jwt-services")({
  beforeLoad: async () => {
    if (useAuthSessionStore.getState().status === "idle") {
      await hydrateAuthSessionState({ requirePresence: false });
    }
    const role = useAuthSessionStore.getState().auth.role;
    if (role !== "owner") {
      throw redirect({ to: "/", replace: true });
    }
  },
  component: AuthJwtServicesPage,
});
