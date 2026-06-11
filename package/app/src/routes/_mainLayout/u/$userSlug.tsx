import { userBySlugQuery } from "@rezics/api/user/user.queries";
import { isPublicUserSlugRouteParams } from "@rezics/contract";
import {
  createFileRoute,
  notFound,
  Outlet,
} from "@tanstack/react-router";

/**
 * Slug-based user-space root, not the profile surface.
 *
 * Today the naked `/u/:userSlug` entry replace-redirects from its index route
 * to `/profile` because the public user home surface does not exist yet.
 * Generated in-app profile links should point directly at `/profile`.
 *
 * Future: load the user's public display preference from base user data and
 * either render the themed public home here or keep replace-redirecting to
 * `/profile`.
 */
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
  component: Outlet,
});
