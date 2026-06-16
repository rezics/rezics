import { postQueries } from "@rezics/api/post/post";
import { zoneQueries } from "@rezics/api/zone/zone";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { resolveDefaultCommentContext } from "@/comment";
import {
  titleMeta,
  titleOfPost,
  titleOfZone,
} from "@/core/routing/documentTitle";
import { PostThreadPage } from "@/post";
import { resolveRouteReadLanguageContext } from "@/shared/models/readLanguageContext";

// Zone framing affects interaction defaults only: the zone's configured
// `boundary.context` seeds the comment-context selector, while the post itself
// stays a plain (non realm-routed) detail page.
// 专区框架只影响交互默认值：专区配置的 `boundary.context` 作为评论语境
// 选择器的默认值，而帖子本身仍是普通（非 realm 路由）的详情页。
function ZonePostThreadRoute() {
  const { zone } = Route.useLoaderData();

  return (
    <PostThreadPage
      defaultCommentContext={resolveDefaultCommentContext({
        kind: "zone",
        zoneContext: zone.boundary.context,
      })}
    />
  );
}

export const Route = createFileRoute("/_mainLayout/z/$slug/post/$postUnitId")({
  loader: async ({ params, context }) => {
    const readContext = await resolveRouteReadLanguageContext(context.qc);
    const readQuery = {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    };
    const [zone, post] = await Promise.all([
      context.qc.ensureQueryData(zoneQueries.detail(params.slug, readQuery)),
      context.qc.ensureQueryData(
        postQueries.detail(params.postUnitId, readQuery),
      ),
    ]).catch(() => {
      throw notFound();
    });
    return { zone, post, readContext };
  },
  head: ({ loaderData }) =>
    titleMeta(
      loaderData ? titleOfPost(loaderData.post) : null,
      loaderData ? titleOfZone(loaderData.zone) : null,
    ),
  component: ZonePostThreadRoute,
});
