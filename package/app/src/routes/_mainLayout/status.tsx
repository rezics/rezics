import {
  createFileRoute,
  lazyRouteComponent,
  redirect,
} from "@tanstack/react-router";
import { isAdminStatusRole } from "@/diagnostic/models/status";
import { useAuthSessionStore } from "@/user/states";

const StatusPage = lazyRouteComponent(
  () => import("@/diagnostic"),
  "StatusPage",
);

export const Route = createFileRoute("/_mainLayout/status")({
  beforeLoad: () => {
    const permission = useAuthSessionStore.getState().rezics.permission;
    if (!isAdminStatusRole(permission?.role)) {
      throw redirect({ to: permission ? "/" : "/login" });
    }
  },
  component: StatusPage,
});
