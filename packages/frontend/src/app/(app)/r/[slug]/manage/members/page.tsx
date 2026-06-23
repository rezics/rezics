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
 * | Members                     |
 * | [search icon] [input     ]  |
 * |-----------------------------|
 * | Name  | Role                |
 * |-------|------               |
 * |       (empty placeholder)   |
 * +-----------------------------+
 * w-full，表格水平滚动。
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | Members                              |
 * | [search icon] [input              ]  |
 * | Name  | Role      | Joined          |
 * |-------|-----------|------           |
 * +--------------------------------------+
 * Joined 列在 sm 断点显示。
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | [manage nav] | Members                   |
 * |              | [search icon] [input    ] |
 * |              | Name | Role | Joined | Actions |
 * |              |------|------|--------|---------|
 * +------------------------------------------+
 * 侧边导航 + 完整四列表格。Actions 列在 lg 断点显示。
 *
 * Ultra-wide (>=1536px): 与 Desktop 一致。
 *
 * Realm 成员管理列表：搜索框 + 成员表格（名称、角色、加入时间、操作）。
 * 当前为占位实现，待 API 接入后填充。
 */

function ManageMembersContent() {
  const [t] = useT();
  const [query, setQuery] = useState("");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t.manage.members}</h1>

      <div className="relative">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          className="pl-10"
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.manage.searchMembers}
          type="search"
          value={query}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.admin.name}</TableHead>
            <TableHead>{t.manage.memberRole}</TableHead>
            <TableHead className="hidden sm:table-cell">{t.manage.memberJoined}</TableHead>
            <TableHead className="hidden lg:table-cell">{t.manage.memberActions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Placeholder empty state — rows populated once API connected */}
          {/* 占位空状态 — API 接入后填充行数据 */}
          <TableRow>
            <TableCell colSpan={4}>
              <p className="text-muted-foreground py-8 text-center text-sm">
                {t.manage.noMembers}
              </p>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

export default function ManageRealmMembersPage() {
  return (
    <SectionBoundary>
      <ClientOnly>
        <ManageMembersContent />
      </ClientOnly>
    </SectionBoundary>
  );
}
