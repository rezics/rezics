import { postQueries } from "@rezics/api/post/post";
import {
  createFileRoute,
  lazyRouteComponent,
  notFound,
} from "@tanstack/react-router";
import { titleMeta, titleOfPost } from "@/core/routing/documentTitle";
import { resolveRouteReadLanguageContext } from "@/shared/models/readLanguageContext";

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
  loader: async ({ params, context }) => {
    const readContext = await resolveRouteReadLanguageContext(context.qc);
    const post = await context.qc
      .ensureQueryData(
        postQueries.detail(params.rootPostUnitId, {
          languages: readContext.languages,
          appLocale: readContext.appLocale,
        }),
      )
      .catch(() => {
        throw notFound();
      });
    return { post, readContext };
  },
  head: ({ loaderData }) =>
    titleMeta(loaderData ? titleOfPost(loaderData.post) : null),
  component: PostThreadPage,
});
