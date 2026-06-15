import { userBySlugQuery } from "@rezics/api/user/user.queries";
import { isPublicUserSlugRouteParams, type UserDTO } from "@rezics/contract";
import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import {
  parentRouteLoaderData,
  titleMeta,
  titleOfUser,
} from "@/core/routing/documentTitle";

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
  head: ({ loaderData }) =>
    titleMeta(loaderData ? titleOfUser(loaderData) : null),
  component: Outlet,
});

export type UserSlugRouteLoaderData = UserDTO;

export function userSlugChildRouteLoader({
  parentMatchPromise,
}: {
  parentMatchPromise: Promise<{ loaderData?: unknown }>;
}) {
  return parentRouteLoaderData<UserSlugRouteLoaderData>(parentMatchPromise);
}
