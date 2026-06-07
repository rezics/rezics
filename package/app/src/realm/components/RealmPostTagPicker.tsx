import { realmQueries } from "@rezics/api/realm/realm";
import { tagQueries } from "@rezics/api/tag/tag";
import type { TagTreeNode } from "@rezics/contract";
import { useLocale, useTranslation } from "@rezics/i18n/react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronRight, Plus, X } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import {
  buildRealmTagTreePickerRows,
  flattenRealmTagTreePickerRows,
  type RealmTagTreePickerRow,
  searchRealmTagTreePickerRows,
  selectedRealmTagLabels,
} from "../models/realmTagTreePicker";

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

function toggleTagId(tagIds: string[], tagId: string) {
  return tagIds.includes(tagId)
    ? tagIds.filter((id) => id !== tagId)
    : [...tagIds, tagId];
}

function buildParentLookup(rows: RealmTagTreePickerRow[]) {
  const parents = new Map<string, string | null>();
  const visit = (items: RealmTagTreePickerRow[], parentId: string | null) => {
    for (const item of items) {
      parents.set(item.id, parentId);
      visit(item.children, item.id);
    }
  };
  visit(rows, null);
  return parents;
}

function TagTreeRow({
  row,
  selected,
  onToggle,
  onEnter,
}: {
  row: RealmTagTreePickerRow;
  selected: boolean;
  onToggle: (tagId: string) => void;
  onEnter: (row: RealmTagTreePickerRow) => void;
}) {
  const hasChildren = row.children.length > 0;
  const handleRowClick = () => {
    if (row.selectable && row.tagId) {
      onToggle(row.tagId);
      return;
    }
    if (hasChildren) onEnter(row);
  };

  return (
    <div className="flex min-w-0 items-stretch border-b border-border-whisper last:border-b-0">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-3 text-left outline-none transition-colors hover:bg-surface-subtle focus-visible:bg-surface-subtle"
        onClick={handleRowClick}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-text-brand">
          {selected ? <Check className="h-4 w-4" aria-hidden /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium leading-ui text-text-primary">
            {row.label}
          </span>
          {row.description || row.pathLabel ? (
            <span className="block truncate text-xs leading-dense text-text-secondary">
              {row.description ?? row.pathLabel}
            </span>
          ) : null}
        </span>
      </button>
      {hasChildren ? (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="my-auto shrink-0"
          aria-label={`Open ${row.label}`}
          onClick={() => onEnter(row)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}

export const RealmPostTagPicker: React.FC<RealmPostTagPickerProps> = ({
  realmUnitIds,
  tagIds,
  selectedTagIds,
  onSelectedTagIdsChange,
}) => {
  const { t } = useTranslation(["common", "community", "page"]);
  const locale = useLocale();
  const readContext = useReadLanguageContext();
  const firstRealmId = realmUnitIds.length === 1 ? realmUnitIds[0] : undefined;
  const [open, setOpen] = useState(false);
  const [draftSelectedTagIds, setDraftSelectedTagIds] = useState<string[]>([]);
  const [activeParentId, setActiveParentId] = useState<string | null>(null);
  const [realmSearchTerm, setRealmSearchTerm] = useState("");
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [globalLabels, setGlobalLabels] = useState<Map<string, string>>(
    () => new Map(),
  );
  const { data: realm } = useQuery({
    ...realmQueries.detail(firstRealmId ?? "", {
      languages: readContext.languages,
    }),
    enabled: readContext.ready && Boolean(firstRealmId),
  });
  const tagTree = firstRealmId
    ? (realm?.extra?.tagTree as TagTreeNode[] | undefined)
    : undefined;
  const treeRows = useMemo(
    () => buildRealmTagTreePickerRows(tagTree, locale),
    [locale, tagTree],
  );
  const flatTreeRows = useMemo(
    () => flattenRealmTagTreePickerRows(treeRows),
    [treeRows],
  );
  const rowById = useMemo(
    () => new Map(flatTreeRows.map((row) => [row.id, row])),
    [flatTreeRows],
  );
  const parentById = useMemo(() => buildParentLookup(treeRows), [treeRows]);
  const activeParent = activeParentId ? rowById.get(activeParentId) : undefined;
  const currentRows = activeParent?.children ?? treeRows;
  const draftSelectedSet = useMemo(
    () => new Set(draftSelectedTagIds),
    [draftSelectedTagIds],
  );

  useEffect(() => {
    onSelectedTagIdsChange(tagIds ?? []);
  }, [onSelectedTagIdsChange, tagIds]);

  useEffect(() => {
    if (!open) return;
    setDraftSelectedTagIds(selectedTagIds);
    setActiveParentId(null);
    setRealmSearchTerm("");
    setGlobalSearchTerm("");
  }, [open, selectedTagIds]);

  const trimmedGlobalSearch = globalSearchTerm.trim();
  const { data: searchData, isLoading: isSearching } = useQuery(
    tagQueries.search(trimmedGlobalSearch),
  );
  const searchResults = useMemo(() => {
    const treeTagIds = new Set(
      flatTreeRows.map((row) => row.tagId).filter(Boolean) as string[],
    );
    return ((searchData?.tags ?? []) as TagSearchResult[])
      .map((tag) => {
        const tagId = tag.unitId ?? tag.tagUnitId;
        if (!tagId || treeTagIds.has(tagId)) return null;
        return {
          tagId,
          label: getTagLabel(tagId, tag.label ?? tag.slug),
        };
      })
      .filter(Boolean) as TagOption[];
  }, [flatTreeRows, searchData?.tags]);

  const selectedLabels = useMemo(() => {
    const labels = selectedRealmTagLabels(
      treeRows,
      selectedTagIds,
      getTagLabel,
    );
    for (const [tagId, label] of globalLabels) labels.set(tagId, label);
    for (const option of searchResults) labels.set(option.tagId, option.label);
    return labels;
  }, [globalLabels, searchResults, selectedTagIds, treeRows]);

  const realmMatches = useMemo(
    () => searchRealmTagTreePickerRows(treeRows, realmSearchTerm),
    [realmSearchTerm, treeRows],
  );

  const toggleDraftTag = (tagId: string) => {
    setDraftSelectedTagIds((current) => toggleTagId(current, tagId));
  };

  const toggleGlobalTag = (tag: TagOption) => {
    setGlobalLabels((current) => new Map(current).set(tag.tagId, tag.label));
    toggleDraftTag(tag.tagId);
  };

  const removeSelectedTag = (tagId: string) => {
    onSelectedTagIdsChange(selectedTagIds.filter((id) => id !== tagId));
  };

  const handleBack = () => {
    if (!activeParentId) return;
    setActiveParentId(parentById.get(activeParentId) ?? null);
  };

  const handleApply = () => {
    onSelectedTagIdsChange(draftSelectedTagIds);
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-3 rounded-md bg-surface-subtle p-3">
      {selectedTagIds.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedTagIds.map((tagId) => (
            <Button
              key={tagId}
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => removeSelectedTag(tagId)}
            >
              {selectedLabels.get(tagId) ?? getTagLabel(tagId)}
              <X className="h-3 w-3" aria-hidden />
            </Button>
          ))}
        </div>
      ) : null}

      <Button
        type="button"
        variant="secondary"
        className="self-start"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4" />
        {t("community:tag_picker_attach")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("community:tag_picker_dialog_title")}</DialogTitle>
          </DialogHeader>

          <div className="flex min-h-0 flex-col gap-5 overflow-y-auto pr-1">
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="m-0 text-sm font-medium leading-ui text-text-primary">
                  {t("community:tag_picker_realm_tags")}
                </h3>
                {activeParent ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleBack}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {activeParent.path.at(-1)}
                  </Button>
                ) : null}
              </div>
              <Input
                value={realmSearchTerm}
                onChange={(event) => setRealmSearchTerm(event.target.value)}
                placeholder={t("community:tag_picker_realm_search")}
              />
              <div className="max-h-72 overflow-y-auto border-y border-border-whisper">
                {realmSearchTerm.trim() ? (
                  realmMatches.length > 0 ? (
                    realmMatches.map((row) => (
                      <TagTreeRow
                        key={row.id}
                        row={{ ...row, children: [] }}
                        selected={Boolean(
                          row.tagId && draftSelectedSet.has(row.tagId),
                        )}
                        onToggle={toggleDraftTag}
                        onEnter={() => undefined}
                      />
                    ))
                  ) : (
                    <p className="m-0 py-4 text-sm leading-ui text-text-secondary">
                      {t("community:tag_picker_no_realm_matches")}
                    </p>
                  )
                ) : currentRows.length > 0 ? (
                  currentRows.map((row) => (
                    <TagTreeRow
                      key={row.id}
                      row={row}
                      selected={Boolean(
                        row.tagId && draftSelectedSet.has(row.tagId),
                      )}
                      onToggle={toggleDraftTag}
                      onEnter={(next) => setActiveParentId(next.id)}
                    />
                  ))
                ) : (
                  <p className="m-0 py-4 text-sm leading-ui text-text-secondary">
                    {t("community:tag_picker_empty_realm")}
                  </p>
                )}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="m-0 text-sm font-medium leading-ui text-text-primary">
                {t("community:tag_picker_other_tags")}
              </h3>
              <Input
                value={globalSearchTerm}
                onChange={(event) => setGlobalSearchTerm(event.target.value)}
                placeholder={t("community:tag_search_placeholder")}
              />
              {trimmedGlobalSearch ? (
                <div className="flex flex-col border-y border-border-whisper">
                  {isSearching ? (
                    <p className="m-0 py-4 text-sm leading-ui text-text-secondary">
                      {t("page:shelf_searching")}
                    </p>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((tag) => (
                      <button
                        key={tag.tagId}
                        type="button"
                        className="flex min-w-0 items-center gap-3 border-b border-border-whisper py-3 text-left outline-none transition-colors last:border-b-0 hover:bg-surface-subtle focus-visible:bg-surface-subtle"
                        onClick={() => toggleGlobalTag(tag)}
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-text-brand">
                          {draftSelectedSet.has(tag.tagId) ? (
                            <Check className="h-4 w-4" aria-hidden />
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium leading-ui text-text-primary">
                          {tag.label}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="m-0 py-4 text-sm leading-ui text-text-secondary">
                      {t("community:post_tag_picker_no_matches")}
                    </p>
                  )}
                </div>
              ) : null}
            </section>

            {draftSelectedTagIds.length > 0 ? (
              <div className="flex flex-wrap gap-2 border-t border-border-whisper pt-3">
                {draftSelectedTagIds.map((tagId) => (
                  <Button
                    key={tagId}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => toggleDraftTag(tagId)}
                  >
                    {selectedLabels.get(tagId) ?? getTagLabel(tagId)}
                    <X className="h-3 w-3" aria-hidden />
                  </Button>
                ))}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {t("common:cancel")}
            </Button>
            <Button type="button" onClick={handleApply}>
              {t("common:apply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
