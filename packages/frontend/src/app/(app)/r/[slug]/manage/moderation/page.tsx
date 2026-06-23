"use client";

import { ClientOnly } from "@/components/ClientOnly";
import { SectionBoundary } from "@/components/SectionBoundary";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useT } from "@/lib/i18n/locale";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | Moderation Queue            |
 * |-----------------------------|
 * | Reason | Status              |
 * |--------|------               |
 * |       (empty placeholder)   |
 * +-----------------------------+
 * w-full，表格水平滚动。
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | Moderation Queue                     |
 * | Reason   | Reported by | Status      |
 * |----------|-------------|------------|
 * +--------------------------------------+
 * Reported by 列在 sm 断点显示。
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | [manage nav] | Moderation Queue          |
 * |              | Reason | Reported by | Status | Action |
 * |              |--------|-------------|--------|--------|
 * +------------------------------------------+
 * 侧边导航 + 完整四列表格。Action 列在 lg 断点显示。
 *
 * Ultra-wide (>=1536px): 与 Desktop 一致。
 *
 * Realm 审核队列：显示被举报内容列表，包含原因、举报人、状态和操作。
 * 当前为占位实现，待 API 接入后填充。
 */

function ManageModerationContent() {
  const [t] = useT();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t.manage.moderationQueue}</h1>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.manage.reason}</TableHead>
            <TableHead className="hidden sm:table-cell">{t.manage.reportedBy}</TableHead>
            <TableHead>{t.admin.status}</TableHead>
            <TableHead className="hidden lg:table-cell">{t.manage.action}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Placeholder empty state — rows populated once API connected */}
          {/* 占位空状态 — API 接入后填充行数据 */}
          <TableRow>
            <TableCell colSpan={4}>
              <p className="text-muted-foreground py-8 text-center text-sm">
                {t.manage.moderationEmpty}
              </p>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

export default function ManageRealmModerationPage() {
  return (
    <SectionBoundary>
      <ClientOnly>
        <ManageModerationContent />
      </ClientOnly>
    </SectionBoundary>
  );
}
