"use client";

import { Button } from "@/components/ui/button";
import { ClientOnly } from "@/components/ClientOnly";
import { SectionBoundary } from "@/components/SectionBoundary";
import { useT } from "@/lib/i18n/locale";
import { FileTextIcon } from "lucide-react";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | Pages             [+ Add]   |
 * | Manage zone pages...        |
 * |-----------------------------|
 * |       [file-text icon]      |
 * |   No pages configured.      |
 * +-----------------------------+
 * w-full，空状态居中。
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | Pages                       [+ Add]  |
 * | Add, reorder, or remove pages...     |
 * |--------------------------------------|
 * |           [file-text icon]           |
 * |       No pages configured.           |
 * +--------------------------------------+
 * max-w-xl 居中。
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | [manage nav] | Pages           [+ Add]   |
 * |              | Add, reorder, or remove.. |
 * |              |----------------------------|
 * |              |     [file-text icon]      |
 * |              |   No pages configured.    |
 * +------------------------------------------+
 * 侧边导航 + 管理区 flex-1，max-w-xl。
 *
 * Ultra-wide (>=1536px): 与 Desktop 一致。
 *
 * Zone 页面管理：添加、排序、移除 zone 中的页面。
 * 当前为空状态占位，待 API 接入后加载页面列表与 CRUD 操作。
 */

function ManageZonePagesContent() {
  const [t] = useT();

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t.zone.managePages}</h1>
          <p className="text-muted-foreground text-sm">{t.zone.managePagesDescription}</p>
        </div>
        <Button className="shrink-0" size="sm" type="button">
          {t.zone.addPage}
        </Button>
      </div>

      <div className="space-y-2 py-12 text-center">
        <FileTextIcon className="text-muted-foreground mx-auto size-8" />
        <p className="text-muted-foreground text-sm">{t.zone.noPagesConfigured}</p>
      </div>
    </div>
  );
}

export default function ManageZonePagesPage() {
  return (
    <SectionBoundary>
      <ClientOnly>
        <ManageZonePagesContent />
      </ClientOnly>
    </SectionBoundary>
  );
}
