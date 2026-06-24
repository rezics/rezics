import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const ShelvesTabSection = lazyRouteComponent(
  () => import("@/user/sections/ShelvesTabSection"),
  "ShelvesTabSection",
);

export const Route = createFileRoute("/_mainLayout/u/$userSlug/profile/shelf/")(
  {
    component: ShelvesTabSection,
  },
);
