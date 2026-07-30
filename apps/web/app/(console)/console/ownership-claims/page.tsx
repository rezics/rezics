import { ConsoleOwnershipClaimsPage } from "@/features/console/pages/console-ownership-claims-page";
import { requireConsoleRouteAccess } from "@/features/console/server/console-route-access.server";

export default async function Page() {
	await requireConsoleRouteAccess("ownership-claims");
	return <ConsoleOwnershipClaimsPage />;
}
