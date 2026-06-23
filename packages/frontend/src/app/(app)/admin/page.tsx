"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ClientOnly } from "@/components/ClientOnly";
import { SectionBoundary } from "@/components/SectionBoundary";
import { useT } from "@/lib/i18n/locale";
import {
  UsersIcon,
  GlobeIcon,
  BookOpenIcon,
  MessageSquareIcon,
  TagIcon,
  ShieldAlertIcon,
} from "lucide-react";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | Admin / Overview            |
 * |-----------------------------|
 * | [Total Users  ] [Realms   ] |
 * |  (card grid, 1col)          |
 * | [Total Books  ]             |
 * | [Total Posts  ]             |
 * | [Total Tags  ]             |
 * | [Open Cases  ]             |
 * |-----------------------------|
 * | Recent Activity             |
 * | (placeholder)               |
 * +-----------------------------+
 * w-full，卡片单列堆叠。
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | Admin / Overview                     |
 * | [Users] [Realms] [Books]             |
 * | [Posts] [Tags ] [Cases]              |
 * |  (2col grid)                         |
 * |--------------------------------------|
 * | Recent Activity                      |
 * +--------------------------------------+
 * 卡片两列网格。
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | [sidebar] | Admin / Overview             |
 * |           | [Users][Realms][Books]        |
 * |           | [Posts][Tags ][Cases]         |
 * |           |  (3col grid)                 |
 * |           |-------------------------------|
 * |           | Recent Activity              |
 * +------------------------------------------+
 * 侧边栏 + 三列统计卡片网格。
 *
 * Ultra-wide (>=1536px): 与 Desktop 一致。
 *
 * 管理后台首页概览：显示平台核心统计指标卡片网格。
 * 当前为占位实现，指标由 placeholder 值填充，待 API 接入后替换。
 */

function AdminOverviewContent() {
  const [t] = useT();

  const stats = [
    { label: t.admin.totalUsers, value: "--", icon: UsersIcon },
    { label: t.admin.totalRealms, value: "--", icon: GlobeIcon },
    { label: t.admin.totalBooks, value: "--", icon: BookOpenIcon },
    { label: t.admin.totalPosts, value: "--", icon: MessageSquareIcon },
    { label: t.admin.totalTags, value: "--", icon: TagIcon },
    { label: t.admin.openCases, value: "--", icon: ShieldAlertIcon },
  ] as const;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t.admin.overview}</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <s.icon className="text-muted-foreground size-4 shrink-0" />
                <span className="text-muted-foreground text-sm font-medium">{s.label}</span>
              </div>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">{s.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">{t.admin.recentActivity}</h2>
        <p className="text-muted-foreground py-8 text-center text-sm">{t.admin.noData}</p>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <SectionBoundary>
      <ClientOnly>
        <AdminOverviewContent />
      </ClientOnly>
    </SectionBoundary>
  );
}
