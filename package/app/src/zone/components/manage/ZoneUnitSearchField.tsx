import { contentSearchQueryOptions } from "@rezics/api/meili/meili.queries";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useState } from "react";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { PickerRow } from "@/shared/ui/PickerRow";
import type { ZoneRefUnitMap } from "../../models/zoneMenu";
import { ManageField } from "./ZoneManageFields";

/**
 * Unit id field with a Meilisearch-backed picker (the public `content`
 * index). The raw id input stays primary so ids outside the search surface
 * (private or freshly created units) remain addressable.
 * 带 Meilisearch 选择器（公开 `content` 索引）的 unit id 字段。原始 id
 * 输入保持为主入口，使搜索面之外的 id（私有或新建 Unit）仍可填写。
 */
export function ZoneUnitSearchField({
  label,
  value,
  onChange,
  refUnits,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  refUnits: ZoneRefUnitMap;
}) {
  const { t } = useTranslation(["zone", "common"]);
  const [open, setOpen] = useState(false);
  const preview = value ? refUnits[value]?.title : null;

  return (
    <ManageField label={label} hint={preview ?? undefined}>
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t("common:unit_id")}
          className="font-mono text-sm"
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label={t("zone:manage_unit_pick")}
          onClick={() => setOpen(true)}
        >
          <Search className="size-4" aria-hidden />
        </Button>
      </div>
      <ZoneUnitPickerDialog
        open={open}
        onOpenChange={setOpen}
        onPick={(unitId) => {
          onChange(unitId);
          setOpen(false);
        }}
      />
    </ManageField>
  );
}

function ZoneUnitPickerDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (unitId: string, title: string | null) => void;
}) {
  const { t } = useTranslation(["zone"]);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), 200);
  const searchQuery = useQuery({
    ...contentSearchQueryOptions({ keyword: debouncedQuery, limit: 12 }),
    enabled: open && debouncedQuery.length > 0,
  });
  const results = searchQuery.data?.items ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border-whisper p-4">
          <DialogTitle>{t("zone:manage_unit_pick")}</DialogTitle>
        </DialogHeader>
        <div className="p-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("zone:manage_unit_search")}
            autoFocus
          />
        </div>
        <div className="max-h-64 overflow-y-auto px-3 pb-3">
          {searchQuery.isFetching ? (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          ) : null}
          {results.map((result) => (
            <PickerRow
              key={result.id}
              label={result.titles[0] ?? result.id}
              meta={result.type}
              onClick={() => onPick(result.id, result.titles[0] ?? null)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
