import { useConversations } from "@rezics/api/dm/dm";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { Link, useParams } from "@tanstack/react-router";
import type React from "react";
import { ConversationThreadSection } from "../sections/ConversationThreadSection";
import { useMessage } from "@rezics/i18n/react";
import {
  inbox_all_conversations,
  inbox_conversation_loading,
  inbox_conversation_title,
} from "@rezics/i18n/messages";
const m = {
  inbox_all_conversations,
  inbox_conversation_loading,
  inbox_conversation_title,
};

const i18nMessages = {
  inbox_all_conversations,
  inbox_conversation_loading,
  inbox_conversation_title,
};

export const DmConversationPage: React.FC = () => {
  const m = useMessage(i18nMessages);
  const { conversationId } = useParams({
    from: "/_mainLayout/inbox/dm/$conversationId",
  });
  const { data } = useConversations();
  const conversation = data?.conversations.find((c) => c.id === conversationId);
  const peerLabel =
    conversation?.peerName ??
    conversation?.peerSlug ??
    conversation?.peerId ??
    m.inbox_conversation_title();

  return (
    <div className="mx-auto mt-16 flex h-[calc(100vh-8rem)] w-11/12 max-w-3xl flex-col">
      <div className="mb-4 flex items-center justify-between">
        <AccentBarWithText text={peerLabel} />
        <Link
          to="/inbox/dm"
          className="text-sm text-text-secondary hover:text-text-primary"
        >
          {m.inbox_all_conversations()}
        </Link>
      </div>
      {conversation ? (
        <ConversationThreadSection
          conversationId={conversationId}
          peerId={conversation.peerId}
        />
      ) : (
        <p className="text-sm text-text-secondary">
          {m.inbox_conversation_loading()}
        </p>
      )}
    </div>
  );
};
