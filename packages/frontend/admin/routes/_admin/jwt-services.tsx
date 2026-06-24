import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { requireOwnerRouteAccess } from "@/admin/app/guard/adminRouteGuards";

const JwtServicesPage = lazyRouteComponent(
  () => import("@/admin/jwt-service/pages/JwtServicesPage"),
  "JwtServicesPage",
);

export const Route = createFileRoute("/_admin/jwt-services")({
  beforeLoad: async () => {
    await requireOwnerRouteAccess();
  },
  component: JwtServicesPage,
});
