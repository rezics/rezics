import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { UnitLandingStructuredData } from "@/features/seo/components/unit-landing-structured-data";
import {
	getRequestedUnitLandingLanguage,
	type UnitLandingSearchParams,
} from "@/features/seo/data/unit-landing-search-params.server";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";
import { TagOverviewPage } from "@/features/tags/pages/tag-overview-page";
import { isUnitId } from "@/features/units/model/unit-id";

export async function generateMetadata({
	params,
	searchParams,
}: {
	params: Promise<{ tag: string }>;
	searchParams: UnitLandingSearchParams;
}): Promise<Metadata> {
	const [{ tag }, requestedLanguage] = await Promise.all([
		params,
		getRequestedUnitLandingLanguage(searchParams),
	]);
	if (!isUnitId(tag)) notFound();
	return (
		await getUnitLandingSeoDocument({
			unitId: tag,
			expectedKind: "tag",
			canonicalPath: `/tags/${tag}`,
			requestedLanguage,
		})
	).metadata;
}

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ tag: string }>;
	searchParams: UnitLandingSearchParams;
}) {
	const [{ tag }, requestedLanguage] = await Promise.all([
		params,
		getRequestedUnitLandingLanguage(searchParams),
	]);
	if (!isUnitId(tag)) notFound();
	return (
		<>
			<UnitLandingStructuredData
				canonicalPath={`/tags/${tag}`}
				expectedKind="tag"
				unitId={tag}
				requestedLanguage={requestedLanguage}
			/>
			<TagOverviewPage />
		</>
	);
}
