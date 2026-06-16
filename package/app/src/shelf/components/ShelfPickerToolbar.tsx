import { meiliTagSearchQueryOptions } from "@rezics/api/meili/meili.queries";
import { tagBatchTranslationsQuery } from "@rezics/api/tag/tag";
import type { TagSearchDocument } from "@rezics/contract";
import { useLocale, useTranslation } from "@rezics/i18n/react";
import {
  Badge,
  Button,
  Input,
  Label,
  Popover,
  PopoverContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";

export type ShelfPickerSortValue =
  | "updatedAt:desc"
  | "createdAt:desc"
  | "createdAt:asc"
  | "itemCount:desc";

interface ShelfPickerToolbarProps {
  query: string;
  onQueryChange: (query: string) => void;
  tagIds: string[];
  onTagIdsChange: (tagIds: string[]) => void;
  sort: ShelfPickerSortValue;
  onSortChange: (sort: ShelfPickerSortValue) => void;
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
 * Shelf picker controls.
 *
 * 用於 Add-to-Shelf dialog 頂部的 shelf 專用篩選區。搜尋只匹配 shelf
 * 標題；tag picker 只匹配 shelf 自身 pinned tags；排序只控制 shelf 列表。
 *
 * Mobile:
 * +----------------------+
 * | Search shelf         |
 * | Tag filter [x]       |
 * |   floating results   |
 * | [selected tags wrap] |
 * | Sort                 |
 * +----------------------+
 *
 * Tablet:
 * +--------------------------------+
 * | Search shelf        | Sort     |
 * | Tag filter [x] + selected tags |
 * | floating results overlay list  |
 * +--------------------------------+
 *
 * Desktop:
 * +------------------------------------------------+
 * | Search shelf                         | Sort     |
 * | Tag filter [x] + selected tags, left aligned   |
 * |   dropdown overlays list; toolbar height fixed |
 * +------------------------------------------------+
 *
 * Ultra-wide:
 * +------------------------------------------------+
 * | Same as desktop; parent dialog caps width.      |
 * +------------------------------------------------+
 */
export function ShelfPickerToolbar({
  query,
  onQueryChange,
  tagIds,
  onTagIdsChange,
  sort,
  onSortChange,
}: ShelfPickerToolbarProps) {
  const locale = useLocale();
  const { t } = useTranslation(["common", "community", "entity"]);
  const [tagSearchText, setTagSearchText] = useState("");
  const tagSearchAnchorRef = useRef<HTMLDivElement | null>(null);
  const tagSearchInputRef = useRef<HTMLInputElement | null>(null);
  const trimmedTagSearchText = tagSearchText.trim();
  const tagSearchQueryResult = useQuery({
    ...meiliTagSearchQueryOptions({ q: trimmedTagSearchText, limit: 8 }),
    enabled: trimmedTagSearchText.length > 0,
  });
  const tagTranslationsQuery = useQuery(
    tagBatchTranslationsQuery(tagIds, locale),
  );
  const selectedTags = useMemo(() => new Set(tagIds), [tagIds]);
  const tagLabels = tagTranslationsQuery.data ?? {};
  const searchOptions = (tagSearchQueryResult.data?.items ?? [])
    .map(tagSearchOptionFromDoc)
    .filter((tag) => !selectedTags.has(tag.unitId))
    .slice(0, 8);

  function addTag(tagUnitId: string) {
    onTagIdsChange(
      tagIds.includes(tagUnitId) ? tagIds : [...tagIds, tagUnitId],
    );
    setTagSearchText("");
    tagSearchInputRef.current?.focus();
  }

  function removeTag(tagUnitId: string) {
    onTagIdsChange(tagIds.filter((id) => id !== tagUnitId));
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="add-to-shelf-search">
            {t("entity:shelf_picker_search_label")}
          </Label>
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <Input
              id="add-to-shelf-search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              className="w-full pl-9"
              placeholder={t("entity:shelf_picker_search_placeholder")}
            />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="add-to-shelf-sort">
            {t("entity:shelf_controls_sort_by")}
          </Label>
          <Select
            value={sort}
            onValueChange={(value) =>
              onSortChange(value as ShelfPickerSortValue)
            }
          >
            <SelectTrigger id="add-to-shelf-sort" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updatedAt:desc">
                {t("entity:shelf_sort_updated")}
              </SelectItem>
              <SelectItem value="createdAt:desc">
                {t("entity:shelf_sort_newest")}
              </SelectItem>
              <SelectItem value="createdAt:asc">
                {t("entity:shelf_sort_oldest")}
              </SelectItem>
              <SelectItem value="itemCount:desc">
                {t("entity:shelf_sort_most_items")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="add-to-shelf-tag-search">
            {t("entity:shelf_picker_tag_filter_label")}
          </Label>
          <Popover open={Boolean(tagSearchText.trim())}>
            <div ref={tagSearchAnchorRef} className="relative min-w-0">
              <Input
                id="add-to-shelf-tag-search"
                ref={tagSearchInputRef}
                value={tagSearchText}
                onChange={(event) => setTagSearchText(event.target.value)}
                className={tagSearchText ? "pr-9" : undefined}
                placeholder={t("entity:shelf_picker_tag_filter_placeholder")}
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
                  {t("entity:shelf_picker_tag_empty")}
                </div>
              )}
            </PopoverContent>
          </Popover>
          {tagIds.length > 0 ? (
            <div className="flex min-w-0 flex-wrap gap-2">
              {tagIds.map((tagUnitId) => (
                <Badge
                  key={tagUnitId}
                  variant="outline"
                  className="flex max-w-full items-center gap-1"
                >
                  <span className="min-w-0 truncate">
                    {tagLabels[tagUnitId]?.name || tagUnitId}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-4 w-4 shrink-0 p-0"
                    aria-label={t("entity:shelf_picker_tag_remove")}
                    onClick={() => removeTag(tagUnitId)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
