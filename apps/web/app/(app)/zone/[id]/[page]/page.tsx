import { isAvailableZonePageSlug, ZoneHomePageSlug } from "@rezics/slug";
import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";

import { UnitLandingStructuredData } from "@/features/seo/components/unit-landing-structured-data";
import {
	getRequestedUnitLandingLanguage,
	type UnitLandingSearchParams,
} from "@/features/seo/data/unit-landing-search-params.server";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";
import {
	getPublicSlugHrefByUnitId,
	isUuid,
	resolvePublicZonePageSlug,
} from "@/features/slugs/resolve-public-slug.server";
import { ZonePage } from "@/features/zones/zone-page";
import { withContentLanguage } from "@/features/content-languages/routing/content-language-route";

export async function generateMetadata({
	params,
	searchParams,
}: {
	params: Promise<{ id: string; page: string }>;
	searchParams: UnitLandingSearchParams;
}): Promise<Metadata> {
	const [{ id, page }, requestedLanguage] = await Promise.all([
		params,
		getRequestedUnitLandingLanguage(searchParams),
	]);
	if (!isUuid(id) || !isAvailableZonePageSlug(page)) notFound();
	const zoneHref = (await getPublicSlugHrefByUnitId("zone", id)) ?? `/zone/${id}`;
	if (page === ZoneHomePageSlug)
		return (
			await getUnitLandingSeoDocument({
				unitId: id,
				expectedKind: "zone",
				canonicalPath: zoneHref,
				requestedLanguage,
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
			requestedLanguage,
		})
	).metadata;
}

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ id: string; page: string }>;
	searchParams: UnitLandingSearchParams;
}) {
	const [{ id, page }, requestedLanguage] = await Promise.all([
		params,
		getRequestedUnitLandingLanguage(searchParams),
	]);
	if (!isUuid(id) || !isAvailableZonePageSlug(page)) notFound();
	const slugHref = await getPublicSlugHrefByUnitId("zone", id);
	if (page === ZoneHomePageSlug)
		permanentRedirect(withContentLanguage(slugHref ?? `/zone/${id}`, requestedLanguage));
	const resolvedPage = await resolvePublicZonePageSlug(id, page);
	if (!resolvedPage) notFound();
	const zoneHref = slugHref ?? `/zone/${id}`;
	const canonicalHref = `${zoneHref}/${resolvedPage.slug}`;
	const destination = withContentLanguage(canonicalHref, requestedLanguage);
	if (resolvedPage.redirected) redirect(destination);
	if (slugHref) permanentRedirect(destination);
	return (
		<>
			<UnitLandingStructuredData
				canonicalPath={canonicalHref}
				expectedKind="zone_page"
				parentCanonicalPath={zoneHref}
				unitId={resolvedPage.id}
				requestedLanguage={requestedLanguage}
			/>
			<ZonePage baseHref={zoneHref} id={id} selection={{ by: "slug", slug: resolvedPage.slug }} />
		</>
	);
}
