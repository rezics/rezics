import { notFound, permanentRedirect } from "next/navigation";

import { getPublicSlugHrefByUnitId, isUuid } from "@/features/slugs/resolve-public-slug.server";
import { ZoneSearchPage } from "@/features/zones/zone-search-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	if (!isUuid(id)) notFound();
	const slugHref = await getPublicSlugHrefByUnitId("zone", id);
	if (slugHref) permanentRedirect(`${slugHref}/search`);
	return <ZoneSearchPage baseHref={`/zone/${id}`} zoneId={id} />;
}
