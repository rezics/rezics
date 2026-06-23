"use client";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ClientOnly } from "@/components/ClientOnly";
import { SectionBoundary } from "@/components/SectionBoundary";
import { useT } from "@/lib/i18n/locale";
import { useState } from "react";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | Dock Configuration          |
 * | Configure the sidebar...    |
 * |-----------------------------|
 * | Posts     [switch]           |
 * | Shelves   [switch]           |
 * | Tags      [switch]           |
 * | Wiki      [switch]           |
 * | Rules     [switch]           |
 * |              [Save Changes] |
 * +-----------------------------+
 * w-full，开关项单列堆叠。
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | Dock Configuration                   |
 * | Configure the sidebar sections...    |
 * | Posts     [switch]                    |
 * | Shelves   [switch]                    |
 * | Tags      [switch]                    |
 * | Wiki      [switch]                    |
 * | Rules     [switch]                    |
 * |                      [Save Changes]  |
 * +--------------------------------------+
 * max-w-xl 居中。
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | [manage nav] | Dock Configuration        |
 * |              | Configure the sidebar...  |
 * |              | Posts     [switch]         |
 * |              | Shelves   [switch]         |
 * |              | Tags      [switch]         |
 * |              | Wiki      [switch]         |
 * |              | Rules     [switch]         |
 * |              |         [Save Changes]    |
 * +------------------------------------------+
 * 侧边导航 + 配置区 flex-1，max-w-xl。
 *
 * Ultra-wide (>=1536px): 与 Desktop 一致。
 *
 * Realm 侧边栏配置：控制各板块在 realm 侧边栏的显示/隐藏。
 * 当前为占位实现，状态变更待 API 接入后持久化。
 */

const DOCK_SECTIONS = ["posts", "shelves", "tags", "wiki", "rules"] as const;
type DockSection = (typeof DOCK_SECTIONS)[number];

function ManageDockContent() {
  const [t] = useT();
  const dockLabels: Record<DockSection, string> = {
    posts: t.manage.dockPosts,
    shelves: t.manage.dockShelves,
    tags: t.manage.dockTags,
    wiki: t.manage.dockWiki,
    rules: t.manage.dockRules,
  };

  // Local toggle state — persisted to API once connected
  // 本地开关状态 — API 接入后持久化
  const [enabled, setEnabled] = useState<Record<DockSection, boolean>>({
    posts: true,
    shelves: true,
    tags: true,
    wiki: true,
    rules: true,
  });

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.manage.dockTitle}</h1>
        <p className="text-muted-foreground text-sm">{t.manage.dockDescription}</p>
      </div>

      <div className="divide-border divide-y">
        {DOCK_SECTIONS.map((section) => (
          <div className="flex items-center justify-between py-3" key={section}>
            <span className="text-sm font-medium">{dockLabels[section]}</span>
            <Switch
              checked={enabled[section]}
              className="shrink-0"
              onCheckedChange={(detail) => setEnabled((prev) => ({ ...prev, [section]: detail.checked }))}
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={() => {}} type="button">{t.manage.saveChanges}</Button>
      </div>
    </div>
  );
}

export default function ManageRealmDockPage() {
  return (
    <SectionBoundary>
      <ClientOnly>
        <ManageDockContent />
      </ClientOnly>
    </SectionBoundary>
  );
}
