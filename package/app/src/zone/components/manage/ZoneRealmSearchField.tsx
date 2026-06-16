import { realmSearchQuery } from "@rezics/api/realm/realm";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Input } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useDebouncedValue } from "@/entity-picker";

type ZonePickedRealm = {
  unitId: string;
  title: string | null;
  slug: string | null;
};

/**
 * Inline realm search: input + result list, no dialog. Used by the profile
 * context picker and the query builder's realm-ids list.
 * 内联 realm 搜索：输入框 + 结果列表，无对话框。供资料页语境选择器与
 * 查询构建器的 realm id 列表使用。
 */
export function ZoneRealmSearchField({
  onPick,
}: {
  onPick: (realm: ZonePickedRealm) => void;
}) {
  const { t } = useTranslation(["zone"]);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), 200);
  const searchQuery = useQuery({
    ...realmSearchQuery(debouncedQuery, { limit: 8 }),
    enabled: debouncedQuery.length > 0,
  });
  const results = searchQuery.data?.realms ?? [];

  return (
    <div className="flex flex-col gap-2">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("zone:manage_context_realm_search")}
      />
      {searchQuery.isFetching ? (
        <div className="flex justify-center py-2">
          <Spinner />
        </div>
      ) : null}
      {results.length > 0 ? (
        <div className="flex flex-col">
          {results.map((realm) => (
            <button
              key={realm.unitId}
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm leading-ui text-text-primary hover:bg-surface-subtle"
              onClick={() => {
                setQuery("");
                onPick({
                  unitId: realm.unitId,
                  title: realm.title ?? null,
                  slug: realm.slug ?? null,
                });
              }}
            >
              <span className="truncate">{realm.title ?? realm.unitId}</span>
              {realm.slug ? (
                <span className="shrink-0 font-mono text-xs text-text-tertiary">
                  {realm.slug}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
