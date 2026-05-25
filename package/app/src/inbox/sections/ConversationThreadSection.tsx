import {
  type DmMessage,
  dmKeys,
  useMessages,
  useSendDmMutation,
} from "@rezics/api/dm/dm";
import {
  inbox_message_label,
  inbox_message_placeholder,
  inbox_messages_empty,
  inbox_messages_load_failed,
  inbox_messages_loading,
  inbox_send,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { Button, Input } from "@rezics/ui/shadcn";
import { useQueryClient } from "@tanstack/react-query";
import { type FC, type FormEvent, useEffect, useRef, useState } from "react";
import { useAuthSessionStore } from "@/user/states";

const i18nMessages = {
  inbox_message_label,
  inbox_message_placeholder,
  inbox_messages_empty,
  inbox_messages_load_failed,
  inbox_messages_loading,
  inbox_send,
};

interface ConversationThreadSectionProps {
  conversationId: string;
  peerId: string;
}

function isMine(message: DmMessage, myId: string | undefined): boolean {
  return !!myId && message.senderId === myId;
}

/**
 * Conversation thread — paginated message list (newest at bottom),
 * send box anchored to the bottom, optimistic append on send. Live
 * incoming messages flow in via `useDmStream` (mounted at the app
 * shell), which invalidates this query and triggers a refetch.
 */
export const ConversationThreadSection: FC<ConversationThreadSectionProps> = ({
  conversationId,
  peerId,
}) => {
  const m = useMessage(i18nMessages);
  const { data, isLoading, isError } = useMessages(conversationId);
  const sendMutation = useSendDmMutation();
  const queryClient = useQueryClient();
  const myUnitId = useAuthSessionStore((s) => s.rezics.userId) ?? undefined;
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const messages = data?.messages ?? [];
  const messageCount = messages.length;

  useEffect(() => {
    if (messageCount === 0) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messageCount]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sendMutation.isPending) return;
    setDraft("");
    try {
      await sendMutation.mutateAsync({ recipientId: peerId, content });
    } catch {
      setDraft(content);
      return;
    }
    // Invalidating triggers a refetch; the WS stream handles peer-side
    // updates. Optimistic append is best-effort (the canonical message
    // shape — id, createdAt — comes from the server).
    queryClient.invalidateQueries({
      queryKey: dmKeys.messages(conversationId),
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading && (
          <p className="text-sm text-text-secondary">
            {m.inbox_messages_loading()}
          </p>
        )}
        {isError && (
          <p className="text-sm text-destructive">
            {m.inbox_messages_load_failed()}
          </p>
        )}
        {!isLoading && !isError && messages.length === 0 && (
          <p className="text-sm text-text-secondary">
            {m.inbox_messages_empty()}
          </p>
        )}
        <ol className="flex flex-col gap-2">
          {messages.map((m) => {
            const mine = isMine(m, myUnitId);
            return (
              <li
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    mine
                      ? "bg-brand-fill text-text-on-brand"
                      : "bg-surface-elevated text-text-primary"
                  }`}
                >
                  {m.content}
                </div>
              </li>
            );
          })}
        </ol>
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-border-whisper px-4 py-3"
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={m.inbox_message_placeholder()}
          aria-label={m.inbox_message_label()}
          disabled={sendMutation.isPending}
        />
        <Button
          type="submit"
          size="sm"
          disabled={sendMutation.isPending || draft.trim().length === 0}
        >
          {m.inbox_send()}
        </Button>
      </form>
    </div>
  );
};

export default ConversationThreadSection;
