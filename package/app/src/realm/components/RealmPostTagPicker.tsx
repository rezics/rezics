import { realmQueries } from "@rezics/api/realm/realm";
import { tagQueries } from "@rezics/api/tag/tag";
import type { TagTreeNode } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Button, Input } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useMemo, useState } from "react";

type TagOption = {
  tagId: string;
  label: string;
};

type TagSearchResult = {
  unitId?: string;
  tagUnitId?: string;
  label?: string;
  slug?: string;
};

export interface RealmPostTagPickerProps {
  realmUnitIds: string[];
  tagIds?: string[];
  selectedTagIds: string[];
  onSelectedTagIdsChange: (tagIds: string[]) => void;
}

function getTagLabel(tagId: string, label?: string) {
  return label?.trim() || tagId.slice(0, 8);
}

function tagTreeNodeKey(node: TagTreeNode, depth: number) {
  return `${depth}:${node.tagId ?? node.label ?? "node"}`;
}

function flattenTagTree(nodes: TagTreeNode[] | undefined): TagOption[] {
  const options: TagOption[] = [];

  const visit = (items: TagTreeNode[]) => {
    for (const item of items) {
      if (item.tagId && !item.disabled) {
        options.push({
          tagId: item.tagId,
          label: getTagLabel(item.tagId, item.label),
        });
      }
      if (item.children?.length) visit(item.children);
    }
  };

  visit(nodes ?? []);
  return options;
}

export const RealmPostTagPicker: React.FC<RealmPostTagPickerProps> = ({
  realmUnitIds,
  tagIds,
  selectedTagIds,
  onSelectedTagIdsChange,
}) => {
  const { t } = useTranslation(["common", "community", "page"]);
  const [searchTerm, setSearchTerm] = useState("");
  const firstRealmId = realmUnitIds.length === 1 ? realmUnitIds[0] : undefined;
  const { data: realm } = useQuery({
    ...realmQueries.detail(firstRealmId ?? ""),
    enabled: Boolean(firstRealmId),
  });
  const tagTree = firstRealmId
    ? (realm?.extra?.tagTree as TagTreeNode[] | undefined)
    : undefined;
  const quickPicks = useMemo(() => flattenTagTree(tagTree), [tagTree]);
  const selectedSet = useMemo(() => new Set(selectedTagIds), [selectedTagIds]);

  useEffect(() => {
    onSelectedTagIdsChange(tagIds ?? []);
  }, [onSelectedTagIdsChange, tagIds]);

  const trimmedSearch = searchTerm.trim();
  const { data: searchData, isLoading: isSearching } = useQuery(
    tagQueries.search(trimmedSearch),
  );
  const searchResults = useMemo(() => {
    return ((searchData?.tags ?? []) as TagSearchResult[])
      .map((tag) => {
        const tagId = tag.unitId ?? tag.tagUnitId;
        if (!tagId || selectedSet.has(tagId)) return null;
        return {
          tagId,
          label: getTagLabel(tagId, tag.label ?? tag.slug),
        };
      })
      .filter(Boolean) as TagOption[];
  }, [searchData?.tags, selectedSet]);

  const toggleTag = (tagId: string) => {
    const next = selectedSet.has(tagId)
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId];
    onSelectedTagIdsChange(next);
  };

  const selectedLabels = new Map<string, string>();
  for (const option of quickPicks)
    selectedLabels.set(option.tagId, option.label);
  for (const option of searchResults) {
    selectedLabels.set(option.tagId, option.label);
  }

  const renderNode = (node: TagTreeNode, depth = 0): React.ReactNode => {
    const children = node.children?.map((child) => (
      <div key={tagTreeNodeKey(child, depth + 1)}>
        {renderNode(child, depth + 1)}
      </div>
    ));

    if (node.disabled && !node.tagId) {
      return (
        <div className={depth > 0 ? "pl-3" : undefined}>
          {node.label && (
            <div className="px-1 pt-2 text-xs font-medium leading-dense text-text-tertiary">
              {node.label}
            </div>
          )}
          {children}
        </div>
      );
    }

    if (node.tagId) {
      const selected = selectedSet.has(node.tagId);
      return (
        <Button
          type="button"
          size="sm"
          variant={selected ? "default" : "secondary"}
          className="h-8"
          onClick={() => toggleTag(node.tagId!)}
        >
          {getTagLabel(node.tagId, node.label)}
        </Button>
      );
    }

    return children;
  };

  return (
    <div className="flex flex-col gap-3 rounded-md bg-surface-subtle p-3">
      {selectedTagIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTagIds.map((tagId) => (
            <Button
              key={tagId}
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => toggleTag(tagId)}
            >
              {selectedLabels.get(tagId) ?? getTagLabel(tagId)}
            </Button>
          ))}
        </div>
      )}

      {tagTree && tagTree.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {tagTree.map((node) => (
            <div key={tagTreeNodeKey(node, 0)} className="contents">
              {renderNode(node)}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder={t("community:tag_search_this")}
        />
        {trimmedSearch && (
          <div className="flex flex-wrap gap-2">
            {isSearching ? (
              <span className="text-sm leading-ui text-text-secondary">
                {t("page:shelf_searching")}
              </span>
            ) : searchResults.length > 0 ? (
              searchResults.map((tag) => (
                <Button
                  key={tag.tagId}
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8"
                  onClick={() => toggleTag(tag.tagId)}
                >
                  {tag.label}
                </Button>
              ))
            ) : (
              <span className="text-sm leading-ui text-text-secondary">
                {t("community:post_tag_picker_no_matches")}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
