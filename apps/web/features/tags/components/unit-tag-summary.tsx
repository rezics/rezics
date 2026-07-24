"use client";

import type { CatalogDetailUnitType } from "@/features/units/model/catalog-detail-section";
import { UnitTagExplorer } from "./unit-tag-explorer";

export function UnitTagSummary({
	type,
	unitId,
}: {
	readonly type: CatalogDetailUnitType;
	readonly unitId: string;
}) {
	return <UnitTagExplorer surface="section" type={type} unitId={unitId} />;
}
