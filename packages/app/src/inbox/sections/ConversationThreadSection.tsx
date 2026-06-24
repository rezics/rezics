import {
  type DmMessage,
  dmApi,
  dmKeys,
  selectIsPeerTyping,
  useDmBlockState,
  useDmTypingStore,
  useMarkDmReadMutation,
  useMessages,
  useSendDmMutation,
  useSetDmBlockMutation,
} from "@rezics/contract/api/dm/dm";
import { useTranslation } from "@rezics/i18n/react";
import { Button, Input } from "@rezics/ui/shadcn";
import { useQueryClient } from "@tanstack/react-query";
import { type FC, type FormEvent, useEffect, useRef, useState } from "react";
import { useRetryToast } from "@/shared/hooks/useRetryToast";
import { useAuthSessionStore } from "@/user";

interface ConversationThreadSectionProps {
  conversationId: string;
  peerId: string;
}

/**
 * Conversation thread — paginated message list (newest at bottom), send box
 * anchored to the bottom. Surfaces read receipts on the viewer's latest
 * message, the peer's live typing indicator, and block/unblock controls in the
 * thread header. Sending is disabled when either party has blocked the other.
 * 会话线程 —— 分页的消息列表（最新消息在底部），发送框固定在底部。
 * 在查看者最新消息上显示已读回执，展示对方的实时输入指示器，以及线程头部的
 * 拉黑/取消拉黑控件。当任一方拉黑了另一方时，发送将被禁用。
 */
export const ConversationThreadSection: FC<ConversationThreadSectionProps> = ({
  conversationId,
  peerId,
}) => {
  const { t } = useTranslation(["community"]);
  const { data, isLoading, isError } = useMessages(conversationId);
  const sendMutation = useSendDmMutation();
  const markReadMutation = useMarkDmReadMutation();
  const { data: blockState } = useDmBlockState(peerId);
  const setBlockMutation = useSetDmBlockMutation();
  const isPeerTyping = useDmTypingStore(selectIsPeerTyping(conversationId));
  const queryClient = useQueryClient();
  const showRetryToast = useRetryToast();
  const myUnitId = useAuthSessionStore((s) => s.rezics.userId) ?? undefined;
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const typingResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messages = data?.messages ?? [];
  const messageCount = messages.length;

  const peerBlocked = blockState?.peerBlocked ?? false;
  const blockedByPeer = blockState?.blockedByPeer ?? false;
  const blocked = peerBlocked || blockedByPeer;

  // The peer's most-recent message (drives mark-read) and whether the peer has
  // read the viewer's latest message (drives the read receipt).
  // 对方最新的消息（驱动标记已读），以及对方是否已读查看者的最新消息
  //（驱动已读回执）。
  const newest = newestMessage(messages);
  const newestId = newest?.id;
  const newestMine = !!newest && isMine(newest, myUnitId);
  const myNewest = newestMessage(messages.filter((m) => isMine(m, myUnitId)));
  const peerHasRead = !!myNewest?.readAt;

  useEffect(() => {
    if (messageCount === 0) return;
    // Honor the user's reduced-motion preference for the auto-scroll.
    // 自动滚动时遵循用户的 reduced-motion 偏好。
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    bottomRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "end",
    });
  }, [messageCount]);

  // Mark the peer's messages read whenever the newest message is theirs.
  // 每当最新消息来自对方时，将对方的消息标记为已读。
  const markRead = markReadMutation.mutate;
  useEffect(() => {
    if (!newestId || newestMine) return;
    markRead({ conversationId, upToMessageId: newestId });
  }, [conversationId, newestId, newestMine, markRead]);

  const emitTyping = (isTyping: boolean) => {
    void dmApi.setTyping(conversationId, isTyping).catch(() => {});
  };

  useEffect(() => {
    return () => {
      if (typingResetRef.current) clearTimeout(typingResetRef.current);
      // Notify peer that typing stopped on unmount
      // 卸载时通知对方用户已停止输入
      void dmApi.setTyping(conversationId, false).catch(() => {});
    };
  }, [conversationId]);

  const handleDraftChange = (value: string) => {
    setDraft(value);
    emitTyping(true);
    if (typingResetRef.current) clearTimeout(typingResetRef.current);
    typingResetRef.current = setTimeout(() => emitTyping(false), 3000);
  };

  const sendContent = async (content: string) => {
    try {
      await sendMutation.mutateAsync({ recipientId: peerId, content });
    } catch {
      // Keep the failed text in the composer and offer a retry that re-sends
      // the same payload without forcing the user to re-type it.
      // 将发送失败的文本保留在输入框中，并提供重试，重新发送相同的内容，
      // 无需用户重新输入。
      setDraft((current) => (current.trim() ? current : content));
      showRetryToast(
        `dm:${conversationId}:send`,
        t("community:progress_status_toast_generic_retry"),
        () => sendContent(content),
      );
      return;
    }
    queryClient.invalidateQueries({
      queryKey: dmKeys.messages(conversationId),
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sendMutation.isPending || blocked) return;
    setDraft("");
    emitTyping(false);
    await sendContent(content);
  };

  const toggleBlock = () => {
    if (setBlockMutation.isPending) return;
    setBlockMutation.mutate({ peerId, blocked: !peerBlocked });
  };

  const statusLabel = peerBlocked
    ? t("community:dm_you_blocked_peer")
    : blockedByPeer
      ? t("community:dm_blocked_by_peer")
      : isPeerTyping
        ? t("community:dm_typing")
        : "";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border-whisper px-4 py-2">
        <span
          className="text-xs leading-ui text-text-tertiary"
          aria-live="polite"
        >
          {statusLabel}
        </span>
        {!blockedByPeer ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={toggleBlock}
            disabled={setBlockMutation.isPending}
          >
            {peerBlocked ? t("community:dm_unblock") : t("community:dm_block")}
          </Button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading && (
          <p className="text-sm text-text-secondary">
            {t("community:inbox_messages_loading")}
          </p>
        )}
        {isError && (
          <p className="text-sm text-destructive">
            {t("community:inbox_messages_load_failed")}
          </p>
        )}
        {!isLoading && !isError && messages.length === 0 && (
          <p className="text-sm text-text-secondary">
            {t("community:inbox_messages_empty")}
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
                  className={`max-w-[75%] break-words rounded-2xl px-3 py-2 text-sm ${
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
        {peerHasRead ? (
          <p className="mt-1 pr-1 text-right text-xs leading-ui text-text-tertiary">
            {t("community:dm_read_receipt")}
          </p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-border-whisper px-4 py-3"
      >
        <Input
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
          onBlur={() => emitTyping(false)}
          placeholder={
            blocked
              ? t("community:dm_blocked_composer_placeholder")
              : t("community:inbox_message_placeholder")
          }
          aria-label={t("community:inbox_message_label")}
          disabled={sendMutation.isPending || blocked}
        />
        <Button
          type="submit"
          size="sm"
          disabled={
            sendMutation.isPending || blocked || draft.trim().length === 0
          }
        >
          {t("community:inbox_send")}
        </Button>
      </form>
    </div>
  );
};

function isMine(message: DmMessage, myId: string | undefined): boolean {
  return !!myId && message.senderId === myId;
}

/** The most recent message by `createdAt`, order-independent. 按 `createdAt` 取最新的消息，与顺序无关。 */
function newestMessage(messages: DmMessage[]): DmMessage | undefined {
  return messages.reduce<DmMessage | undefined>((latest, m) => {
    if (!latest || m.createdAt > latest.createdAt) return m;
    return latest;
  }, undefined);
}
