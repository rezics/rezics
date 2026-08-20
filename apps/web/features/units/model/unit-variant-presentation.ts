import type { GetApiUnitsByTypeByUnitIdStatus200 } from "@rezics/openapi-tanstack-query";

export type UnitVariantContext = GetApiUnitsByTypeByUnitIdStatus200["variantContext"];

export type UnitVariantSummary = Extract<
	UnitVariantContext,
	{ readonly role: "main" }
>["variants"][number];

export interface PresentedVariantRelation {
	readonly relation: "main" | "variant";
	readonly unit: UnitVariantSummary;
}

export function presentVariantRelations(
	context: UnitVariantContext,
): readonly PresentedVariantRelation[] {
	if (context.role === "main")
		return context.variants.map((unit) => ({ relation: "variant", unit }));
	if (context.role === "variant" && context.main.state === "available")
		return [{ relation: "main", unit: context.main.unit }];
	return [];
}
