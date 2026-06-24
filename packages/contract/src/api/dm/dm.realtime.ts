import { create } from "zustand";

/**
 * Ephemeral DM realtime state that does not belong in the query cache — the
 * peer's typing indicator. Written by `useDmStream` on incoming `dm.typing`
 * events and read by the open conversation thread. Not persisted.
 * 不属于查询缓存的临时 DM 实时状态——对端的输入指示。由 `useDmStream` 在收到
 * `dm.typing` 事件时写入，由打开的会话线程读取。不持久化。
 */
interface DmTypingState {
  /** Per-conversation: is the peer currently typing. 按会话记录：对端当前是否正在输入。 */
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

/** Select whether the peer is typing in a given conversation. 选择指定会话中对端是否正在输入。 */
export const selectIsPeerTyping =
  (conversationId: string) => (state: DmTypingState) =>
    state.typingByConversation[conversationId] ?? false;
