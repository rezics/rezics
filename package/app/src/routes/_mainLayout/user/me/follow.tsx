import { createFileRoute, redirect } from "@tanstack/react-router";
import { useUserProfileStore } from "@/user/state";

export const Route = createFileRoute("/_mainLayout/user/me/follow")({
  beforeLoad: () => {
    const unitId = useUserProfileStore.getState().user?.unitId;
    if (unitId) {
      throw redirect({
        to: "/user/$unitId/followers",
        params: { unitId },
      });
    }
    throw redirect({ to: "/login" });
  },
});
