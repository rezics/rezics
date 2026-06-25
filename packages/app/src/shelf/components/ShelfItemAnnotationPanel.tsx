import { meiliTagSearchQueryOptions } from "@rezics/contract/api/meili/meili.queries";
import { tagBatchTranslationsQuery } from "@rezics/contract/api/tag/tag";
import { userShelfItemForUnitQuery } from "@rezics/contract/api/user-shelf-item/user-shelf-item";
import { userTagApplicationsForUnitQuery } from "@rezics/contract/api/user-tag-application/user-tag-application.queries";
import type { TagSearchDocument } from "@rezics/contract";
import { useLocale, useTranslation } from "@rezics/i18n/react";
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
  Popover,
  PopoverContent,
  Textarea,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export interface ShelfItemAnnotationValue {
  tagUnitIds: string[];
  searchText: string;
}

interface ShelfItemAnnotationPanelProps {
  unitId: string;
  value: ShelfItemAnnotationValue;
  onChange: (value: ShelfItemAnnotationValue) => void;
  showIndependent?: boolean;
  independent?: boolean;
  onIndependentChange?: (independent: boolean) => void;
}

type SearchTagOption = {
  unitId: string;
  label?: string | null;
  slug?: string | null;
};

function tagSearchOptionFromDoc(doc: TagSearchDocument): SearchTagOption {
  return {
    unitId: doc.unitId,
    label: doc.title ?? doc.titles[0] ?? null,
    slug: doc.slug ?? null,
  };
}

function tagOptionLabel(option: SearchTagOption): string {
  return option.label ?? option.slug ?? option.unitId;
}

/**
 * Shelf item annotation controls.
 *
 * 用於 Add-to-Shelf dialog 內針對「被加入的 item」寫入使用者自己的 tags 與
 * 私有搜尋文字。行內按鈕固定不收縮，長 tag 名稱截斷；寬屏只擴展輸入欄。
 *
 * Mobile:
 * +----------------------+
 * | User tags            |
 * | [search tag...][x]   |
 * |   floating results   |
 * | [Long tag x] [tag x] |
 * | Private text         |
 * | [textarea          ] |
 * | [ ] Independent     |
 * +----------------------+
 *
 * Tablet:
 * +--------------------------------+
 * | User tags                      |
 * | [search tag...][x]             |
 * | floating results overlay fields|
 * | [Long tag x] [tag x] [tag x]   |
 * | Private text                   |
 * | [textarea                    ] |
 * +--------------------------------+
 *
 * Desktop:
 * +------------------------------------------------+
 * | User tags                                      |
 * | [search tag...][x]                             |
 * |   dropdown overlays panel content, no reflow   |
 * | [chips wrap, input width fixed by parent]      |
 * | Private text                                   |
 * +------------------------------------------------+
 *
 * Ultra-wide:
 * +------------------------------------------------+
 * | Width remains capped by parent dialog.          |
 * +------------------------------------------------+
 */
export function ShelfItemAnnotationPanel({
  unitId,
  value,
  onChange,
  showIndependent = false,
  independent = false,
  onIndependentChange,
}: ShelfItemAnnotationPanelProps) {
  const locale = useLocale();
  const { t } = useTranslation(["common", "community", "entity"]);
  const [tagSearchText, setTagSearchText] = useState("");
  const hydratedRef = useRef(false);
  const tagSearchAnchorRef = useRef<HTMLDivElement | null>(null);
  const tagSearchInputRef = useRef<HTMLInputElement | null>(null);

  const applicationsQuery = useQuery(userTagApplicationsForUnitQuery(unitId));
  const metadataQuery = useQuery(userShelfItemForUnitQuery(unitId));
  const trimmedTagSearchText = tagSearchText.trim();
  const tagSearchQueryResult = useQuery({
    ...meiliTagSearchQueryOptions({ q: trimmedTagSearchText, limit: 8 }),
    enabled: trimmedTagSearchText.length > 0,
  });
  const tagTranslationsQuery = useQuery(
    tagBatchTranslationsQuery(value.tagUnitIds, locale),
  );

  useEffect(() => {
    if (hydratedRef.current) return;
    if (!applicationsQuery.data || metadataQuery.isLoading) return;
    hydratedRef.current = true;
    onChange({
      tagUnitIds: applicationsQuery.data.map((row) => row.tagUnitId),
      searchText: metadataQuery.data?.searchText ?? "",
    });
  }, [
    applicationsQuery.data,
    metadataQuery.data?.searchText,
    metadataQuery.isLoading,
    onChange,
  ]);

  const selectedTags = useMemo(
    () => new Set(value.tagUnitIds),
    [value.tagUnitIds],
  );
  const tagLabels = tagTranslationsQuery.data ?? {};
  const searchOptions = (tagSearchQueryResult.data?.items ?? [])
    .map(tagSearchOptionFromDoc)
    .filter((tag) => !selectedTags.has(tag.unitId))
    .slice(0, 8);

  function addTag(tagUnitId: string) {
    onChange({
      ...value,
      tagUnitIds: value.tagUnitIds.includes(tagUnitId)
        ? value.tagUnitIds
        : [...value.tagUnitIds, tagUnitId],
    });
    setTagSearchText("");
    tagSearchInputRef.current?.focus();
  }

  function removeTag(tagUnitId: string) {
    onChange({
      ...value,
      tagUnitIds: value.tagUnitIds.filter((id) => id !== tagUnitId),
    });
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 rounded-md bg-surface-subtle p-3">
      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor={`add-to-shelf-tags-${unitId}`}>
          {t("entity:shelf_item_user_tags_label")}
        </Label>
        <Popover open={Boolean(tagSearchText.trim())}>
          <div ref={tagSearchAnchorRef} className="relative min-w-0">
            <Input
              id={`add-to-shelf-tags-${unitId}`}
              ref={tagSearchInputRef}
              value={tagSearchText}
              onChange={(event) => setTagSearchText(event.target.value)}
              className={tagSearchText ? "pr-9" : undefined}
              placeholder={t("community:tag_search_placeholder")}
            />
            {tagSearchText ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
                aria-label={t("community:tag_clear")}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setTagSearchText("");
                  tagSearchInputRef.current?.focus();
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
          <PopoverContent
            anchor={tagSearchAnchorRef.current}
            align="start"
            sideOffset={4}
            initialFocus={false}
            finalFocus={false}
            className="max-h-40 w-[min(42rem,calc(100vw-2rem))] gap-0 overflow-auto rounded-md border border-border-whisper bg-surface-base p-0 shadow-lg"
          >
            {tagSearchQueryResult.isLoading ? (
              <div className="px-3 py-2 text-sm text-text-secondary">
                {t("common:loading")}
              </div>
            ) : searchOptions.length > 0 ? (
              <ul>
                {searchOptions.map((tag) => (
                  <li key={tag.unitId}>
                    <button
                      type="button"
                      tabIndex={-1}
                      className="flex w-full min-w-0 items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-subtle focus-visible:bg-surface-subtle focus-visible:outline-none"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => addTag(tag.unitId)}
                    >
                      <span className="min-w-0 truncate">
                        {tagOptionLabel(tag)}
                      </span>
                      <Plus className="h-4 w-4 shrink-0 text-text-secondary" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-3 py-2 text-sm text-text-secondary">
                {t("community:post_tag_picker_no_matches")}
              </div>
            )}
          </PopoverContent>
        </Popover>
        {value.tagUnitIds.length > 0 ? (
          <div className="flex min-w-0 flex-wrap gap-2">
            {value.tagUnitIds.map((tagUnitId) => (
              <Badge
                key={tagUnitId}
                variant="outline"
                className="flex max-w-full items-center gap-1 bg-surface-base"
              >
                <span className="min-w-0 truncate">
                  {tagLabels[tagUnitId]?.name || tagUnitId}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-4 w-4 shrink-0 p-0"
                  aria-label={t("community:tag_clear")}
                  onClick={() => removeTag(tagUnitId)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor={`add-to-shelf-search-text-${unitId}`}>
          {t("entity:shelf_item_private_text_label")}
        </Label>
        <Textarea
          id={`add-to-shelf-search-text-${unitId}`}
          value={value.searchText}
          onChange={(event) =>
            onChange({ ...value, searchText: event.target.value })
          }
          placeholder={t("entity:shelf_item_private_text_placeholder")}
          rows={3}
        />
        <p className="text-xs leading-[1.4] text-text-secondary">
          {t("entity:shelf_item_private_text_hint")}
        </p>
      </div>

      {showIndependent ? (
        <label
          htmlFor="shelf-item-independent-unit"
          className="flex min-w-0 items-center gap-2 text-sm"
        >
          <Checkbox
            id="shelf-item-independent-unit"
            checked={independent}
            onCheckedChange={(checked) =>
              onIndependentChange?.(checked === true)
            }
            className="shrink-0"
          />
          <span className="min-w-0 truncate">
            {t("entity:add_to_shelf_independent_unit")}
          </span>
        </label>
      ) : null}
    </div>
  );
}
