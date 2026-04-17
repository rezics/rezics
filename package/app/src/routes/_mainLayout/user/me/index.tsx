import { createFileRoute, redirect } from "@tanstack/react-router";
import { useUserProfileStore } from "@/user/states";

export const Route = createFileRoute("/_mainLayout/user/me/")({
  beforeLoad: () => {
    const unitId = useUserProfileStore.getState().user?.unitId;
    if (unitId) {
      throw redirect({ to: "/user/$unitId", params: { unitId } });
    }
    throw redirect({ to: "/login" });
  },
});
