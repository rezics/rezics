import { ConsoleAuditPage } from "@/features/console/pages/console-audit-page";
import { requireConsoleRouteAccess } from "@/features/console/server/console-route-access.server";

export default async function Page() {
	await requireConsoleRouteAccess("audit");
	return <ConsoleAuditPage />;
}
