import type { GetApiUnitsByTypeByUnitIdStatus200 } from "@rezics/openapi-tanstack-query";

import type { CatalogDetailUnitType } from "./catalog-detail-section";

type UnitDetailsFor<Type extends CatalogDetailUnitType> = Extract<
	GetApiUnitsByTypeByUnitIdStatus200["details"],
	{ readonly type: Type }
>;

export type CatalogDetailUnitFor<Type extends CatalogDetailUnitType> =
	GetApiUnitsByTypeByUnitIdStatus200 & {
		readonly type: Type;
		readonly details: UnitDetailsFor<Type>;
	};

export type CatalogDetailUnit = {
	[Type in CatalogDetailUnitType]: CatalogDetailUnitFor<Type>;
}[CatalogDetailUnitType];

export function isCatalogDetailUnitFor<Type extends CatalogDetailUnitType>(
	unit: GetApiUnitsByTypeByUnitIdStatus200,
	type: Type,
): unit is CatalogDetailUnitFor<Type> {
	return unit.type === type && unit.details.type === type;
}
