"use client";

import type { UnitDetailUnitType } from "@/features/units/model/unit-detail-section";
import { UnitTagExplorer } from "./unit-tag-explorer";

export function UnitTagSummary({
	type,
	unitId,
}: {
	readonly type: UnitDetailUnitType;
	readonly unitId: string;
}) {
	return <UnitTagExplorer surface="section" type={type} unitId={unitId} />;
}
