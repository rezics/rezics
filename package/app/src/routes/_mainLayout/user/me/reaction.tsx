import { createFileRoute, redirect } from "@tanstack/react-router";
import { useUserProfileStore } from "@/user/state";

export const Route = createFileRoute("/_mainLayout/user/me/reaction")({
  beforeLoad: () => {
    const unitId = useUserProfileStore.getState().user?.unitId;
    if (unitId) {
      throw redirect({
        to: "/user/$unitId/reactions",
        params: { unitId },
      });
    }
    throw redirect({ to: "/login" });
  },
});
