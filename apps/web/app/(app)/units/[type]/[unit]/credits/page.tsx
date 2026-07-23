import { notFound } from "next/navigation";

import { isCatalogDetailUnitType } from "@/features/units/model/catalog-detail-section";
import { isUnitId } from "@/features/units/model/unit-id";
import { CatalogCreditsPage } from "@/features/units/pages/catalog-credits-page";

export default async function Page({
	params,
}: {
	params: Promise<{ type: string; unit: string }>;
}) {
	const { type, unit } = await params;
	if (!isCatalogDetailUnitType(type) || !isUnitId(unit)) notFound();
	return <CatalogCreditsPage type={type} unitId={unit} />;
}
