import { type DmConversation, useConversations } from "@rezics/api/dm/dm";
import { useTranslation } from "@rezics/i18n/react";
import { Avatar, AvatarFallback, AvatarImage } from "@rezics/ui/shadcn";
import { Link } from "@tanstack/react-router";
import type { FC } from "react";

function compareUpdatedDesc(a: DmConversation, b: DmConversation): number {
  return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
}

function formatPeerInitial(c: DmConversation): string {
  if (c.peerName) return c.peerName.slice(0, 1).toUpperCase();
  return c.peerId.slice(0, 2).toUpperCase();
}

/**
 * Conversation list section — newest activity first, click routes to
 * the thread view. Loading / error / empty states follow the same copy
 * shape as `NotificationTabSection` for a consistent inbox feel.
 */
export const ConversationListSection: FC = () => {
  const { t } = useTranslation(["common", "community"]);
  const { data, isLoading, isError } = useConversations();
  const conversations = (data?.conversations ?? [])
    .slice()
    .sort(compareUpdatedDesc);

  return (
    <ul className="flex w-full flex-col gap-1">
      {isLoading && (
        <li className="px-2 py-4 text-sm text-text-secondary">
          {t("common:loading")}
        </li>
      )}
      {isError && (
        <li className="px-2 py-4 text-sm text-destructive">
          {t("community:inbox_conversations_load_failed")}
        </li>
      )}
      {!isLoading && !isError && conversations.length === 0 && (
        <li className="px-2 py-4 text-sm text-text-secondary">
          {t("community:inbox_conversations_empty")}
        </li>
      )}
      {conversations.map((c) => (
        <li key={c.id}>
          <Link
            to="/inbox/dm/$conversationId"
            params={{ conversationId: c.id }}
            className="flex items-center gap-3 rounded-md p-3 hover:bg-surface-elevated"
          >
            <Avatar className="h-9 w-9">
              {c.peerAvatar ? <AvatarImage src={c.peerAvatar} alt="" /> : null}
              <AvatarFallback>{formatPeerInitial(c)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-text-primary">
                {c.peerName ?? c.peerSlug ?? c.peerId}
              </span>
              {c.lastMessage ? (
                <span className="truncate text-xs text-text-secondary">
                  {c.lastMessage}
                </span>
              ) : null}
            </div>
            {c.unreadCount && c.unreadCount > 0 ? (
              <span className="ml-auto rounded-full bg-brand-fill px-2 py-0.5 text-[10px] text-text-on-brand">
                {c.unreadCount}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
};

export default ConversationListSection;
