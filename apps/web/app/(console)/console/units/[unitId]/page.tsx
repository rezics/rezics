import { notFound } from "next/navigation";

import { ConsoleUnitsPage } from "@/features/console/pages/console-units-page";
import { requireConsoleRouteAccess } from "@/features/console/server/console-route-access.server";
import { isUuid } from "@/features/slugs/resolve-public-slug.server";

export default async function Page({ params }: { readonly params: Promise<{ unitId: string }> }) {
	await requireConsoleRouteAccess("units");
	const { unitId } = await params;
	if (!isUuid(unitId)) notFound();
	return <ConsoleUnitsPage initialUnitId={unitId} />;
}
