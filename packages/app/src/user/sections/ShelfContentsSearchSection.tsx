/**
 * ShelfContentsSearchSection — 书架内容搜索页面，支持按标题和标签过滤书架内的单元，
 * 展示私有/公开书架中的条目列表，支持返回书架列表。
 *
 * ┌────────────────────────────────────────────┐
 * │ Shelf Search (desktop 1024px+)             │
 * │ ┌──────────────────────────────────────────┐
 * │ │ [< Back]                                 │
 * │ │ [Search Title...]                        │
 * │ │ [Tags: [] + Tag Search...]               │
 * │ │ Selected: [Design] [Featured] [x] [x]    │
 * │ ├──────────────────────────────────────────┤
 * │ │ [Unit Title] 5 shelves, 3 tags          │
 * │ │ [Unit Title] 2 shelves, 1 tags          │
 * │ │ [Unit Title] 8 shelves, 4 tags          │
 * │ └──────────────────────────────────────────┘
 * └────────────────────────────────────────────┘
 *
 * ┌──────────────────────────┐
 * │ Shelf Search (tablet)    │
 * │ ┌────────────────────────┐
 * │ │ [Back]                 │
 * │ │ [Search...]            │
 * │ │ [Tags +Tag Search...]  │
 * │ │ [Design] [Featured]    │
 * │ ├────────────────────────┤
 * │ │ [Unit] 5 shelves 3 tags│
 * │ │ [Unit] 2 shelves 1 tag │
 * │ └────────────────────────┘
 * └──────────────────────────┘
 *
 * ┌────────────────────┐
 * │ Shelf (mobile 375) │
 * │ ┌──────────────────┐
 * │ │ [< Back]         │
 * │ │ [Search..]       │
 * │ │ [Tags..]         │
 * │ │ [Tag1] [x] [x]   │
 * │ ├──────────────────┤
 * │ │ [Unit]           │
 * │ │ 5 shelves, 3 tg. │
 * │ └──────────────────┘
 * └────────────────────┘
 *
 * ┌────────────────────┐
 * │ Empty State (none) │
 * │ ┌──────────────────┐
 * │ │ No items found   │
 * │ └──────────────────┘
 * └────────────────────┘
 */

import {
  meiliTagSearchQueryOptions,
  tagBatchTranslationsQuery,
  userShelfItemSearchMineQuery,
  userShelfItemSearchUserQuery,
} from "@rezics/contract/api";
import type { TagSearchDocument, UserShelfItemDTO } from "@rezics/contract";
import { useLocale, useTranslation } from "@rezics/i18n/react";
import { Badge, Button, Input, Label } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Plus, Search, X } from "lucide-react";
import { type FC, useMemo, useState } from "react";
import { useProfileContext } from "@/user/components/ProfileLayout";

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

export const ShelfContentsSearchSection: FC = () => {
  const locale = useLocale();
  const { t } = useTranslation(["common", "community", "entity"]);
  const { userId, isCurrentUser, profileRoute } = useProfileContext();
  const [queryText, setQueryText] = useState("");
  const [tagSearchText, setTagSearchText] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const shelfItemQuery = {
    q: queryText.trim() || undefined,
    tagUnitIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    limit: 100,
  };
  const ownShelfItems = useQuery({
    ...userShelfItemSearchMineQuery(shelfItemQuery),
    enabled: isCurrentUser,
  });
  const publicShelfItems = useQuery({
    ...userShelfItemSearchUserQuery(userId, shelfItemQuery),
    enabled: !isCurrentUser && Boolean(userId),
  });
  const shelfItems = isCurrentUser ? ownShelfItems : publicShelfItems;
  const trimmedTagSearchText = tagSearchText.trim();
  const tagSearch = useQuery({
    ...meiliTagSearchQueryOptions({ q: trimmedTagSearchText, limit: 8 }),
    enabled: trimmedTagSearchText.length > 0,
  });
  const tagTranslations = useQuery(
    tagBatchTranslationsQuery(selectedTagIds, locale),
  );

  const selectedTags = useMemo(() => new Set(selectedTagIds), [selectedTagIds]);
  const searchOptions = (tagSearch.data?.items ?? [])
    .map(tagSearchOptionFromDoc)
    .filter((tag) => !selectedTags.has(tag.unitId))
    .slice(0, 8);
  const tagLabels = tagTranslations.data ?? {};
  const units = shelfItems.data?.units ?? [];

  function addTag(tagUnitId: string) {
    setSelectedTagIds((current) =>
      current.includes(tagUnitId) ? current : [...current, tagUnitId],
    );
    setTagSearchText("");
  }

  function removeTag(tagUnitId: string) {
    setSelectedTagIds((current) => current.filter((id) => id !== tagUnitId));
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <Link
        to={
          profileRoute.kind === "id"
            ? "/user/$userId/profile/shelf"
            : "/u/$userSlug/profile/shelf"
        }
        params={
          profileRoute.kind === "id"
            ? { userId: profileRoute.userId }
            : { userSlug: profileRoute.userSlug }
        }
        className="w-fit no-underline"
      >
        <Button type="button" variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("common:back")}
        </Button>
      </Link>

      <div className="flex flex-col gap-3">
        <Label htmlFor="shelf-contents-search-input">
          {isCurrentUser
            ? t("entity:shelf_contents_search_private_title")
            : t("entity:shelf_contents_search_public_title")}
        </Label>
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 shrink-0 text-text-secondary" />
          <Input
            id="shelf-contents-search-input"
            value={queryText}
            onChange={(event) => setQueryText(event.target.value)}
            placeholder={t("entity:shelf_contents_search_input_placeholder")}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="shelf-contents-tag-filter">
          {t("entity:shelf_item_tag_filter_label")}
        </Label>
        <Input
          id="shelf-contents-tag-filter"
          value={tagSearchText}
          onChange={(event) => setTagSearchText(event.target.value)}
          placeholder={t("community:tag_search_placeholder")}
        />
        {selectedTagIds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedTagIds.map((tagUnitId) => (
              <Badge
                key={tagUnitId}
                variant="outline"
                className="flex max-w-full items-center gap-1"
              >
                <span className="truncate">
                  {tagLabels[tagUnitId]?.name || tagUnitId}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-4 w-4 p-0"
                  aria-label={t("community:tag_clear")}
                  onClick={() => removeTag(tagUnitId)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}
        {tagSearchText.trim() && searchOptions.length > 0 && (
          <div className="max-h-40 overflow-auto rounded-md border border-border-whisper">
            <ul>
              {searchOptions.map((tag) => (
                <li key={tag.unitId}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-subtle"
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
          </div>
        )}
      </div>

      {shelfItems.isLoading ? (
        <p className="py-12 text-center text-sm text-text-secondary">
          {t("common:loading")}
        </p>
      ) : shelfItems.error ? (
        <p className="py-12 text-center text-sm text-text-error">
          {shelfItems.error.message}
        </p>
      ) : units.length === 0 ? (
        <p className="py-12 text-center text-sm text-text-secondary">
          {t("entity:shelf_contents_search_empty")}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {units.map((unit) => (
            <ShelfContentsUnitRow
              key={unit.unitId}
              unit={unit}
              showPrivateText={isCurrentUser}
            />
          ))}
          {/* This profile summary intentionally stays non-paginated; full shelf
              browsing happens on the shelf detail page where root-safe cursors
              and local view pagination are available.
              这个个人页摘要有意不做分页；完整书架浏览在 shelf 详情页完成，
              那里具备 root-safe cursor 与本地视图分页。 */}
          {shelfItems.data?.hasMore && (
            <p className="py-2 text-center text-sm text-text-secondary">
              {t("entity:shelf_contents_search_has_more")}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

function tagOptionLabel(option: SearchTagOption): string {
  return option.label ?? option.slug ?? option.unitId;
}

function ShelfContentsUnitRow({
  unit,
  showPrivateText,
}: {
  unit: UserShelfItemDTO;
  showPrivateText: boolean;
}) {
  const { t } = useTranslation(["entity"]);
  return (
    <Link
      to="/unit/$unitId"
      params={{ unitId: unit.unitId }}
      search={{ view: "auto" }}
      className="flex min-w-0 flex-col gap-2 rounded-md border border-border-whisper bg-surface-base px-3 py-3 text-text-primary no-underline transition-colors hover:border-border-defined"
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-medium">
          {unit.unitId}
        </span>
        <span className="shrink-0 text-xs text-text-secondary">
          {t("entity:shelf_item_shelf_count", {
            count: unit.shelfIds.length,
          })}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-text-secondary">
        <span>
          {t("entity:shelf_item_tag_count", {
            count: unit.tagUnitIds.length,
          })}
        </span>
        {showPrivateText && unit.searchText ? (
          <span className="min-w-0 truncate">
            {t("entity:shelf_item_private_text_label")}: {unit.searchText}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
