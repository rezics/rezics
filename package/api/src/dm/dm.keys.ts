export const dmKeys = {
  all: () => ["dm"] as const,
  conversations: () => [...dmKeys.all(), "conversations"] as const,
} as const;
