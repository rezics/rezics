import { createFileRoute, redirect } from "@tanstack/react-router";
import { useUserProfileStore } from "@/user/states";

export const Route = createFileRoute("/_mainLayout/user/me/follow")({
  beforeLoad: () => {
    const userId = useUserProfileStore.getState().user?.unitId;
    if (userId) {
      throw redirect({
        to: "/user/$userId/followers",
        params: { userId },
      });
    }
    throw redirect({ to: "/login" });
  },
});
