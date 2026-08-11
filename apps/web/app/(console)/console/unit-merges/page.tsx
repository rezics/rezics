import { ConsoleUnitMergesPage } from "@/features/console/pages/console-unit-merges-page";
import { requireConsoleRouteAccess } from "@/features/console/server/console-route-access.server";

export default async function Page() {
	await requireConsoleRouteAccess("unit-merges");
	return <ConsoleUnitMergesPage />;
}
