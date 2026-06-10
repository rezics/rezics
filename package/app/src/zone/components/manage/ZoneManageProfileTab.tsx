import { realmDetailQuery } from "@rezics/api/realm/realm";
import { LANGUAGE_META, type Language, type ZoneDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  Card,
  CardContent,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import type { ZoneManageDraft } from "../../models/zoneManageDraft";
import {
  addZoneTranslationRow,
  removeZoneTranslationRow,
  updateZoneTranslationRow,
  type ZoneTranslationRow,
  zoneTranslationLanguageOptions,
} from "../../models/zoneManageDraft";
import type { ZoneRefUnitMap } from "../../models/zoneMenu";
import { ManageField, ManageGroupHeading } from "./ZoneManageFields";
import { ZoneRealmSearchField } from "./ZoneRealmSearchField";

/**
 * Profile tab: multilingual title/description rows over the zone's
 * `translations`, the config `context` picker (global | realm), and the
 * read-only authority facts (owner realm, slug). Context is interaction
 * defaults only — authority stays on `ownerRealmUnitId`
 * (`package/contract/src/zone/boundary-v1.ts`).
 * 资料标签页：基于专区 `translations` 的多语言标题/描述行、配置
 * `context` 选择器（global | realm），以及只读的权限事实（拥有者
 * realm、slug）。context 只承担交互默认值——权限归属仍在
 * `ownerRealmUnitId`（`package/contract/src/zone/boundary-v1.ts`）。
 */
export function ZoneManageProfileTab({
  zone,
  rows,
  onRowsChange,
  draft,
  onDraftChange,
  refUnits,
  onSave,
  saving,
}: {
  zone: ZoneDTO;
  rows: ZoneTranslationRow[];
  onRowsChange: (rows: ZoneTranslationRow[]) => void;
  draft: ZoneManageDraft;
  onDraftChange: (draft: ZoneManageDraft) => void;
  refUnits: ZoneRefUnitMap;
  onSave: () => void;
  saving: boolean;
}) {
  const { t } = useTranslation(["zone", "common"]);
  const ownerRealmQuery = useQuery(realmDetailQuery(zone.ownerRealmUnitId));
  const ownerRealmTitle =
    ownerRealmQuery.data?.title ??
    refUnits[zone.ownerRealmUnitId]?.title ??
    zone.ownerRealmUnitId;
  const contextRealmUnitId =
    draft.context.kind === "realm" ? draft.context.realmUnitId : null;
  const contextRealmTitle = contextRealmUnitId
    ? (refUnits[contextRealmUnitId]?.title ?? contextRealmUnitId)
    : null;

  return (
    <Card surface="contained">
      <CardContent className="flex flex-col gap-6 p-4">
        <div className="flex flex-col gap-4">
          {rows.map((row, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: positional rows
              key={index}
              className="grid gap-3 md:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)_auto]"
            >
              <ManageField label={t("common:language")}>
                <Select
                  value={row.language}
                  onValueChange={(language) =>
                    onRowsChange(
                      updateZoneTranslationRow(rows, index, {
                        language: language as Language,
                      }),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {zoneTranslationLanguageOptions(rows, row.language).map(
                      (language) => (
                        <SelectItem key={language} value={language}>
                          {LANGUAGE_META[language].nativeName}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </ManageField>
              <ManageField label={t("common:title")}>
                <Input
                  value={row.title}
                  onChange={(event) =>
                    onRowsChange(
                      updateZoneTranslationRow(rows, index, {
                        title: event.target.value,
                      }),
                    )
                  }
                />
              </ManageField>
              <ManageField label={t("common:description")}>
                <Input
                  value={row.description}
                  onChange={(event) =>
                    onRowsChange(
                      updateZoneTranslationRow(rows, index, {
                        description: event.target.value,
                      }),
                    )
                  }
                />
              </ManageField>
              <div className="flex items-end">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={t("common:remove")}
                  disabled={rows.length <= 1}
                  onClick={() =>
                    onRowsChange(removeZoneTranslationRow(rows, index))
                  }
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
          ))}
          <div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={zoneTranslationLanguageOptions(rows).length === 0}
              onClick={() => onRowsChange(addZoneTranslationRow(rows))}
            >
              <Plus className="mr-1 size-4" aria-hidden />
              {t("common:add")}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <ManageGroupHeading>{t("zone:manage_context")}</ManageGroupHeading>
          <Select
            value={draft.context.kind}
            onValueChange={(kind) => {
              if (kind === "global") {
                onDraftChange({ ...draft, context: { kind: "global" } });
              } else {
                onDraftChange({
                  ...draft,
                  context: {
                    kind: "realm",
                    realmUnitId: contextRealmUnitId ?? zone.ownerRealmUnitId,
                  },
                });
              }
            }}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global">
                {t("zone:manage_context_global")}
              </SelectItem>
              <SelectItem value="realm">
                {t("zone:manage_context_realm")}
              </SelectItem>
            </SelectContent>
          </Select>
          {draft.context.kind === "realm" ? (
            <div className="flex flex-col gap-2 pl-4">
              <p className="text-sm leading-body text-text-secondary">
                {contextRealmTitle}
              </p>
              <ZoneRealmSearchField
                onPick={(realm) =>
                  onDraftChange({
                    ...draft,
                    context: { kind: "realm", realmUnitId: realm.unitId },
                  })
                }
              />
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <ManageField label={t("zone:manage_owner_realm")}>
            <p className="text-sm leading-body text-text-secondary">
              {ownerRealmTitle}
            </p>
          </ManageField>
          <ManageField label={t("common:slug")}>
            <p className="font-mono text-sm leading-body text-text-secondary">
              {zone.slug}
            </p>
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
