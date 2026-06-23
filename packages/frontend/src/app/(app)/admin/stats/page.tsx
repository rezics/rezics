"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ClientOnly } from "@/components/ClientOnly";
import { SectionBoundary } from "@/components/SectionBoundary";
import { useT } from "@/lib/i18n/locale";
import {
  UsersIcon,
  CalendarIcon,
  TrendingUpIcon,
  ActivityIcon,
} from "lucide-react";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | Statistics                  |
 * | Platform-wide metrics...    |
 * |-----------------------------|
 * | [DAU card    ]              |
 * | [WAU card    ]              |
 * | [MAU card    ]              |
 * | [Content card]              |
 * +-----------------------------+
 * w-full，卡片单列堆叠。
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | Statistics                           |
 * | Platform-wide metrics and trends.    |
 * | [DAU card   ] [WAU card   ]          |
 * | [MAU card   ] [Content    ]          |
 * +--------------------------------------+
 * 卡片两列网格。
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | [sidebar] | Statistics                   |
 * |           | Platform-wide metrics...     |
 * |           | [DAU] [WAU] [MAU] [Content]  |
 * |           |  (4col grid)                 |
 * +------------------------------------------+
 * 侧边栏 + 四列统计卡片网格。
 *
 * Ultra-wide (>=1536px): 与 Desktop 一致。
 *
 * 平台统计页面：DAU/WAU/MAU + 内容增长概览。
 * 当前为占位实现，指标由 placeholder 值填充，待 API 接入后替换。
 */

function AdminStatsContent() {
  const [t] = useT();

  const metrics = [
    { label: t.admin.dailyActiveUsers, value: "--", icon: ActivityIcon },
    { label: t.admin.weeklyActiveUsers, value: "--", icon: CalendarIcon },
    { label: t.admin.monthlyActiveUsers, value: "--", icon: UsersIcon },
    { label: t.admin.contentGrowth, value: "--", icon: TrendingUpIcon },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.admin.stats}</h1>
        <p className="text-muted-foreground text-sm">{t.admin.statsDescription}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <m.icon className="text-muted-foreground size-4 shrink-0" />
                <span className="text-muted-foreground text-sm font-medium">{m.label}</span>
              </div>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">{m.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-muted-foreground py-8 text-center text-sm">{t.admin.noData}</p>
    </div>
  );
}

export default function AdminStatsPage() {
  return (
    <SectionBoundary>
      <ClientOnly>
        <AdminStatsContent />
      </ClientOnly>
    </SectionBoundary>
  );
}
