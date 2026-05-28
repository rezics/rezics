import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { requireOwnerRouteAccess } from "@/app/guard/adminRouteGuards";

const AuthJwtServicesPage = lazyRouteComponent(
  () => import("@/auth-jwt-service/pages/AuthJwtServicesPage"),
  "AuthJwtServicesPage",
);

export const Route = createFileRoute("/_admin/auth/jwt-services")({
  beforeLoad: async () => {
    await requireOwnerRouteAccess();
  },
  component: AuthJwtServicesPage,
});
