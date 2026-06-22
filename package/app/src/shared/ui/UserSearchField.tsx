import { useUserSearchQuery } from "@rezics/api/meili/meili.queries";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Input, Label } from "@rezics/ui/shadcn";
import { X } from "lucide-react";
import { useId, useState } from "react";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";

type PickedUser = {
  unitId: string;
  slug: string | null;
  name: string | null;
};

export interface UserSearchFieldProps {
  /** Current selected user unit ID (controlled). 当前已选用户 unitId（受控）。 */
  value: string;
  /** Called when the user selects or clears a pick. 用户选择或清除时调用。 */
  onChange: (unitId: string) => void;
  id?: string;
  label?: string;
  placeholder?: string;
}

/**
 * Inline user search field: text input + dropdown result list, no dialog.
 * Controlled by `value` (a user unit ID); emits on pick or clear.
 *
 * 内联用户搜索字段：文本输入框 + 下拉结果列表，无弹窗。
 * 由 `value`（用户 unitId）受控；选择或清除时触发 `onChange`。
 */
export function UserSearchField({
  value,
  onChange,
  id,
  label,
  placeholder,
}: UserSearchFieldProps) {
  const { t } = useTranslation("common");
  const fieldId = id ?? "user-search-field";
  const listboxId = `${fieldId}-listbox`;
  const autoId = useId();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PickedUser | null>(null);
  // Track which result is visually active for aria-activedescendant.
  // 追踪当前视觉上激活的结果项，用于 aria-activedescendant。
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const debouncedQuery = useDebouncedValue(query.trim(), 200);

  const searchQuery = useUserSearchQuery({
    q: debouncedQuery || undefined,
    limit: 8,
  });
  const results = searchQuery.data?.users ?? [];
  const isListOpen = results.length > 0;

  const handlePick = (user: PickedUser) => {
    setSelected(user);
    setQuery("");
    onChange(user.unitId);
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
        // Selected state: show picked user with a clear button.
        // 已选中状态：展示已选用户及清除按钮。
        <div className="flex items-center gap-2 rounded-md border border-border-default bg-surface-subtle px-3 py-2 text-sm">
          <span className="flex-1 truncate text-text-primary">
            {selected.name ?? selected.slug ?? selected.unitId}
          </span>
          <span className="shrink-0 font-mono text-xs text-text-tertiary">
            {selected.slug ?? selected.unitId}
          </span>
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
              {results.map((user, index) => (
                <button
                  key={user.unitId}
                  id={`${autoId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={activeIndex === index}
                  className="flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm leading-ui text-text-primary hover:bg-surface-subtle"
                  onClick={() =>
                    handlePick({
                      unitId: user.unitId,
                      slug: user.slug ?? null,
                      name: user.name ?? null,
                    })
                  }
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(-1)}
                >
                  <span className="truncate">
                    {user.name ?? user.slug ?? user.unitId}
                  </span>
                  {user.slug ? (
                    <span className="shrink-0 font-mono text-xs text-text-tertiary">
                      {user.slug}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
