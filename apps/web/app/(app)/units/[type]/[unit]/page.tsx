import { notFound } from "next/navigation";
import { CatalogOverviewPage } from "@/features/units/pages/catalog-overview-page";
import { UnitDetail } from "@/features/units/unit-detail";
import { isCatalogDetailUnitType } from "@/features/units/model/catalog-detail-section";
import { isUnitId } from "@/features/units/model/unit-id";
import { isUnitType } from "@/features/units/unit-types";

export default async function Page({
	params,
}: {
	params: Promise<{ type: string; unit: string }>;
}) {
	const { type, unit } = await params;
	if (!isUnitType(type) || !isUnitId(unit)) notFound();
	return isCatalogDetailUnitType(type) ? (
		<CatalogOverviewPage />
	) : (
		<UnitDetail type={type} unit={unit} />
	);
}
