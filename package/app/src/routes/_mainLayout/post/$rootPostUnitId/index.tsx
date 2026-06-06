import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

type PostThreadSearch = {
  focus?: string;
  focusPostUnitId?: string;
};

const PostThreadPage = lazyRouteComponent(
  () => import("@/post/pages/PostThreadPage"),
  "PostThreadPage",
);

export const Route = createFileRoute("/_mainLayout/post/$rootPostUnitId/")({
  validateSearch: (search: Record<string, unknown>): PostThreadSearch => {
    const focusPostUnitId =
      typeof search.focusPostUnitId === "string" &&
      search.focusPostUnitId.trim().length > 0
        ? search.focusPostUnitId
        : undefined;
    const focus =
      typeof search.focus === "string" && search.focus.trim().length > 0
        ? search.focus
        : undefined;

    return { focus, focusPostUnitId };
  },
  component: PostThreadPage,
});
