import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { UnitLandingStructuredData } from "@/features/seo/components/unit-landing-structured-data";
import {
	getRequestedUnitLandingLanguage,
	type UnitLandingSearchParams,
} from "@/features/seo/data/unit-landing-search-params.server";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";
import { isUnitDetailUnitType } from "@/features/units/model/unit-detail-section";
import { isUnitId } from "@/features/units/model/unit-id";
import { UnitOverviewPage } from "@/features/units/pages/unit-overview-page";
import { UnitDetail } from "@/features/units/unit-detail";
import { isUnitType } from "@/features/units/unit-types";

export async function generateMetadata({
	params,
	searchParams,
}: {
	params: Promise<{ type: string; unit: string }>;
	searchParams: UnitLandingSearchParams;
}): Promise<Metadata> {
	const [{ type, unit }, requestedLanguage] = await Promise.all([
		params,
		getRequestedUnitLandingLanguage(searchParams),
	]);
	if (!isUnitType(type) || !isUnitId(unit)) notFound();
	return (
		await getUnitLandingSeoDocument({
			unitId: unit,
			expectedKind: type,
			canonicalPath: `/units/${type}/${unit}`,
			requestedLanguage,
		})
	).metadata;
}

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ type: string; unit: string }>;
	searchParams: UnitLandingSearchParams;
}) {
	const [{ type, unit }, requestedLanguage] = await Promise.all([
		params,
		getRequestedUnitLandingLanguage(searchParams),
	]);
	if (!isUnitType(type) || !isUnitId(unit)) notFound();
	return (
		<>
			<UnitLandingStructuredData
				canonicalPath={`/units/${type}/${unit}`}
				expectedKind={type}
				unitId={unit}
				requestedLanguage={requestedLanguage}
			/>
			{isUnitDetailUnitType(type) ? (
				<UnitOverviewPage />
			) : (
				<UnitDetail type={type} unit={unit} />
			)}
		</>
	);
}
