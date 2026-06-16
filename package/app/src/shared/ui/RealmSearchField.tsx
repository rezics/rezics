import { realmSearchQueryOptions } from "@rezics/api/meili/meili.queries";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Input, Label } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useId, useState } from "react";
import { useDebouncedValue } from "@/entity-picker";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";

type PickedRealm = {
  unitId: string;
  title: string | null;
  slug: string | null;
};

export interface RealmSearchFieldProps {
  /** Current selected realm unit ID (controlled). 当前已选 realm unitId（受控）。 */
  value: string;
  /** Called when the user selects or clears a pick. 用户选择或清除时调用。 */
  onChange: (unitId: string) => void;
  id?: string;
  label?: string;
  placeholder?: string;
}

/**
 * Inline realm search field: text input + dropdown result list, no dialog.
 * Controlled by `value` (a realm unit ID); emits on pick or clear.
 *
 * 内联 realm 搜索字段：文本输入框 + 下拉结果列表，无弹窗。
 * 由 `value`（realm unitId）受控；选择或清除时触发 `onChange`。
 */
export function RealmSearchField({
  value,
  onChange,
  id,
  label,
  placeholder,
}: RealmSearchFieldProps) {
  const { t } = useTranslation("common");
  const readContext = useReadLanguageContext();
  const fieldId = id ?? "realm-search-field";
  const listboxId = `${fieldId}-listbox`;
  const autoId = useId();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PickedRealm | null>(null);
  // Track which result is visually active for aria-activedescendant.
  // 追踪当前视觉上激活的结果项，用于 aria-activedescendant。
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const debouncedQuery = useDebouncedValue(query.trim(), 200);

  const searchQuery = useQuery({
    ...realmSearchQueryOptions({
      keyword: debouncedQuery,
      limit: 8,
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    enabled: readContext.ready && debouncedQuery.length > 0,
  });
  const results = searchQuery.data?.items ?? [];
  const isListOpen = results.length > 0;

  const handlePick = (realm: PickedRealm) => {
    setSelected(realm);
    setQuery("");
    onChange(realm.unitId);
  };

  const handleClear = () => {
    setSelected(null);
    setQuery("");
    onChange("");
  };

  return (
    <div className="flex flex-col gap-2">
      {label ? <Label htmlFor={fieldId}>{label}</Label> : null}

      {selected && value ? (
        // Selected state: show picked realm with a clear button.
        // 已选中状态：展示已选 realm 及清除按钮。
        <div className="flex items-center gap-2 rounded-md border border-border-default bg-surface-subtle px-3 py-2 text-sm">
          <span className="flex-1 truncate text-text-primary">
            {selected.title ?? selected.slug ?? selected.unitId}
          </span>
          {selected.slug ? (
            <span className="shrink-0 font-mono text-xs text-text-tertiary">
              {selected.slug}
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleClear}
            className="ml-1 shrink-0 rounded-sm text-text-tertiary hover:text-text-primary"
            aria-label={t("accessibility_clear_selection")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        // Search state: text input + live results dropdown.
        // 搜索状态：文本输入框 + 实时结果下拉列表。
        <div className="flex flex-col gap-1">
          <Input
            id={fieldId}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(-1);
            }}
            placeholder={placeholder}
            role="combobox"
            aria-expanded={isListOpen}
            aria-controls={listboxId}
            aria-activedescendant={
              activeIndex >= 0 ? `${autoId}-option-${activeIndex}` : undefined
            }
            aria-autocomplete="list"
          />
          {searchQuery.isFetching ? (
            <div className="flex justify-center py-2">
              <Spinner />
            </div>
          ) : null}
          {results.length > 0 ? (
            <div
              id={listboxId}
              role="listbox"
              aria-label={t("accessibility_search_results")}
              className="flex flex-col rounded-md border border-border-whisper bg-surface-canvas shadow-sm"
            >
              {results.map((realm, index) => (
                <button
                  key={realm.id}
                  id={`${autoId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={activeIndex === index}
                  className="flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm leading-ui text-text-primary hover:bg-surface-subtle"
                  onClick={() =>
                    handlePick({
                      unitId: realm.id,
                      title: realm.title ?? null,
                      slug: null,
                    })
                  }
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(-1)}
                >
                  <span className="truncate">{realm.title ?? realm.id}</span>
                  <span className="shrink-0 font-mono text-xs text-text-tertiary">
                    {realm.id.slice(0, 8)}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
