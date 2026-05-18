import {
  useMessages,
  useSendDmMutation,
  type DmMessage,
} from "@rezics/api/dm/dm";
import { Button, Input } from "@rezics/ui/shadcn";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FC, type FormEvent } from "react";
import { useAuthSessionStore } from "@/user/states";

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
      queryKey: ["dm", "messages", conversationId],
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading && (
          <p className="text-sm text-text-secondary">Loading messages…</p>
        )}
        {isError && (
          <p className="text-sm text-destructive">Could not load messages.</p>
        )}
        {!isLoading && !isError && messages.length === 0 && (
          <p className="text-sm text-text-secondary">
            No messages yet — say hi.
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
          placeholder="Write a message"
          aria-label="Message"
          disabled={sendMutation.isPending}
        />
        <Button
          type="submit"
          size="sm"
          disabled={sendMutation.isPending || draft.trim().length === 0}
        >
          Send
        </Button>
      </form>
    </div>
  );
};

export default ConversationThreadSection;
