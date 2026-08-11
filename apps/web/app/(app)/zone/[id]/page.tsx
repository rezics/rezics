import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { UnitLandingStructuredData } from "@/features/seo/components/unit-landing-structured-data";
import { withContentLanguage } from "@/features/content-languages/routing/content-language-route";
import {
	getRequestedUnitLandingLanguage,
	type UnitLandingSearchParams,
} from "@/features/seo/data/unit-landing-search-params.server";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";
import { getPublicSlugHrefByUnitId, isUuid } from "@/features/slugs/resolve-public-slug.server";
import { ZonePage } from "@/features/zones/zone-page";

export async function generateMetadata({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: UnitLandingSearchParams;
}): Promise<Metadata> {
	const [{ id }, requestedLanguage] = await Promise.all([
		params,
		getRequestedUnitLandingLanguage(searchParams),
	]);
	if (!isUuid(id)) notFound();
	const canonicalPath = (await getPublicSlugHrefByUnitId("zone", id)) ?? `/zone/${id}`;
	return (
		await getUnitLandingSeoDocument({
			unitId: id,
			expectedKind: "zone",
			canonicalPath,
			requestedLanguage,
		})
	).metadata;
}

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: UnitLandingSearchParams;
}) {
	const [{ id }, requestedLanguage] = await Promise.all([
		params,
		getRequestedUnitLandingLanguage(searchParams),
	]);
	if (!isUuid(id)) notFound();
	const slugHref = await getPublicSlugHrefByUnitId("zone", id);
	if (slugHref) permanentRedirect(withContentLanguage(slugHref, requestedLanguage));
	return (
		<>
			<UnitLandingStructuredData
				canonicalPath={`/zone/${id}`}
				expectedKind="zone"
				unitId={id}
				requestedLanguage={requestedLanguage}
			/>
			<ZonePage baseHref={`/zone/${id}`} id={id} />
		</>
	);
}
