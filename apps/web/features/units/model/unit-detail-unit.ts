import type { GetApiUnitsByTypeByUnitIdStatus200 } from "@rezics/openapi-tanstack-query";

import type { UnitDetailUnitType } from "./unit-detail-section";

type UnitDetailsFor<Type extends UnitDetailUnitType> = Extract<
	GetApiUnitsByTypeByUnitIdStatus200["details"],
	{ readonly type: Type }
>;

export type UnitDetailUnitFor<Type extends UnitDetailUnitType> =
	GetApiUnitsByTypeByUnitIdStatus200 & {
		readonly type: Type;
		readonly details: UnitDetailsFor<Type>;
	};

export type UnitDetailUnit = {
	[Type in UnitDetailUnitType]: UnitDetailUnitFor<Type>;
}[UnitDetailUnitType];

export function isUnitDetailUnitFor<Type extends UnitDetailUnitType>(
	unit: GetApiUnitsByTypeByUnitIdStatus200,
	type: Type,
): unit is UnitDetailUnitFor<Type> {
	return unit.type === type && unit.details.type === type;
}
