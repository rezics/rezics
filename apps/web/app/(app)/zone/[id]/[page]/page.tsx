import { isAvailableZonePageSlug, ZoneHomePageSlug } from "@rezics/slug";
import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";

import { UnitLandingStructuredData } from "@/features/seo/components/unit-landing-structured-data";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";
import {
	getPublicSlugHrefByUnitId,
	isUuid,
	resolvePublicZonePageSlug,
} from "@/features/slugs/resolve-public-slug.server";
import { ZonePage } from "@/features/zones/zone-page";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string; page: string }>;
}): Promise<Metadata> {
	const { id, page } = await params;
	if (!isUuid(id) || !isAvailableZonePageSlug(page)) notFound();
	const zoneHref = (await getPublicSlugHrefByUnitId("zone", id)) ?? `/zone/${id}`;
	if (page === ZoneHomePageSlug)
		return (
			await getUnitLandingSeoDocument({
				unitId: id,
				expectedKind: "zone",
				canonicalPath: zoneHref,
			})
		).metadata;
	const zonePage = await resolvePublicZonePageSlug(id, page);
	if (!zonePage) notFound();
	return (
		await getUnitLandingSeoDocument({
			unitId: zonePage.id,
			expectedKind: "zone_page",
			canonicalPath: `${zoneHref}/${zonePage.slug}`,
			parentCanonicalPath: zoneHref,
		})
	).metadata;
}

export default async function Page({ params }: { params: Promise<{ id: string; page: string }> }) {
	const { id, page } = await params;
	if (!isUuid(id) || !isAvailableZonePageSlug(page)) notFound();
	const slugHref = await getPublicSlugHrefByUnitId("zone", id);
	if (page === ZoneHomePageSlug) permanentRedirect(slugHref ?? `/zone/${id}`);
	const resolvedPage = await resolvePublicZonePageSlug(id, page);
	if (!resolvedPage) notFound();
	const zoneHref = slugHref ?? `/zone/${id}`;
	const canonicalHref = `${zoneHref}/${resolvedPage.slug}`;
	if (resolvedPage.redirected) redirect(canonicalHref);
	if (slugHref) permanentRedirect(canonicalHref);
	return (
		<>
			<UnitLandingStructuredData
				canonicalPath={canonicalHref}
				expectedKind="zone_page"
				parentCanonicalPath={zoneHref}
				unitId={resolvedPage.id}
			/>
			<ZonePage
				baseHref={zoneHref}
				id={id}
				selection={{ by: "slug", slug: resolvedPage.slug }}
			/>
		</>
	);
}
