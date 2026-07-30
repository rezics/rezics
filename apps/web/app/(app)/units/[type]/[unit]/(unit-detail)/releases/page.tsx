import { notFound } from "next/navigation";

import { isUnitId } from "@/features/units/model/unit-id";
import { UnitSeriesReleasesPage } from "@/features/units/pages/unit-series-releases-page";

export default async function Page({
	params,
}: {
	readonly params: Promise<{ type: string; unit: string }>;
}) {
	const { type, unit } = await params;
	if (type !== "series" || !isUnitId(unit)) notFound();
	return <UnitSeriesReleasesPage />;
}
