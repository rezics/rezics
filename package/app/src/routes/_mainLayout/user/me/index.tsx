import { createFileRoute, redirect } from "@tanstack/react-router";
import { useUserProfileStore } from "@/user";

export const Route = createFileRoute("/_mainLayout/user/me/")({
  beforeLoad: () => {
    const userId = useUserProfileStore.getState().user?.unitId;
    if (userId) {
      throw redirect({ to: "/user/$userId/profile", params: { userId } });
    }
    throw redirect({ to: "/login" });
  },
});
