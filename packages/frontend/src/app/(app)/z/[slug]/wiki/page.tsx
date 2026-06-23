"use client";

import { ClientOnly } from "@/components/ClientOnly";
import { SectionBoundary } from "@/components/SectionBoundary";
import { useT } from "@/lib/i18n/locale";
import { BookOpenIcon } from "lucide-react";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * |      [book-open icon]       |
 * |    No wiki articles yet.    |
 * |  Create the first wiki...   |
 * +-----------------------------+
 * w-full，空状态居中显示。
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * |           [book-open icon]           |
 * |        No wiki articles yet.         |
 * |    Create the first wiki article...  |
 * +--------------------------------------+
 * w-full 居中。
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | [zone layout] |                          |
 * |               |     [book-open icon]     |
 * |               |  No wiki articles yet.   |
 * |               | Create the first wiki... |
 * +------------------------------------------+
 * 继承 zone 布局，内容区 flex-1。
 *
 * Ultra-wide (>=1536px): 与 Desktop 一致。
 *
 * Zone 百科页面：显示 zone 的 wiki 文章。
 * 当前为空状态占位，待 API 接入后加载百科内容。
 */

function ZoneWikiContent() {
  const [t] = useT();

  return (
    <div className="space-y-2 py-12 text-center">
      <BookOpenIcon className="text-muted-foreground mx-auto size-8" />
      <p className="text-muted-foreground text-sm">{t.zone.wikiEmpty}</p>
      <p className="text-muted-foreground text-xs">{t.zone.wikiEmptyHint}</p>
    </div>
  );
}

export default function ZoneWikiPage() {
  return (
    <SectionBoundary>
      <ClientOnly>
        <ZoneWikiContent />
      </ClientOnly>
    </SectionBoundary>
  );
}
