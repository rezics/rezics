import { useTranslation } from "@rezics/i18n/react";
import { Button, Card, CardContent, Input } from "@rezics/ui/shadcn";
import { ManageField } from "./ZoneManageFields";

/**
 * Lifecycle tab: ISO `startsAt`/`endsAt` window, unchanged semantics from
 * the interim manage page (empty = null = unbounded).
 * 生命週期标签页：ISO `startsAt`/`endsAt` 窗口，语义与过渡管理页一致
 * （空 = null = 不限）。
 */
export function ZoneManageLifecycleTab({
  startsAt,
  endsAt,
  onStartsAtChange,
  onEndsAtChange,
  onSave,
  saving,
}: {
  startsAt: string;
  endsAt: string;
  onStartsAtChange: (value: string) => void;
  onEndsAtChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const { t } = useTranslation(["zone", "common"]);
  return (
    <Card surface="contained">
      <CardContent className="flex flex-col gap-5 p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <ManageField
            label={t("zone:manage_starts_at")}
            htmlFor="zone-starts-at"
          >
            <Input
              id="zone-starts-at"
              value={startsAt}
              onChange={(event) => onStartsAtChange(event.target.value)}
              placeholder="2026-06-09T00:00:00.000Z"
            />
          </ManageField>
          <ManageField label={t("zone:manage_ends_at")} htmlFor="zone-ends-at">
            <Input
              id="zone-ends-at"
              value={endsAt}
              onChange={(event) => onEndsAtChange(event.target.value)}
              placeholder="2026-06-30T00:00:00.000Z"
            />
          </ManageField>
        </div>
        <div className="flex justify-end">
          <Button onClick={onSave} disabled={saving}>
            {t("common:save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
