import { notFound } from "next/navigation";

import { NotificationDetailsPage } from "@/features/notifications/pages/notification-details-page";
import { isUuid } from "@/features/slugs/resolve-public-slug.server";

export default async function Page({ params }: { params: Promise<{ notificationId: string }> }) {
	const { notificationId } = await params;
	if (!isUuid(notificationId)) notFound();
	return <NotificationDetailsPage notificationId={notificationId} />;
}
