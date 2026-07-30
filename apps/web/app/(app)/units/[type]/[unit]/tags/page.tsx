import { notFound } from "next/navigation";

import { UnitTagsPage } from "@/features/tags/pages/unit-tags-page";
import { loadUnitTagsRouteState } from "@/features/tags/routing/tag-links";
import { isUnitDetailUnitType } from "@/features/units/model/unit-detail-section";
import { isUnitId } from "@/features/units/model/unit-id";

export default async function Page({
	params,
	searchParams,
}: {
	readonly params: Promise<{ type: string; unit: string }>;
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const [{ type, unit }, routeState] = await Promise.all([
		params,
		loadUnitTagsRouteState(searchParams),
	]);
	if (!isUnitDetailUnitType(type) || !isUnitId(unit)) notFound();
	return <UnitTagsPage routeState={routeState} type={type} unitId={unit} />;
}
