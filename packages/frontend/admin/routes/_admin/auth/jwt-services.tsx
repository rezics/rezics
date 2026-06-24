import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { requireOwnerRouteAccess } from "@/admin/app/guard/adminRouteGuards";

const AuthJwtServicesPage = lazyRouteComponent(
  () => import("@/admin/auth-jwt-service/pages/AuthJwtServicesPage"),
  "AuthJwtServicesPage",
);

export const Route = createFileRoute("/_admin/auth/jwt-services")({
  beforeLoad: async () => {
    await requireOwnerRouteAccess();
  },
  component: AuthJwtServicesPage,
});
