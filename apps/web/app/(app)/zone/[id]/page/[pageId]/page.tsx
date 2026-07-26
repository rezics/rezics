import { ZoneHomePageSlug } from "@rezics/slug";
import { notFound, permanentRedirect } from "next/navigation";

import {
	getPublicSlugHrefByUnitId,
	getZonePageAddressById,
	isUuid,
} from "@/features/slugs/resolve-public-slug.server";
import { ZonePage } from "@/features/zones/zone-page";

export default async function Page({
	params,
}: {
	params: Promise<{ id: string; pageId: string }>;
}) {
	const { id, pageId } = await params;
	if (!isUuid(id) || !isUuid(pageId)) notFound();
	const [slugHref, page] = await Promise.all([
		getPublicSlugHrefByUnitId("zone", id),
		getZonePageAddressById(id, pageId),
	]);
	if (!page) notFound();
	const zoneHref = slugHref ?? `/zone/${id}`;
	if (page.slug === ZoneHomePageSlug) permanentRedirect(zoneHref);
	if (page.slug) permanentRedirect(`${zoneHref}/${page.slug}`);
	return <ZonePage baseHref={`/zone/${id}`} id={id} selection={{ by: "id", pageId }} />;
}
