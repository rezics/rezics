"use client";

import { ClientOnly } from "@/components/ClientOnly";
import { SectionBoundary } from "@/components/SectionBoundary";
import { useT } from "@/lib/i18n/locale";
import { MessageSquareIcon } from "lucide-react";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * |     [message-square icon]   |
 * |      No posts yet.          |
 * |   Start the first disc...   |
 * +-----------------------------+
 * w-full，空状态居中显示。
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * |         [message-square icon]        |
 * |          No posts yet.               |
 * |    Start the first discussion...     |
 * +--------------------------------------+
 * w-full 居中。
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | [zone layout] |                          |
 * |               |   [message-square icon]  |
 * |               |    No posts yet.         |
 * |               | Start the first disc...  |
 * +------------------------------------------+
 * 继承 zone 布局，内容区 flex-1。
 *
 * Ultra-wide (>=1536px): 与 Desktop 一致。
 *
 * Zone 帖子列表：显示 zone 中的讨论帖子。
 * 当前为空状态占位，待 API 接入后加载帖子流。
 */

function ZonePostsContent() {
  const [t] = useT();

  return (
    <div className="space-y-2 py-12 text-center">
      <MessageSquareIcon className="text-muted-foreground mx-auto size-8" />
      <p className="text-muted-foreground text-sm">{t.zone.postsEmpty}</p>
      <p className="text-muted-foreground text-xs">{t.zone.postsEmptyHint}</p>
    </div>
  );
}

export default function ZonePostsPage() {
  return (
    <SectionBoundary>
      <ClientOnly>
        <ZonePostsContent />
      </ClientOnly>
    </SectionBoundary>
  );
}
