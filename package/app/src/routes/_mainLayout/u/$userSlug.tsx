import { userBySlugQuery } from "@rezics/api/user/user.queries";
import { isPublicUserSlugRouteParams } from "@rezics/contract";
import {
  createFileRoute,
  lazyRouteComponent,
  notFound,
} from "@tanstack/react-router";

const ProfileLayout = lazyRouteComponent(
  () => import("@/user/components/ProfileLayout"),
  "ProfileLayout",
);

export const Route = createFileRoute("/_mainLayout/u/$userSlug")({
  loader: async ({ params, context }) => {
    if (!isPublicUserSlugRouteParams(params)) {
      throw notFound();
    }

    return context.qc
      .ensureQueryData(userBySlugQuery(params.userSlug))
      .catch(() => {
        throw notFound();
      });
  },
  component: ProfileLayout,
});
