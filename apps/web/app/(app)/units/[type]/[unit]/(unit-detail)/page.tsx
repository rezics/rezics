import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { UnitLandingStructuredData } from "@/features/seo/components/unit-landing-structured-data";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";
import { isUnitDetailUnitType } from "@/features/units/model/unit-detail-section";
import { isUnitId } from "@/features/units/model/unit-id";
import { UnitOverviewPage } from "@/features/units/pages/unit-overview-page";
import { UnitDetail } from "@/features/units/unit-detail";
import { isUnitType } from "@/features/units/unit-types";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ type: string; unit: string }>;
}): Promise<Metadata> {
	const { type, unit } = await params;
	if (!isUnitType(type) || !isUnitId(unit)) notFound();
	return (
		await getUnitLandingSeoDocument({
			unitId: unit,
			expectedKind: type,
			canonicalPath: `/units/${type}/${unit}`,
		})
	).metadata;
}

export default async function Page({
	params,
}: {
	params: Promise<{ type: string; unit: string }>;
}) {
	const { type, unit } = await params;
	if (!isUnitType(type) || !isUnitId(unit)) notFound();
	return (
		<>
			<UnitLandingStructuredData
				canonicalPath={`/units/${type}/${unit}`}
				expectedKind={type}
				unitId={unit}
			/>
			{isUnitDetailUnitType(type) ? (
				<UnitOverviewPage />
			) : (
				<UnitDetail type={type} unit={unit} />
			)}
		</>
	);
}
