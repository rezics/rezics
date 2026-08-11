import type { Metadata } from "next";

import { CollectionDetailPage } from "@/features/collections/pages/collection-detail-page";
import { UnitLandingStructuredData } from "@/features/seo/components/unit-landing-structured-data";
import {
	getRequestedUnitLandingLanguage,
	type UnitLandingSearchParams,
} from "@/features/seo/data/unit-landing-search-params.server";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";

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
	return (
		await getUnitLandingSeoDocument({
			unitId: id,
			expectedKind: "collection",
			canonicalPath: `/collections/${id}`,
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
	const seo = {
		unitId: id,
		expectedKind: "collection",
		canonicalPath: `/collections/${id}`,
		requestedLanguage,
	} as const;
	return (
		<>
			<UnitLandingStructuredData {...seo} />
			<CollectionDetailPage collectionId={id} />
		</>
	);
}
