import { ConsoleOverviewPage } from "@/features/console/pages/console-overview-page";
import { requireConsoleRouteAccess } from "@/features/console/server/console-route-access.server";

export default async function Page() {
	await requireConsoleRouteAccess();
	return <ConsoleOverviewPage />;
}
