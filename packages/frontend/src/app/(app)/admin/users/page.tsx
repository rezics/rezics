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
 * | Users                       |
 * | [search icon] [input     ]  |
 * |-----------------------------|
 * | Name  | Role | Status       |
 * |-------|------|--------       |
 * |       (empty placeholder)   |
 * +-----------------------------+
 * w-full，表格水平滚动（overflow-auto by Table wrapper）。
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | Users                                |
 * | [search icon] [input              ]  |
 * | Name  | Email       | Role | Status  |
 * |-------|-------------|------|---------|
 * +--------------------------------------+
 * Email 列在 sm 断点显示。
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | [sidebar] | Users                        |
 * |           | [search icon] [input       ] |
 * |           | Name | Email | Role | Status | Joined |
 * |           |------|-------|------|--------|--------|
 * +------------------------------------------+
 * 侧边栏 + 完整五列表格。Joined 列在 lg 断点显示。
 *
 * Ultra-wide (>=1536px): 与 Desktop 一致。
 *
 * 用户管理列表：搜索框 + 数据表格。
 * 当前为占位实现，表格数据待 API 接入后填充。
 */

function AdminUsersContent() {
  const [t] = useT();
  const [query, setQuery] = useState("");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t.admin.users}</h1>

      <div className="relative">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          className="pl-10"
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.admin.searchUsers}
          type="search"
          value={query}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.admin.name}</TableHead>
            <TableHead className="hidden sm:table-cell">{t.admin.email}</TableHead>
            <TableHead>{t.admin.role}</TableHead>
            <TableHead>{t.admin.status}</TableHead>
            <TableHead className="hidden lg:table-cell">{t.admin.joined}</TableHead>
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

export default function AdminUsersPage() {
  return (
    <SectionBoundary>
      <ClientOnly>
        <AdminUsersContent />
      </ClientOnly>
    </SectionBoundary>
  );
}
