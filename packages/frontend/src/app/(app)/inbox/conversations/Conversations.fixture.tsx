"use client";
import type { ReactNode } from "react";
import { ConversationsContent, type ConversationThread } from "./page";

const longPreview =
  "我把 realm 分类、跨语言索引、协作知识页和帖子讨论流都串起来看了一遍，这条私信故意写得很长，用来压测移动端截断、时间列固定宽度和未读背景。";

const conversations: readonly ConversationThread[] = [
  {
    id: "conv-unread",
    participantName: "Alice Chen",
    participantInitial: "A",
    lastMessage: "好的，我周末把那个 PR review 一下",
    time: "2h",
    unread: true,
  },
  {
    id: "conv-long",
    participantName: "一个名字非常非常长的用户用于压测收件箱截断行为",
    participantInitial: "长",
    lastMessage: longPreview,
    time: "Yesterday",
    unread: false,
  },
  {
    id: "conv-read",
    participantName: "Dave Zhang",
    participantInitial: "D",
    lastMessage: "Effect 的文档真的越来越好了，特别是新加的 cookbook。",
    time: "Jun 18",
    unread: false,
  },
];

function Frame({ children }: { readonly children: ReactNode }) {
  return <div className="mx-auto w-full max-w-3xl p-4">{children}</div>;
}

export default {
  Empty: (
    <Frame>
      <ConversationsContent />
    </Frame>
  ),
  MixedThreads: (
    <Frame>
      <ConversationsContent initialConversations={conversations} />
    </Frame>
  ),
  MobilePressure: (
    <div className="w-80 p-3">
      <ConversationsContent initialConversations={conversations} />
    </div>
  ),
  WidePressure: (
    <div className="mx-auto w-full max-w-6xl p-6">
      <ConversationsContent initialConversations={conversations} />
    </div>
  ),
};
