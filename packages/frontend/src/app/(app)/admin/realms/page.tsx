"use client";

import { Input } from "@/components/ui/input";
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
import { SearchIcon } from "lucide-react";
import { useState } from "react";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | Realms                      |
 * | [search icon] [input     ]  |
 * |-----------------------------|
 * | Name  | Slug  | Members     |
 * |-------|-------|----------    |
 * |       (empty placeholder)   |
 * +-----------------------------+
 * w-full，表格水平滚动。
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | Realms                               |
 * | [search icon] [input              ]  |
 * | Name  | Slug    | Members | Posts    |
 * |-------|---------|---------|---------|
 * +--------------------------------------+
 * Posts 列在 sm 断点显示。
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | [sidebar] | Realms                       |
 * |           | [search icon] [input       ] |
 * |           | Name | Slug | Members | Posts | Created |
 * |           |------|------|---------|------|---------|
 * +------------------------------------------+
 * 侧边栏 + 完整五列表格。Created 列在 lg 断点显示。
 *
 * Ultra-wide (>=1536px): 与 Desktop 一致。
 *
 * 社区管理列表：搜索框 + 数据表格。
 * 当前为占位实现，待 API 接入后填充。
 */

function AdminRealmsContent() {
  const [t] = useT();
  const [query, setQuery] = useState("");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t.admin.realms}</h1>

      <div className="relative">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          className="pl-10"
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.admin.searchRealms}
          type="search"
          value={query}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.admin.name}</TableHead>
            <TableHead>{t.admin.slug}</TableHead>
            <TableHead>{t.admin.memberCount}</TableHead>
            <TableHead className="hidden sm:table-cell">{t.admin.postCount}</TableHead>
            <TableHead className="hidden lg:table-cell">{t.admin.created}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Placeholder empty state — rows populated once API connected */}
          {/* 占位空状态 — API 接入后填充行数据 */}
          <TableRow>
            <TableCell colSpan={5}>
              <p className="text-muted-foreground py-8 text-center text-sm">
                {t.admin.noData}
              </p>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

export default function AdminRealmsPage() {
  return (
    <SectionBoundary>
      <ClientOnly>
        <AdminRealmsContent />
      </ClientOnly>
    </SectionBoundary>
  );
}
