import { notFound } from "next/navigation";

import { isUnitId } from "@/features/units/model/unit-id";
import { CatalogSeriesReleasesPage } from "@/features/units/pages/catalog-series-releases-page";

export default async function Page({
	params,
}: {
	readonly params: Promise<{ type: string; unit: string }>;
}) {
	const { type, unit } = await params;
	if (type !== "series" || !isUnitId(unit)) notFound();
	return <CatalogSeriesReleasesPage />;
}
