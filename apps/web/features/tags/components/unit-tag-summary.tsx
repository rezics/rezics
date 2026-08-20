"use client";

import type { TaggableUnitType } from "../model/taggable-unit";
import { UnitTagExplorer } from "./unit-tag-explorer";

export function UnitTagSummary({
	type,
	unitId,
}: {
	readonly type: TaggableUnitType;
	readonly unitId: string;
}) {
	return <UnitTagExplorer surface="section" type={type} unitId={unitId} />;
}
