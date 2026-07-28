import { ConsoleUsersPage } from "@/features/console/pages/console-users-page";
import { requireConsoleRouteAccess } from "@/features/console/server/console-route-access.server";

export default async function Page({ params }: { readonly params: Promise<{ userId: string }> }) {
	await requireConsoleRouteAccess("users");
	return <ConsoleUsersPage selectedUserId={(await params).userId} />;
}
