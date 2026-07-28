import { ConsoleTokenPoliciesPage } from "@/features/console/pages/console-token-policies-page";
import { requireConsoleRouteAccess } from "@/features/console/server/console-route-access.server";

export default async function Page() {
	await requireConsoleRouteAccess("token-policies");
	return <ConsoleTokenPoliciesPage />;
}
