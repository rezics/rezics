import { zonePortalQueryOptions } from "@rezics/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { resolveDefaultCommentContext } from "@/comment";
import { PostThreadPage } from "@/post";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";

// UnitId zone framing mirrors the slug-framed route: the zone boundary seeds
// the comment-context selector while the post remains a direct post detail.
// unitId 专区框架与 slug 路由一致：专区 boundary 只作为评论语境默认值，
// 帖子本身仍是普通详情页。
function ZoneUnitPostThreadRoute() {
  const { unitId } = Route.useParams();
  const readContext = useReadLanguageContext();
  const zoneQuery = useQuery({
    ...zonePortalQueryOptions(unitId, "home", readContext.languages),
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
  "/_mainLayout/zone/$unitId/post/$postUnitId",
)({
  component: ZoneUnitPostThreadRoute,
});
