"use client";

import { ClientOnly } from "@/components/ClientOnly";
import { SectionBoundary } from "@/components/SectionBoundary";
import { useT } from "@/lib/i18n/locale";
import { FileTextIcon } from "lucide-react";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * |       [file-text icon]      |
 * |      No pages yet.          |
 * |   Create a page to get...   |
 * +-----------------------------+
 * w-full，空状态居中显示。
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * |           [file-text icon]           |
 * |          No pages yet.               |
 * |     Create a page to get...          |
 * +--------------------------------------+
 * w-full 居中。
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | [zone layout] |                          |
 * |               |     [file-text icon]     |
 * |               |    No pages yet.         |
 * |               | Create a page to get...  |
 * +------------------------------------------+
 * 继承 zone 布局，内容区 flex-1。
 *
 * Ultra-wide (>=1536px): 与 Desktop 一致。
 *
 * Zone 页面列表：显示 zone 自定义页面。
 * 当前为空状态占位，待 API 接入后加载页面列表。
 */

function ZonePagesContent() {
  const [t] = useT();

  return (
    <div className="space-y-2 py-12 text-center">
      <FileTextIcon className="text-muted-foreground mx-auto size-8" />
      <p className="text-muted-foreground text-sm">{t.zone.pagesEmpty}</p>
      <p className="text-muted-foreground text-xs">{t.zone.pagesEmptyHint}</p>
    </div>
  );
}

export default function ZonePagesPage() {
  return (
    <SectionBoundary>
      <ClientOnly>
        <ZonePagesContent />
      </ClientOnly>
    </SectionBoundary>
  );
}
