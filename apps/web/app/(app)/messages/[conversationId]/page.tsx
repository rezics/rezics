import { notFound } from "next/navigation";

import { ConversationPage } from "@/features/messages/pages/conversation-page";
import { isUuid } from "@/features/slugs/resolve-public-slug.server";

export default async function Page({ params }: { params: Promise<{ conversationId: string }> }) {
	const { conversationId } = await params;
	if (!isUuid(conversationId)) notFound();
	return <ConversationPage conversationId={conversationId} />;
}
