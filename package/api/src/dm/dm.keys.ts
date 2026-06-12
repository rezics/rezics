export const dmKeys = {
  all: () => ["dm"] as const,
  conversations: () => [...dmKeys.all(), "conversations"] as const,
  conversation: (id: string) => [...dmKeys.all(), "conversations", id] as const,
  messages: (conversationId: string) =>
    [...dmKeys.all(), "messages", conversationId] as const,
  blockState: (peerId: string) => [...dmKeys.all(), "block", peerId] as const,
} as const;
