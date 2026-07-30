import { notFound } from "next/navigation";

import { isUnitDetailUnitType } from "@/features/units/model/unit-detail-section";
import { isUnitId } from "@/features/units/model/unit-id";
import { UnitOverviewPage } from "@/features/units/pages/unit-overview-page";
import { UnitDetail } from "@/features/units/unit-detail";
import { isUnitType } from "@/features/units/unit-types";

export default async function Page({
	params,
}: {
	params: Promise<{ type: string; unit: string }>;
}) {
	const { type, unit } = await params;
	if (!isUnitType(type) || !isUnitId(unit)) notFound();
	return isUnitDetailUnitType(type) ? (
		<UnitOverviewPage />
	) : (
		<UnitDetail type={type} unit={unit} />
	);
}
