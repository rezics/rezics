import { ConsoleModerationPage } from "@/features/console/pages/console-moderation-page";
import { requireConsoleRouteAccess } from "@/features/console/server/console-route-access.server";

export default async function Page() {
	await requireConsoleRouteAccess("moderation");
	return <ConsoleModerationPage />;
}
