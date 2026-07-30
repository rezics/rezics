import { ConsoleUnitsPage } from "@/features/console/pages/console-units-page";
import { requireConsoleRouteAccess } from "@/features/console/server/console-route-access.server";

export default async function Page() {
	await requireConsoleRouteAccess("units");
	return <ConsoleUnitsPage />;
}
