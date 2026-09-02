"use client";

import type { TaggableUnitType } from "../model/taggable-unit";
import { UnitTagExplorer } from "./unit-tag-explorer";

export function UnitTagSummary({
	expressionPresentation = "grouped",
	type,
	unitId,
}: {
	readonly expressionPresentation?: "grouped" | "path-badges";
	readonly type: TaggableUnitType;
	readonly unitId: string;
}) {
	return (
		<UnitTagExplorer
			expressionPresentation={expressionPresentation}
			surface="section"
			type={type}
			unitId={unitId}
		/>
	);
}
