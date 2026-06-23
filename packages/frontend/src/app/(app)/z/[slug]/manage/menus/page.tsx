"use client";

import { Button } from "@/components/ui/button";
import { ClientOnly } from "@/components/ClientOnly";
import { SectionBoundary } from "@/components/SectionBoundary";
import { useT } from "@/lib/i18n/locale";
import { MenuIcon } from "lucide-react";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | Menus          [+ Add Item] |
 * | Configure navigation...     |
 * |-----------------------------|
 * |         [menu icon]         |
 * |   No menus configured.      |
 * +-----------------------------+
 * w-full，空状态居中。
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | Menus                    [+ Add Item]|
 * | Configure navigation menus...        |
 * |--------------------------------------|
 * |            [menu icon]               |
 * |       No menus configured.           |
 * +--------------------------------------+
 * max-w-xl 居中。
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | [manage nav] | Menus        [+ Add Item] |
 * |              | Configure navigation...   |
 * |              |----------------------------|
 * |              |       [menu icon]         |
 * |              |   No menus configured.    |
 * +------------------------------------------+
 * 侧边导航 + 管理区 flex-1，max-w-xl。
 *
 * Ultra-wide (>=1536px): 与 Desktop 一致。
 *
 * Zone 菜单配置：添加、编辑、排序导航菜单项。
 * 当前为空状态占位，待 API 接入后加载菜单配置与 CRUD 操作。
 */

function ManageZoneMenusContent() {
  const [t] = useT();

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t.zone.manageMenus}</h1>
          <p className="text-muted-foreground text-sm">{t.zone.manageMenusDescription}</p>
        </div>
        <Button className="shrink-0" size="sm" type="button">
          {t.zone.addMenuItem}
        </Button>
      </div>

      <div className="space-y-2 py-12 text-center">
        <MenuIcon className="text-muted-foreground mx-auto size-8" />
        <p className="text-muted-foreground text-sm">{t.zone.noMenusConfigured}</p>
      </div>
    </div>
  );
}

export default function ManageZoneMenusPage() {
  return (
    <SectionBoundary>
      <ClientOnly>
        <ManageZoneMenusContent />
      </ClientOnly>
    </SectionBoundary>
  );
}
