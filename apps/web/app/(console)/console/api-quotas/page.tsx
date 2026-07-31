import { ConsoleApiQuotasPage } from "@/features/console/pages/console-api-quotas-page";
import { requireConsoleRouteAccess } from "@/features/console/server/console-route-access.server";

export default async function Page() {
	await requireConsoleRouteAccess("api-quotas");
	return <ConsoleApiQuotasPage />;
}
