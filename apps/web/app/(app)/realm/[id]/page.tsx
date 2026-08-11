import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { RealmDetailPage } from "@/features/realms/realm-pages";
import { withContentLanguage } from "@/features/content-languages/routing/content-language-route";
import { UnitLandingStructuredData } from "@/features/seo/components/unit-landing-structured-data";
import {
	getRequestedUnitLandingLanguage,
	type UnitLandingSearchParams,
} from "@/features/seo/data/unit-landing-search-params.server";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";
import { getPublicSlugHrefByUnitId, isUuid } from "@/features/slugs/resolve-public-slug.server";

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
	const canonicalPath = (await getPublicSlugHrefByUnitId("realm", id)) ?? `/realm/${id}`;
	return (
		await getUnitLandingSeoDocument({
			unitId: id,
			expectedKind: "realm",
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
	const slugHref = await getPublicSlugHrefByUnitId("realm", id);
	if (slugHref) permanentRedirect(withContentLanguage(slugHref, requestedLanguage));
	return (
		<>
			<UnitLandingStructuredData
				canonicalPath={`/realm/${id}`}
				expectedKind="realm"
				unitId={id}
				requestedLanguage={requestedLanguage}
			/>
			<RealmDetailPage id={id} />
		</>
	);
}
