import { zonePortalQueryOptions } from "@rezics/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { resolveDefaultCommentContext } from "@/comment";
import { PostThreadPage } from "@/post";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";

// UnitId zone framing mirrors the slug-framed wiki route: the zone boundary
// seeds the comment-context selector while the wiki post stays direct.
// unitId 专区框架与 slug wiki 路由一致：专区 boundary 只作为评论语境默认值，
// wiki 帖子本身仍是普通详情页。
function ZoneUnitWikiThreadRoute() {
  const { unitId } = Route.useParams();
  const readContext = useReadLanguageContext();
  const zoneQuery = useQuery({
    ...zonePortalQueryOptions(unitId, "home", {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    enabled: readContext.ready && Boolean(unitId),
  });

  return (
    <PostThreadPage
      defaultCommentContext={resolveDefaultCommentContext({
        kind: "zone",
        zoneContext: zoneQuery.data?.zone.boundary.context,
      })}
    />
  );
}

export const Route = createFileRoute(
  "/_mainLayout/zone/$unitId/wiki/$wikiUnitId",
)({
  component: ZoneUnitWikiThreadRoute,
});
