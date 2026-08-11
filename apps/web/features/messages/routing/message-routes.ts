export const MessagesHref = "/messages";

export function messageAnchorId(messageId: string): string {
	return `message-${messageId}`;
}

export function conversationHref(conversationId: string, messageId?: string): string {
	const base = `${MessagesHref}/${encodeURIComponent(conversationId)}`;
	return messageId ? `${base}#${encodeURIComponent(messageAnchorId(messageId))}` : base;
}
