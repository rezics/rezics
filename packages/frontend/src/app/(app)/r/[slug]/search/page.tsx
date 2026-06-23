"use client";

import { Input } from "@/components/ui/input";
import { ClientOnly } from "@/components/ClientOnly";
import { SectionBoundary } from "@/components/SectionBoundary";
import { useT } from "@/lib/i18n/locale";
import { SearchIcon } from "lucide-react";
import { useState } from "react";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | [search icon] [input     ]  |
 * |-----------------------------|
 * | (no results placeholder)    |
 * +-----------------------------+
 * w-full，搜索框占满宽度。
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | [search icon] [input              ]  |
 * |--------------------------------------|
 * | (no results placeholder)             |
 * +--------------------------------------+
 * w-full 居中。
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | [realm layout] |                         |
 * |                | [search icon] [input  ] |
 * |                |-------------------------------|
 * |                | (no results placeholder)|
 * +------------------------------------------+
 * 继承 realm 布局，搜索区域 flex-1。
 *
 * Ultra-wide (>=1536px): 与 Desktop 一致。
 *
 * Realm 内搜索页面：搜索框 + 结果列表（带分页）。
 * 搜索范围限定在当前 realm 内。
 * 当前为占位实现，待 Meilisearch 集成后接入实际搜索。
 */

function RealmSearchContent() {
  const [t] = useT();
  const [query, setQuery] = useState("");

  return (
    <div className="space-y-4">
      <div className="relative">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          className="pl-10"
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.manage.searchInRealm}
          type="search"
          value={query}
        />
      </div>

      {query.length > 0 ? (
        <div className="text-muted-foreground space-y-2 py-8 text-center text-sm">
          <p>{t.manage.searchNoResults}</p>
        </div>
      ) : (
        <div className="text-muted-foreground py-12 text-center text-sm">
          {t.manage.searchInRealm}
        </div>
      )}
    </div>
  );
}

export default function RealmSearchPage() {
  return (
    <SectionBoundary>
      <ClientOnly>
        <RealmSearchContent />
      </ClientOnly>
    </SectionBoundary>
  );
}
