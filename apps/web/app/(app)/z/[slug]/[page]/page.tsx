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
	resolvePublicSlug,
	resolvePublicZonePageSlug,
} from "@/features/slugs/resolve-public-slug.server";
import { ZonePage } from "@/features/zones/zone-page";
import { withContentLanguage } from "@/features/content-languages/routing/content-language-route";

export async function generateMetadata({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string; page: string }>;
	searchParams: UnitLandingSearchParams;
}): Promise<Metadata> {
	const [{ slug, page }, requestedLanguage] = await Promise.all([
		params,
		getRequestedUnitLandingLanguage(searchParams),
	]);
	if (!isAvailableZonePageSlug(page)) notFound();
	const zone = await resolvePublicSlug("zone", slug);
	if (!zone) notFound();
	if (page === ZoneHomePageSlug)
		return (
			await getUnitLandingSeoDocument({
				unitId: zone.id,
				expectedKind: "zone",
				canonicalPath: zone.canonicalHref,
				requestedLanguage,
			})
		).metadata;
	const zonePage = await resolvePublicZonePageSlug(zone.id, page);
	if (!zonePage) notFound();
	return (
		await getUnitLandingSeoDocument({
			unitId: zonePage.id,
			expectedKind: "zone_page",
			canonicalPath: `${zone.canonicalHref}/${zonePage.slug}`,
			parentCanonicalPath: zone.canonicalHref,
			requestedLanguage,
		})
	).metadata;
}

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string; page: string }>;
	searchParams: UnitLandingSearchParams;
}) {
	const [{ slug, page }, requestedLanguage] = await Promise.all([
		params,
		getRequestedUnitLandingLanguage(searchParams),
	]);
	if (!isAvailableZonePageSlug(page)) notFound();
	const resolved = await resolvePublicSlug("zone", slug);
	if (!resolved) notFound();
	if (page === ZoneHomePageSlug) {
		const destination = withContentLanguage(resolved.canonicalHref, requestedLanguage);
		if (resolved.redirected) redirect(destination);
		permanentRedirect(destination);
	}
	const resolvedPage = await resolvePublicZonePageSlug(resolved.id, page);
	if (!resolvedPage) notFound();
	const canonicalHref = `${resolved.canonicalHref}/${resolvedPage.slug}`;
	if (resolved.redirected || resolvedPage.redirected || canonicalHref !== `/z/${slug}/${page}`)
		redirect(withContentLanguage(canonicalHref, requestedLanguage));
	return (
		<>
			<UnitLandingStructuredData
				canonicalPath={canonicalHref}
				expectedKind="zone_page"
				parentCanonicalPath={resolved.canonicalHref}
				unitId={resolvedPage.id}
				requestedLanguage={requestedLanguage}
			/>
			<ZonePage
				baseHref={resolved.canonicalHref}
				id={resolved.id}
				selection={{ by: "slug", slug: resolvedPage.slug }}
			/>
		</>
	);
}
