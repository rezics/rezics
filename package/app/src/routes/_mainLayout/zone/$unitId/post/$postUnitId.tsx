import { zonePortalQueryOptions } from "@rezics/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { resolveDefaultCommentContext } from "@/comment";
import { PostThreadPage } from "@/post";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { zonePresentationContext } from "@/unit";

// UnitId zone framing mirrors the slug-framed route: presentation remains the
// zone frame while `boundary.context` seeds the interaction selector.
// unitId 专区框架与 slug 路由一致：展示语境仍是专区框架，而
// `boundary.context` 作为互动选择器默认值。
function ZoneUnitPostThreadRoute() {
  const { unitId } = Route.useParams();
  const readContext = useReadLanguageContext();
  const presentationContext = zonePresentationContext({ zoneUnitId: unitId });
  const zoneQuery = useQuery({
    ...zonePortalQueryOptions(unitId, "home", {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    enabled: readContext.ready && Boolean(unitId),
  });

  return (
    <PostThreadPage
      presentationContext={presentationContext}
      defaultCommentContext={resolveDefaultCommentContext({
        kind: "zone",
        presentationContext,
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
