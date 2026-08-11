import { AccessInvitationsPage } from "@/features/notifications/pages/access-invitations-page";
import { parseSelectedInvitationId } from "@/features/notifications/routing/notification-routes";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ invitationId?: string | string[] }>;
}) {
	const { invitationId } = await searchParams;
	return <AccessInvitationsPage selectedInvitationId={parseSelectedInvitationId(invitationId)} />;
}
