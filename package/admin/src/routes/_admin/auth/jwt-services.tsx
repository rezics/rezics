import { getToken, parseJwt } from "@rezics/api/react-query/jwt";
import { NormalizedTokenName } from "@rezics/contract";
import {
  createFileRoute,
  lazyRouteComponent,
  redirect,
} from "@tanstack/react-router";

const AuthJwtServicesPage = lazyRouteComponent(
  () => import("@/auth-jwt-service/page/AuthJwtServicesPage"),
  "AuthJwtServicesPage",
);

export const Route = createFileRoute("/_admin/auth/jwt-services")({
  beforeLoad: () => {
    const token = getToken(NormalizedTokenName.AUTH_SESSION);
    const role = token ? parseJwt(token)?.role : null;
    if (role !== "owner") {
      throw redirect({ to: "/", replace: true });
    }
  },
  component: AuthJwtServicesPage,
});
