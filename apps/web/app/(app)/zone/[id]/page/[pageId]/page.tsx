import { ZoneHomePageSlug } from "@rezics/slug";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { UnitLandingStructuredData } from "@/features/seo/components/unit-landing-structured-data";
import {
	getRequestedUnitLandingLanguage,
	type UnitLandingSearchParams,
} from "@/features/seo/data/unit-landing-search-params.server";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";
import {
	getPublicSlugHrefByUnitId,
	getZonePageAddressById,
	isUuid,
} from "@/features/slugs/resolve-public-slug.server";
import { ZonePage } from "@/features/zones/zone-page";
import { withContentLanguage } from "@/features/content-languages/routing/content-language-route";

export async function generateMetadata({
	params,
	searchParams,
}: {
	params: Promise<{ id: string; pageId: string }>;
	searchParams: UnitLandingSearchParams;
}): Promise<Metadata> {
	const [{ id, pageId }, requestedLanguage] = await Promise.all([
		params,
		getRequestedUnitLandingLanguage(searchParams),
	]);
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
				requestedLanguage,
			})
		).metadata;
	const canonicalPath = page.slug ? `${zoneHref}/${page.slug}` : `/zone/${id}/page/${pageId}`;
	return (
		await getUnitLandingSeoDocument({
			unitId: pageId,
			expectedKind: "zone_page",
			canonicalPath,
			parentCanonicalPath: zoneHref,
			requestedLanguage,
		})
	).metadata;
}

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ id: string; pageId: string }>;
	searchParams: UnitLandingSearchParams;
}) {
	const [{ id, pageId }, requestedLanguage] = await Promise.all([
		params,
		getRequestedUnitLandingLanguage(searchParams),
	]);
	if (!isUuid(id) || !isUuid(pageId)) notFound();
	const [slugHref, page] = await Promise.all([
		getPublicSlugHrefByUnitId("zone", id),
		getZonePageAddressById(id, pageId),
	]);
	if (!page) notFound();
	const zoneHref = slugHref ?? `/zone/${id}`;
	if (page.slug === ZoneHomePageSlug)
		permanentRedirect(withContentLanguage(zoneHref, requestedLanguage));
	if (page.slug)
		permanentRedirect(withContentLanguage(`${zoneHref}/${page.slug}`, requestedLanguage));
	const canonicalPath = `/zone/${id}/page/${pageId}`;
	return (
		<>
			<UnitLandingStructuredData
				canonicalPath={canonicalPath}
				expectedKind="zone_page"
				parentCanonicalPath={zoneHref}
				unitId={pageId}
				requestedLanguage={requestedLanguage}
			/>
			<ZonePage baseHref={`/zone/${id}`} id={id} selection={{ by: "id", pageId }} />
		</>
	);
}
