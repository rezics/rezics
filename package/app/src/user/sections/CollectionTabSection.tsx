import {
  tagBatchTranslationsQuery,
  tagSearchQuery,
  userUnitCollectionSearchMineQuery,
  userUnitCollectionSearchUserQuery,
} from "@rezics/api";
import type { CollectionUnitDTO } from "@rezics/contract";
import { useLocale, useTranslation } from "@rezics/i18n/react";
import { Badge, Button, Input, Label } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus, Search, X } from "lucide-react";
import { type FC, useMemo, useState } from "react";
import { useProfileContext } from "@/user/components/ProfileLayout";

type SearchTagOption = {
  unitId: string;
  label?: string | null;
  slug?: string | null;
};

function tagOptionLabel(option: SearchTagOption): string {
  return option.label ?? option.slug ?? option.unitId;
}

export const CollectionTabSection: FC = () => {
  const locale = useLocale();
  const { t } = useTranslation(["common", "community", "entity"]);
  const { userId, isCurrentUser } = useProfileContext();
  const [queryText, setQueryText] = useState("");
  const [tagSearchText, setTagSearchText] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const collectionQuery = {
    q: queryText.trim() || undefined,
    tagUnitIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    limit: 100,
  };
  const collection = useQuery(
    isCurrentUser
      ? userUnitCollectionSearchMineQuery(collectionQuery)
      : userUnitCollectionSearchUserQuery(userId, collectionQuery),
  );
  const tagSearch = useQuery(tagSearchQuery(tagSearchText.trim()));
  const tagTranslations = useQuery(
    tagBatchTranslationsQuery(selectedTagIds, locale),
  );

  const selectedTags = useMemo(() => new Set(selectedTagIds), [selectedTagIds]);
  const searchOptions = ((tagSearch.data?.tags ?? []) as SearchTagOption[])
    .filter((tag) => !selectedTags.has(tag.unitId))
    .slice(0, 8);
  const tagLabels = tagTranslations.data ?? {};
  const units = collection.data?.units ?? [];

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
      <div className="flex flex-col gap-3">
        <Label htmlFor="collection-search-input">
          {isCurrentUser
            ? t("entity:collection_search_private_title")
            : t("entity:collection_search_public_title")}
        </Label>
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 shrink-0 text-text-secondary" />
          <Input
            id="collection-search-input"
            value={queryText}
            onChange={(event) => setQueryText(event.target.value)}
            placeholder={t("entity:collection_search_input_placeholder")}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="collection-tag-filter">
          {t("entity:collection_tag_filter_label")}
        </Label>
        <Input
          id="collection-tag-filter"
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

      {collection.isLoading ? (
        <p className="py-12 text-center text-sm text-text-secondary">
          {t("common:loading")}
        </p>
      ) : collection.error ? (
        <p className="py-12 text-center text-sm text-text-error">
          {collection.error.message}
        </p>
      ) : units.length === 0 ? (
        <p className="py-12 text-center text-sm text-text-secondary">
          {t("entity:collection_search_empty")}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {units.map((unit) => (
            <CollectionUnitRow
              key={unit.unitId}
              unit={unit}
              showPrivateText={isCurrentUser}
            />
          ))}
          {collection.data?.hasMore && (
            <p className="py-2 text-center text-sm text-text-secondary">
              {t("entity:collection_search_has_more")}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

function CollectionUnitRow({
  unit,
  showPrivateText,
}: {
  unit: CollectionUnitDTO;
  showPrivateText: boolean;
}) {
  const { t } = useTranslation(["entity"]);
  return (
    <Link
      to="/unit/$unitId"
      params={{ unitId: unit.unitId }}
      className="flex min-w-0 flex-col gap-2 rounded-md border border-border-whisper bg-surface-base px-3 py-3 text-text-primary no-underline transition-colors hover:border-border-defined"
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-medium">
          {unit.unitId}
        </span>
        <span className="shrink-0 text-xs text-text-secondary">
          {t("entity:collection_unit_shelf_count", {
            count: unit.shelfIds.length,
          })}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-text-secondary">
        <span>
          {t("entity:collection_unit_tag_count", {
            count: unit.tagUnitIds.length,
          })}
        </span>
        {showPrivateText && unit.searchText ? (
          <span className="min-w-0 truncate">
            {t("entity:collection_search_text_label")}: {unit.searchText}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

export default CollectionTabSection;
