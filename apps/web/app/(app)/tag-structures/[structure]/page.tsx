import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { UnitLandingStructuredData } from "@/features/seo/components/unit-landing-structured-data";
import {
	getRequestedUnitLandingLanguage,
	type UnitLandingSearchParams,
} from "@/features/seo/data/unit-landing-search-params.server";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";
import { TagStructureDetailPage } from "@/features/tags/pages/tag-structure-detail-page";
import { isUnitId } from "@/features/units/model/unit-id";

export async function generateMetadata({
	params,
	searchParams,
}: {
	readonly params: Promise<{ structure: string }>;
	readonly searchParams: UnitLandingSearchParams;
}): Promise<Metadata> {
	const [{ structure }, requestedLanguage] = await Promise.all([
		params,
		getRequestedUnitLandingLanguage(searchParams),
	]);
	if (!isUnitId(structure)) notFound();
	return (
		await getUnitLandingSeoDocument({
			unitId: structure,
			expectedKind: "structure",
			canonicalPath: `/tag-structures/${structure}`,
			requestedLanguage,
		})
	).metadata;
}

export default async function Page({
	params,
	searchParams,
}: {
	readonly params: Promise<{ structure: string }>;
	readonly searchParams: UnitLandingSearchParams;
}) {
	const [{ structure }, requestedLanguage] = await Promise.all([
		params,
		getRequestedUnitLandingLanguage(searchParams),
	]);
	if (!isUnitId(structure)) notFound();
	return (
		<>
			<UnitLandingStructuredData
				canonicalPath={`/tag-structures/${structure}`}
				expectedKind="structure"
				unitId={structure}
				requestedLanguage={requestedLanguage}
			/>
			<TagStructureDetailPage structureId={structure} />
		</>
	);
}
