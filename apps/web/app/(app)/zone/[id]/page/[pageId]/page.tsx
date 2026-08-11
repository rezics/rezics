import { ZoneHomePageSlug } from "@rezics/slug";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { UnitLandingStructuredData } from "@/features/seo/components/unit-landing-structured-data";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";
import {
	getPublicSlugHrefByUnitId,
	getZonePageAddressById,
	isUuid,
} from "@/features/slugs/resolve-public-slug.server";
import { ZonePage } from "@/features/zones/zone-page";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string; pageId: string }>;
}): Promise<Metadata> {
	const { id, pageId } = await params;
	if (!isUuid(id) || !isUuid(pageId)) notFound();
	const [slugHref, page] = await Promise.all([
		getPublicSlugHrefByUnitId("zone", id),
		getZonePageAddressById(id, pageId),
	]);
	if (!page) notFound();
	const zoneHref = slugHref ?? `/zone/${id}`;
	if (page.slug === ZoneHomePageSlug)
		return (
			await getUnitLandingSeoDocument({
				unitId: id,
				expectedKind: "zone",
				canonicalPath: zoneHref,
			})
		).metadata;
	const canonicalPath = page.slug ? `${zoneHref}/${page.slug}` : `/zone/${id}/page/${pageId}`;
	return (
		await getUnitLandingSeoDocument({
			unitId: pageId,
			expectedKind: "zone_page",
			canonicalPath,
			parentCanonicalPath: zoneHref,
		})
	).metadata;
}

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
	const canonicalPath = `/zone/${id}/page/${pageId}`;
	return (
		<>
			<UnitLandingStructuredData
				canonicalPath={canonicalPath}
				expectedKind="zone_page"
				parentCanonicalPath={zoneHref}
				unitId={pageId}
			/>
			<ZonePage baseHref={`/zone/${id}`} id={id} selection={{ by: "id", pageId }} />
		</>
	);
}
