import { notFound } from "next/navigation";

import { isUnitDetailUnitType } from "@/features/units/model/unit-detail-section";
import { isUnitId } from "@/features/units/model/unit-id";
import { UnitCreditsPage } from "@/features/units/pages/unit-credits-page";

export default async function Page({
	params,
}: {
	params: Promise<{ type: string; unit: string }>;
}) {
	const { type, unit } = await params;
	if (!isUnitDetailUnitType(type) || !isUnitId(unit)) notFound();
	return <UnitCreditsPage type={type} unitId={unit} />;
}
