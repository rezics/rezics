import {
  hydrateAuthSessionState,
  useAuthSessionStore,
} from "@rezics/api/states";
import {
  createFileRoute,
  lazyRouteComponent,
  redirect,
} from "@tanstack/react-router";

const JwtServicesPage = lazyRouteComponent(
  () => import("@/jwt-service/pages/JwtServicesPage"),
  "JwtServicesPage",
);

export const Route = createFileRoute("/_admin/jwt-services")({
  beforeLoad: async () => {
    if (useAuthSessionStore.getState().status === "idle") {
      await hydrateAuthSessionState({ requirePresence: false });
    }
    const role = useAuthSessionStore.getState().user?.role ?? null;
    if (role !== "owner") {
      throw redirect({ to: "/", replace: true });
    }
  },
  component: JwtServicesPage,
});
