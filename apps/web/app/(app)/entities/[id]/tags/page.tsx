import { notFound } from "next/navigation";

import { EntityTagsPage } from "@/features/entities/pages/entity-tags-page";
import { loadUnitTagsRouteState } from "@/features/tags/routing/tag-links";
import { isUnitId } from "@/features/units/model/unit-id";

export default async function Page({
	params,
	searchParams,
}: {
	readonly params: Promise<{ id: string }>;
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const [{ id }, routeState] = await Promise.all([params, loadUnitTagsRouteState(searchParams)]);
	if (!isUnitId(id)) notFound();
	return <EntityTagsPage entityId={id} routeState={routeState} />;
}
