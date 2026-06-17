import { postQueries } from "@rezics/api/post/post";
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { titleOfPost, unitTitleMeta } from "@/core/routing/documentTitle";
import { routeQueryOrNotFound } from "@/core/routing/resourceErrors";
import { resolveRouteReadLanguageContext } from "@/shared/models/readLanguageContext";

const ReviewPage = lazyRouteComponent(
  () => import("@/review/pages/ReviewPage"),
  "ReviewPage",
);

export const Route = createFileRoute("/_mainLayout/remark/$reviewId/")({
  loader: async ({ params, context }) => {
    const readContext = await resolveRouteReadLanguageContext(context.qc);
    const post = await routeQueryOrNotFound(
      context.qc,
      postQueries.detail(params.reviewId, {
        languages: readContext.languages,
        appLocale: readContext.appLocale,
      }),
    );
    return { post, readContext };
  },
  head: ({ loaderData }) =>
    unitTitleMeta("post", loaderData ? titleOfPost(loaderData.post) : null),
  component: ReviewPage,
});
