import { useConversations } from "@rezics/api/dm/dm";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { Link, useParams } from "@tanstack/react-router";
import type React from "react";
import { ConversationThreadSection } from "../sections/ConversationThreadSection";

export const DmConversationPage: React.FC = () => {
  const { conversationId } = useParams({
    from: "/_mainLayout/inbox/dm/$conversationId",
  });
  const { data } = useConversations();
  const conversation = data?.conversations.find((c) => c.id === conversationId);
  const peerLabel =
    conversation?.peerName ??
    conversation?.peerSlug ??
    conversation?.peerId ??
    "Conversation";

  return (
    <div className="mx-auto mt-16 flex h-[calc(100vh-8rem)] w-11/12 max-w-3xl flex-col">
      <div className="mb-4 flex items-center justify-between">
        <AccentBarWithText text={peerLabel} />
        <Link
          to="/inbox/dm"
          className="text-sm text-text-secondary hover:text-text-primary"
        >
          ← All conversations
        </Link>
      </div>
      {conversation ? (
        <ConversationThreadSection
          conversationId={conversationId}
          peerId={conversation.peerId}
        />
      ) : (
        <p className="text-sm text-text-secondary">Loading conversation…</p>
      )}
    </div>
  );
};
