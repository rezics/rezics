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

export interface AdminGovernanceRow {
  readonly id: string;
  readonly type: string;
  readonly reporter: string;
  readonly target: string;
  readonly severity: string;
  readonly status: string;
}

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | Governance                  |
 * | [search icon] [input     ]  |
 * |-----------------------------|
 * | Type  | Severity             |
 * |-------|----------            |
 * |       (empty placeholder)   |
 * +-----------------------------+
 * w-full，表格水平滚动。
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | Governance                           |
 * | [search icon] [input              ]  |
 * | Type  | Reporter | Severity | Status |
 * |-------|----------|----------|--------|
 * +--------------------------------------+
 * Reporter 列在 sm 断点显示。
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | [sidebar] | Governance                   |
 * |           | [search icon] [input       ] |
 * |           | Type | Reporter | Target | Severity | Status |
 * |           |------|----------|--------|----------|--------|
 * +------------------------------------------+
 * 侧边栏 + 完整五列表格。Target 列在 lg 断点显示。
 *
 * Ultra-wide (>=1536px): 与 Desktop 一致。
 *
 * 治理/审核案例列表：搜索框 + 数据表格。
 * 当前为占位实现，待 API 接入后填充。
 */

export function AdminGovernanceContent({
  rows = [],
  disabled = false,
  initialQuery = "",
}: {
  readonly rows?: readonly AdminGovernanceRow[];
  readonly disabled?: boolean;
  readonly initialQuery?: string;
}) {
  const [t] = useT();
  const [query, setQuery] = useState(initialQuery);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t.admin.governance}</h1>

      <div className="relative">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          className="pl-10"
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.admin.searchCases}
          type="search"
          value={query}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.admin.type}</TableHead>
            <TableHead className="hidden sm:table-cell">{t.admin.reporter}</TableHead>
            <TableHead className="hidden lg:table-cell">{t.admin.target}</TableHead>
            <TableHead>{t.admin.severity}</TableHead>
            <TableHead>{t.admin.status}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5}>
                <p className="text-muted-foreground py-8 text-center text-sm">
                  {t.admin.noData}
                </p>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="max-w-44 truncate">{row.type}</TableCell>
                <TableCell className="hidden max-w-44 truncate sm:table-cell">
                  {row.reporter}
                </TableCell>
                <TableCell className="hidden max-w-64 truncate lg:table-cell">
                  {row.target}
                </TableCell>
                <TableCell>{row.severity}</TableCell>
                <TableCell>{row.status}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default function AdminGovernancePage() {
  return (
    <SectionBoundary>
      <ClientOnly>
        <AdminGovernanceContent />
      </ClientOnly>
    </SectionBoundary>
  );
}
