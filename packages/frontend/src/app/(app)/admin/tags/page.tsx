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

export interface AdminTagRow {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly usage: string;
  readonly created: string;
}

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | Tags                        |
 * | [search icon] [input     ]  |
 * |-----------------------------|
 * | Name   | Category           |
 * |--------|----------          |
 * |       (empty placeholder)   |
 * +-----------------------------+
 * w-full，表格水平滚动。
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | Tags                                 |
 * | [search icon] [input              ]  |
 * | Name   | Category | Usage            |
 * |--------|----------|------            |
 * +--------------------------------------+
 * Usage 列在 sm 断点显示。
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | [sidebar] | Tags                         |
 * |           | [search icon] [input       ] |
 * |           | Name | Category | Usage | Created |
 * |           |------|----------|-------|---------|
 * +------------------------------------------+
 * 侧边栏 + 完整四列表格。Created 列在 lg 断点显示。
 *
 * Ultra-wide (>=1536px): 与 Desktop 一致。
 *
 * 标签管理列表：搜索框 + 数据表格。
 * 当前为占位实现，待 API 接入后填充。
 */

export function AdminTagsContent({
  rows = [],
  disabled = false,
  initialQuery = "",
}: {
  readonly rows?: readonly AdminTagRow[];
  readonly disabled?: boolean;
  readonly initialQuery?: string;
}) {
  const [t] = useT();
  const [query, setQuery] = useState(initialQuery);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t.admin.tags}</h1>

      <div className="relative">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          className="pl-10"
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.admin.searchTags}
          type="search"
          value={query}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.admin.name}</TableHead>
            <TableHead>{t.admin.category}</TableHead>
            <TableHead className="hidden sm:table-cell">{t.admin.usageCount}</TableHead>
            <TableHead className="hidden lg:table-cell">{t.admin.created}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4}>
                <p className="text-muted-foreground py-8 text-center text-sm">
                  {t.admin.noData}
                </p>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="max-w-56 truncate">{row.name}</TableCell>
                <TableCell className="max-w-48 truncate">{row.category}</TableCell>
                <TableCell className="hidden sm:table-cell">{row.usage}</TableCell>
                <TableCell className="hidden lg:table-cell">{row.created}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default function AdminTagsPage() {
  return (
    <SectionBoundary>
      <ClientOnly>
        <AdminTagsContent />
      </ClientOnly>
    </SectionBoundary>
  );
}
