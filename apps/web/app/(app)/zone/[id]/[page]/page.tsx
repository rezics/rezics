import { isAvailableZonePageSlug, ZoneHomePageSlug } from "@rezics/slug";
import { notFound, permanentRedirect } from "next/navigation";

import { getPublicSlugHrefByUnitId, isUuid } from "@/features/slugs/resolve-public-slug.server";
import { ZonePage } from "@/features/zones/zone-page";

export default async function Page({ params }: { params: Promise<{ id: string; page: string }> }) {
	const { id, page } = await params;
	if (!isUuid(id) || !isAvailableZonePageSlug(page)) notFound();
	const slugHref = await getPublicSlugHrefByUnitId("zone", id);
	if (page === ZoneHomePageSlug) permanentRedirect(slugHref ?? `/zone/${id}`);
	if (slugHref) permanentRedirect(`${slugHref}/${page}`);
	return <ZonePage baseHref={`/zone/${id}`} id={id} selection={{ by: "slug", slug: page }} />;
}
