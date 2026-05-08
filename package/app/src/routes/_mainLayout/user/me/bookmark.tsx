import { createFileRoute, redirect } from "@tanstack/react-router";
import { useUserProfileStore } from "@/user/states";

export const Route = createFileRoute("/_mainLayout/user/me/bookmark")({
  beforeLoad: () => {
    const userId = useUserProfileStore.getState().user?.userId;
    if (userId) {
      throw redirect({ to: "/user/$userId", params: { userId } });
    }
    throw redirect({ to: "/login" });
  },
});
