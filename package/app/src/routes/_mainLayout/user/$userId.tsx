import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Id-based user-space fallback root, not the profile surface.
 *
 * Today the naked `/user/:userId` entry replace-redirects from its index route
 * to `/profile` because the public user home surface does not exist yet.
 * This namespace intentionally does not redirect to `/u/:userSlug`; callers
 * holding an id can keep using the stable id fallback route.
 *
 * Future: load the user's public display preference from base user data and
 * either render the public home here or keep replace-redirecting to `/profile`.
 */
export const Route = createFileRoute("/_mainLayout/user/$userId")({
  component: Outlet,
});
