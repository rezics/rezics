import { isAvailableZonePageSlug, ZoneHomePageSlug } from "@rezics/slug";
import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";

import { UnitLandingStructuredData } from "@/features/seo/components/unit-landing-structured-data";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";
import {
	resolvePublicSlug,
	resolvePublicZonePageSlug,
} from "@/features/slugs/resolve-public-slug.server";
import { ZonePage } from "@/features/zones/zone-page";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string; page: string }>;
}): Promise<Metadata> {
	const { slug, page } = await params;
	if (!isAvailableZonePageSlug(page)) notFound();
	const zone = await resolvePublicSlug("zone", slug);
	if (!zone) notFound();
	if (page === ZoneHomePageSlug)
		return (
			await getUnitLandingSeoDocument({
				unitId: zone.id,
				expectedKind: "zone",
				canonicalPath: zone.canonicalHref,
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
		})
	).metadata;
}

export default async function Page({
	params,
}: {
	params: Promise<{ slug: string; page: string }>;
}) {
	const { slug, page } = await params;
	if (!isAvailableZonePageSlug(page)) notFound();
	const resolved = await resolvePublicSlug("zone", slug);
	if (!resolved) notFound();
	if (page === ZoneHomePageSlug) {
		if (resolved.redirected) redirect(resolved.canonicalHref);
		permanentRedirect(resolved.canonicalHref);
	}
	const resolvedPage = await resolvePublicZonePageSlug(resolved.id, page);
	if (!resolvedPage) notFound();
	const canonicalHref = `${resolved.canonicalHref}/${resolvedPage.slug}`;
	if (resolved.redirected || resolvedPage.redirected || canonicalHref !== `/z/${slug}/${page}`)
		redirect(canonicalHref);
	return (
		<>
			<UnitLandingStructuredData
				canonicalPath={canonicalHref}
				expectedKind="zone_page"
				parentCanonicalPath={resolved.canonicalHref}
				unitId={resolvedPage.id}
			/>
			<ZonePage
				baseHref={resolved.canonicalHref}
				id={resolved.id}
				selection={{ by: "slug", slug: resolvedPage.slug }}
			/>
		</>
	);
}
