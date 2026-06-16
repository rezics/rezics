import { labelSearchQueryOptions, useCreateLabel } from "@rezics/api";
import { LANGUAGE_META, type LabelDTO, type Language } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Plus, Tag, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useDebouncedValue } from "@/entity-picker";
import {
  addZoneTranslationRow,
  removeZoneTranslationRow,
  updateZoneTranslationRow,
  type ZoneTranslationRow,
  zoneTranslationLanguageOptions,
} from "../../models/zoneManageDraft";
import type { ZoneRefUnitMap } from "../../models/zoneMenu";
import { ManageField } from "./ZoneManageFields";

function labelTitle(label: LabelDTO, language: string): string {
  const exact = label.translations.find(
    (translation) => translation.language === language && translation.title,
  );
  if (exact?.title) return exact.title;
  const first = label.translations.find((translation) => translation.title);
  return first?.title ?? label.unitId;
}

/**
 * LABEL unit picker used by every `titleLabelUnitId` / `labelUnitId` field:
 * search existing LABEL units, or quick-create one with multilingual name
 * rows. Newly picked titles are cached locally because they are not part of
 * the portal `refUnits` map until the next save round-trip.
 * 所有 `titleLabelUnitId` / `labelUnitId` 字段共用的 LABEL Unit 选择器：
 * 搜索既有 LABEL Unit，或用多语言名称行快速创建。新选中的标题在本地
 * 缓存，因为在下一次保存往返之前它们不在门户的 `refUnits` 映射中。
 */
export function ZoneLabelField({
  label,
  value,
  onChange,
  refUnits,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  refUnits: ZoneRefUnitMap;
}) {
  const { t, i18n } = useTranslation(["zone", "common"]);
  const [open, setOpen] = useState(false);
  const [pickedTitles, setPickedTitles] = useState<Record<string, string>>({});

  const display = value
    ? (pickedTitles[value] ?? refUnits[value]?.title ?? value)
    : null;

  const pick = (unitId: string, title: string) => {
    setPickedTitles((current) => ({ ...current, [unitId]: title }));
    onChange(unitId);
    setOpen(false);
  };

  return (
    <ManageField label={label}>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="max-w-64 justify-start"
        >
          <Tag
            className="mr-1 size-4 shrink-0 text-text-tertiary"
            aria-hidden
          />
          <span className="truncate">
            {display ?? t("zone:manage_label_pick")}
          </span>
        </Button>
        {value ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={t("common:clear")}
            onClick={() => onChange(undefined)}
          >
            <X className="size-4" aria-hidden />
          </Button>
        ) : null}
      </div>
      <ZoneLabelPickerDialog
        open={open}
        onOpenChange={setOpen}
        onPick={pick}
        language={i18n.language}
      />
    </ManageField>
  );
}

function ZoneLabelPickerDialog({
  open,
  onOpenChange,
  onPick,
  language,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (unitId: string, title: string) => void;
  language: string;
}) {
  const { t } = useTranslation(["zone", "common"]);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const debouncedQuery = useDebouncedValue(query.trim(), 200);
  const searchQuery = useQuery(labelSearchQueryOptions(debouncedQuery, 12));
  const results = searchQuery.data ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setQuery("");
          setCreating(false);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border-whisper p-4">
          <DialogTitle>{t("zone:manage_label_pick")}</DialogTitle>
        </DialogHeader>
        <div className="p-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("zone:manage_label_search")}
            autoFocus
          />
        </div>
        <div className="max-h-56 overflow-y-auto px-3 pb-2">
          {searchQuery.isFetching && debouncedQuery ? (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          ) : null}
          {results.map((result) => (
            <button
              key={result.unitId}
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm leading-ui text-text-primary hover:bg-surface-subtle"
              onClick={() =>
                onPick(result.unitId, labelTitle(result, language))
              }
            >
              <span className="truncate">{labelTitle(result, language)}</span>
              <span className="shrink-0 font-mono text-xs text-text-tertiary">
                {result.unitId.slice(0, 8)}
              </span>
            </button>
          ))}
        </div>
        <div className="border-t border-border-whisper p-3">
          {creating ? (
            <ZoneLabelCreateForm
              initialTitle={query.trim()}
              language={language}
              onCreated={onPick}
              onCancel={() => setCreating(false)}
            />
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start"
              onClick={() => setCreating(true)}
            >
              <Plus className="mr-2 size-4" aria-hidden />
              {t("zone:manage_label_create")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ZoneLabelCreateForm({
  initialTitle,
  language,
  onCreated,
  onCancel,
}: {
  initialTitle: string;
  language: string;
  onCreated: (unitId: string, title: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation(["zone", "common"]);
  const [rows, setRows] = useState<ZoneTranslationRow[]>([
    {
      language: (["zh-hant", "zh-hans", "en", "ja", "de", "ko"].includes(
        language,
      )
        ? language
        : "en") as Language,
      title: initialTitle,
      description: "",
    },
  ]);
  const createLabel = useCreateLabel({
    onError: (error) => toast.error(error.message),
  });

  const submit = () => {
    const translations = rows
      .filter((row) => row.title.trim())
      .map((row) => ({ language: row.language, title: row.title.trim() }));
    if (translations.length === 0) return;
    createLabel.mutate(
      { translations },
      {
        onSuccess: (created) => {
          onCreated(created.unitId, translations[0]?.title ?? created.unitId);
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: positional rows
          key={index}
          className="flex items-center gap-2"
        >
          <Select
            value={row.language}
            onValueChange={(next) =>
              setRows((current) =>
                updateZoneTranslationRow(current, index, {
                  language: next as Language,
                }),
              )
            }
          >
            <SelectTrigger className="w-28 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {zoneTranslationLanguageOptions(rows, row.language).map(
                (option) => (
                  <SelectItem key={option} value={option}>
                    {LANGUAGE_META[option].nativeName}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
          <Input
            value={row.title}
            placeholder={t("common:title")}
            onChange={(event) =>
              setRows((current) =>
                updateZoneTranslationRow(current, index, {
                  title: event.target.value,
                }),
              )
            }
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={t("common:remove")}
            disabled={rows.length <= 1}
            onClick={() =>
              setRows((current) => removeZoneTranslationRow(current, index))
            }
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={zoneTranslationLanguageOptions(rows).length === 0}
          onClick={() => setRows((current) => addZoneTranslationRow(current))}
        >
          <Plus className="mr-1 size-4" aria-hidden />
          {t("common:add")}
        </Button>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            {t("common:cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={submit}
            disabled={createLabel.isPending}
          >
            {t("common:create")}
          </Button>
        </div>
      </div>
    </div>
  );
}
