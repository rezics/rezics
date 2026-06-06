export const dmKeys = {
  all: () => ["dm"] as const,
  conversations: () => [...dmKeys.all(), "conversations"] as const,
  messages: (conversationId: string) =>
    [...dmKeys.all(), "messages", conversationId] as const,
  blockState: (peerId: string) => [...dmKeys.all(), "block", peerId] as const,
} as const;
