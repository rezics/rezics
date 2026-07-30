import { notFound } from "next/navigation";

import { isProgressTrackableUnitType } from "@/features/progress/model/progress-record";
import { UnitProgressPage } from "@/features/progress/pages/unit-progress-page";
import { isUnitId } from "@/features/units/model/unit-id";

export default async function Page({
	params,
}: {
	readonly params: Promise<{ type: string; unit: string }>;
}) {
	const { type, unit } = await params;
	if (!isProgressTrackableUnitType(type) || !isUnitId(unit)) notFound();
	return <UnitProgressPage type={type} unitId={unit} />;
}
