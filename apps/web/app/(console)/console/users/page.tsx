import { ConsoleUsersPage } from "@/features/console/pages/console-users-page";
import { requireConsoleRouteAccess } from "@/features/console/server/console-route-access.server";

export default async function Page() {
	await requireConsoleRouteAccess("users");
	return <ConsoleUsersPage selectedUserId={null} />;
}
