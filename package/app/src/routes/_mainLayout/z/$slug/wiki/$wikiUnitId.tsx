import { useZoneBySlug } from "@rezics/api/zone/zone";
import { createFileRoute } from "@tanstack/react-router";
import { resolveDefaultCommentContext } from "@/comment";
import { PostThreadPage } from "@/post";

// Zone framing affects interaction defaults only: the zone's configured
// `config.context` seeds the comment-context selector, while the wiki post
// itself stays a plain (non realm-routed) detail page.
// 专区框架只影响交互默认值：专区配置的 `config.context` 作为评论语境
// 选择器的默认值，而 wiki 帖子本身仍是普通（非 realm 路由）的详情页。
function ZoneWikiThreadRoute() {
  const { slug } = Route.useParams();
  const zoneQuery = useZoneBySlug(slug);

  return (
    <PostThreadPage
      defaultCommentContext={resolveDefaultCommentContext({
        kind: "zone",
        zoneContext: zoneQuery.data?.config.context,
      })}
    />
  );
}

export const Route = createFileRoute("/_mainLayout/z/$slug/wiki/$wikiUnitId")({
  component: ZoneWikiThreadRoute,
});
