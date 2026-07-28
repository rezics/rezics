import { notFound } from "next/navigation";

import { UnitProgressPage } from "@/features/progress/pages/unit-progress-page";
import { isCatalogDetailUnitType } from "@/features/units/model/catalog-detail-section";
import { isUnitId } from "@/features/units/model/unit-id";

export default async function Page({
	params,
}: {
	readonly params: Promise<{ type: string; unit: string }>;
}) {
	const { type, unit } = await params;
	if (!isCatalogDetailUnitType(type) || !isUnitId(unit)) notFound();
	return <UnitProgressPage type={type} unitId={unit} />;
}
