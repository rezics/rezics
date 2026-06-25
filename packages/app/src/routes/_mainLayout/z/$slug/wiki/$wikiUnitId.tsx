import { postQueries } from "@rezics/contract/api/post/post";
import { zoneQueries } from "@rezics/contract/api/zone/zone.queries";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { resolveDefaultCommentContext } from "@/comment";
import {
  titleContext,
  titleOfPost,
  titleOfZone,
  unitTitleMeta,
} from "@/core/routing/documentTitle";
import { PostThreadPage } from "@/post";
import { resolveRouteReadLanguageContext } from "@/shared/models/readLanguageContext";
import { zonePresentationContext } from "@/unit";

// Zone framing is presentation context; the zone's configured
// `boundary.context` independently seeds the interaction selector.
// 专区框架是展示语境；专区配置的 `boundary.context` 则独立作为互动选择器
// 的默认值。
function ZoneWikiThreadRoute() {
  const { zone } = Route.useLoaderData();
  const { slug } = Route.useParams();
  const presentationContext = zonePresentationContext({
    zoneUnitId: zone.unitId,
    zoneSlug: slug,
  });

  return (
    <PostThreadPage
      presentationContext={presentationContext}
      defaultCommentContext={resolveDefaultCommentContext({
        kind: "zone",
        presentationContext,
        zoneContext: zone.boundary.context,
      })}
    />
  );
}

export const Route = createFileRoute("/_mainLayout/z/$slug/wiki/$wikiUnitId")({
  loader: async ({ params, context }) => {
    const readContext = await resolveRouteReadLanguageContext(context.qc);
    const readQuery = {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    };
    const [zone, post] = await Promise.all([
      context.qc.ensureQueryData(zoneQueries.detail(params.slug, readQuery)),
      context.qc.ensureQueryData(
        postQueries.detail(params.wikiUnitId, readQuery),
      ),
    ]).catch(() => {
      throw notFound();
    });
    return { zone, post, readContext };
  },
  head: ({ loaderData }) =>
    unitTitleMeta("post", loaderData ? titleOfPost(loaderData.post) : null, [
      titleContext("zone", loaderData ? titleOfZone(loaderData.zone) : null),
    ]),
  component: ZoneWikiThreadRoute,
});
