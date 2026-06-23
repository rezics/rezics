"use client";

import { useT } from "@/lib/i18n/locale";
import { MessageSquareIcon } from "lucide-react";
import { useState } from "react";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | [av] Alice           2h ago |
 * |      Hey, did you see...    |
 * |-----------------------------|
 * | [av] Bob             1d ago |
 * |      Thanks for sharing...  |
 * |-----------------------------|
 * |       (empty state)         |
 * +-----------------------------+
 * w-full. Avatar (shrink-0) + name/preview (min-w-0 truncate) + time (shrink-0).
 * Narrow: preview truncates, time stays visible.
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | [av] Alice                    2h ago |
 * |      Hey, did you see the new...     |
 * |--------------------------------------|
 * | [av] Bob                      1d ago |
 * |      Thanks for sharing that link... |
 * +--------------------------------------+
 * max-w-3xl mx-auto (inherited). More preview text visible.
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | [av] Alice                        2h ago |
 * |      Hey, did you see the new book...    |
 * |------------------------------------------|
 * | [av] Bob                          1d ago |
 * |      Thanks for sharing that link...     |
 * +------------------------------------------+
 * Same structure, wider content area.
 *
 * Ultra-wide (>=1536px):
 * Same as Desktop.
 *
 * 对话列表页。每个对话显示头像 + 用户名 + 最后消息预览 + 时间。
 * 空状态时显示占位提示。
 */

interface ConversationThread {
  readonly id: string;
  readonly participantName: string;
  readonly participantInitial: string;
  readonly lastMessage: string;
  readonly time: string;
  readonly unread: boolean;
}

// Placeholder data until API is connected
// API 连接前的占位数据
const PLACEHOLDER_CONVERSATIONS: readonly ConversationThread[] = [];

export default function ConversationsPage() {
  const [t] = useT();
  const [conversations] = useState<readonly ConversationThread[]>(
    PLACEHOLDER_CONVERSATIONS,
  );

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <MessageSquareIcon className="text-muted-foreground size-8" />
        <p className="text-muted-foreground text-sm">
          {t.inbox.conversationEmpty}
        </p>
        <p className="text-muted-foreground/60 text-xs">
          {t.inbox.conversationPlaceholder}
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-border w-full divide-y" role="list">
      {conversations.map((thread) => (
        <li
          className={`flex gap-3 px-2 py-3 ${thread.unread ? "bg-accent/40" : ""}`}
          key={thread.id}
        >
          {/* Avatar placeholder — fixed size */}
          {/* 头像占位 — 固定尺寸 */}
          <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-medium">
            {thread.participantInitial}
          </span>

          {/* Name + preview — truncates when narrow */}
          {/* 名称 + 预览 — 窄屏时截断 */}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className={`truncate text-sm ${thread.unread ? "font-semibold" : "font-medium"}`}>
              {thread.participantName}
            </span>
            <span className="text-muted-foreground min-w-0 truncate text-xs">
              {thread.lastMessage}
            </span>
          </div>

          {/* Timestamp — fixed */}
          {/* 时间戳 — 固定 */}
          <span className="text-muted-foreground shrink-0 self-start text-xs">
            {thread.time}
          </span>
        </li>
      ))}
    </ul>
  );
}
