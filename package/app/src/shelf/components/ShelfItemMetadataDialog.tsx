import {
  tagBatchTranslationsQuery,
  tagSearchQuery,
  usePatchUserShelfItemMutation,
  userTagApplicationsForUnitQuery,
  userShelfItemForUnitQuery,
  useSetUserTagApplicationsMutation,
} from "@rezics/api";
import { useLocale, useTranslation } from "@rezics/i18n/react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Plus, Tags, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface ShelfItemMetadataDialogProps {
  unitId: string;
}

type SearchTagOption = {
  unitId: string;
  label?: string | null;
  slug?: string | null;
};

function tagOptionLabel(option: SearchTagOption): string {
  return option.label ?? option.slug ?? option.unitId;
}

function ShelfItemMetadataDialogContent({
  unitId,
  onClose,
}: ShelfItemMetadataDialogProps & { onClose: () => void }) {
  const locale = useLocale();
  const { t } = useTranslation(["common", "community", "entity"]);
  const [tagSearchText, setTagSearchText] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");

  const applicationsQuery = useQuery(userTagApplicationsForUnitQuery(unitId));
  const shelfItemQuery = useQuery(userShelfItemForUnitQuery(unitId));
  const tagSearchQueryResult = useQuery(tagSearchQuery(tagSearchText.trim()));
  const tagTranslationsQuery = useQuery(
    tagBatchTranslationsQuery(selectedTagIds, locale),
  );
  const setTagsMutation = useSetUserTagApplicationsMutation();
  const patchShelfItemMutation = usePatchUserShelfItemMutation();

  useEffect(() => {
    if (!applicationsQuery.data) return;
    setSelectedTagIds(applicationsQuery.data.map((row) => row.tagUnitId));
  }, [applicationsQuery.data]);

  useEffect(() => {
    setSearchText(shelfItemQuery.data?.searchText ?? "");
  }, [shelfItemQuery.data]);

  const selectedTags = useMemo(() => new Set(selectedTagIds), [selectedTagIds]);
  const tagLabels = tagTranslationsQuery.data ?? {};
  const searchOptions = (
    (tagSearchQueryResult.data?.tags ?? []) as SearchTagOption[]
  ).filter((tag) => !selectedTags.has(tag.unitId));
  const isSaving =
    setTagsMutation.isPending || patchShelfItemMutation.isPending;
  const loadError = applicationsQuery.error ?? shelfItemQuery.error;
  const saveError = setTagsMutation.error ?? patchShelfItemMutation.error;

  function addTag(tagUnitId: string) {
    setSelectedTagIds((current) =>
      current.includes(tagUnitId) ? current : [...current, tagUnitId],
    );
    setTagSearchText("");
  }

  function removeTag(tagUnitId: string) {
    setSelectedTagIds((current) => current.filter((id) => id !== tagUnitId));
  }

  async function handleSave() {
    const normalizedSearchText = searchText.trim();
    try {
      await Promise.all([
        setTagsMutation.mutateAsync({ unitId, tagUnitIds: selectedTagIds }),
        patchShelfItemMutation.mutateAsync({
          unitId,
          searchText: normalizedSearchText || null,
        }),
      ]);
      onClose();
    } catch {
      // Mutation hooks expose the error in the dialog.
      // mutation hooks 会在对话框中暴露该错误。
    }
  }

  return (
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{t("entity:shelf_item_metadata_title")}</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`shelf-item-tags-${unitId}`}>
            {t("entity:shelf_item_user_tags_label")}
          </Label>
          <Input
            id={`shelf-item-tags-${unitId}`}
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
          {tagSearchText.trim() && (
            <div className="max-h-40 overflow-auto rounded-md border border-border-whisper">
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
              ) : (
                <div className="px-3 py-2 text-sm text-text-secondary">
                  {t("community:post_tag_picker_no_matches")}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`shelf-item-search-text-${unitId}`}>
            {t("entity:shelf_item_private_text_label")}
          </Label>
          <Textarea
            id={`shelf-item-search-text-${unitId}`}
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder={t("entity:shelf_item_private_text_placeholder")}
            rows={3}
          />
          <p className="text-sm text-text-secondary">
            {t("entity:shelf_item_private_text_hint")}
          </p>
        </div>

        {(loadError || saveError) && (
          <p className="text-sm text-text-error">
            {(loadError ?? saveError)?.message}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          {t("common:cancel")}
        </Button>
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving || applicationsQuery.isLoading}
        >
          {isSaving ? t("common:loading") : t("common:save")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function ShelfItemMetadataDialog({
  unitId,
}: ShelfItemMetadataDialogProps) {
  const { t } = useTranslation(["entity"]);
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={t("entity:shelf_item_metadata_action")}
        onClick={() => setOpen(true)}
      >
        <Tags className="h-4 w-4" />
      </Button>
      {open && (
        <ShelfItemMetadataDialogContent
          unitId={unitId}
          onClose={() => setOpen(false)}
        />
      )}
    </Dialog>
  );
}
