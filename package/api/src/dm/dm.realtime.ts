import { create } from "zustand";

/**
 * Ephemeral DM realtime state that does not belong in the query cache — the
 * peer's typing indicator. Written by `useDmStream` on incoming `dm.typing`
 * events and read by the open conversation thread. Not persisted.
 */
interface DmTypingState {
  /** Per-conversation: is the peer currently typing. */
  typingByConversation: Record<string, boolean>;
  setPeerTyping: (conversationId: string, isTyping: boolean) => void;
}

export const useDmTypingStore = create<DmTypingState>()((set) => ({
  typingByConversation: {},
  setPeerTyping: (conversationId, isTyping) =>
    set((state) => ({
      typingByConversation: {
        ...state.typingByConversation,
        [conversationId]: isTyping,
      },
    })),
}));

/** Select whether the peer is typing in a given conversation. */
export const selectIsPeerTyping =
  (conversationId: string) => (state: DmTypingState) =>
    state.typingByConversation[conversationId] ?? false;
