import type { ZoneLinkTarget, ZonePageId } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import type { ZoneRefUnitMap } from "../../models/zoneMenu";
import { ManageField } from "./ZoneManageFields";
import { ZoneUnitSearchField } from "./ZoneUnitSearchField";

const NONE = "__none__";

type TargetKind = ZoneLinkTarget["kind"] | typeof NONE;

export type ZoneLinkTargetPageOption = {
  id: ZonePageId;
  slug: string;
};

function defaultTarget(
  kind: ZoneLinkTarget["kind"],
  defaultZonePageId: ZonePageId,
): ZoneLinkTarget {
  switch (kind) {
    case "unit":
      return { kind: "unit", unitId: "" };
    case "zonePage":
      return { kind: "zonePage", pageId: defaultZonePageId };
    case "external":
      // `external.text` is the single documented inline-text exception in
      // the zone config (`package/contract/src/zone/link-target.ts`).
      // `external.text` 是专区配置中唯一记录在案的内联文本例外
      // （`package/contract/src/zone/link-target.ts`）。
      return { kind: "external", url: "", text: "" };
  }
}

/**
 * Shared `ZoneLinkTarget` editor for menu nodes, collection items, and hero
 * CTAs: none (menu groups only) | unit by id/search | zone page | external.
 * 菜单节点、集合条目与 hero CTA 共享的 `ZoneLinkTarget` 编辑器：
 * 无（仅菜单分组）| 按 id/搜索的 Unit | 专区页面 | 外部链接。
 */
export function ZoneLinkTargetField({
  value,
  onChange,
  refUnits,
  zonePages = [],
  defaultPageId,
  allowNone = false,
}: {
  value: ZoneLinkTarget | undefined;
  onChange: (value: ZoneLinkTarget | undefined) => void;
  refUnits: ZoneRefUnitMap;
  zonePages?: readonly ZoneLinkTargetPageOption[];
  defaultPageId?: ZonePageId | null;
  allowNone?: boolean;
}) {
  const { t } = useTranslation(["zone", "common"]);
  const kind: TargetKind = value?.kind ?? NONE;
  const defaultZonePageId = defaultPageId ?? zonePages[0]?.id ?? "home";
  const zonePageOptions =
    value?.kind === "zonePage" &&
    !zonePages.some((page) => page.id === value.pageId)
      ? [{ id: value.pageId, slug: value.pageId }, ...zonePages]
      : zonePages;

  return (
    <div className="flex flex-col gap-3">
      <ManageField label={t("zone:manage_node_target")}>
        <Select
          value={kind}
          onValueChange={(next) => {
            if (next === NONE) onChange(undefined);
            else {
              onChange(
                defaultTarget(
                  next as ZoneLinkTarget["kind"],
                  defaultZonePageId,
                ),
              );
            }
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allowNone ? (
              <SelectItem value={NONE}>
                {t("zone:manage_target_none")}
              </SelectItem>
            ) : null}
            <SelectItem value="unit">{t("zone:manage_target_unit")}</SelectItem>
            <SelectItem value="zonePage">
              {t("zone:manage_target_page")}
            </SelectItem>
            <SelectItem value="external">
              {t("zone:manage_target_external")}
            </SelectItem>
          </SelectContent>
        </Select>
      </ManageField>

      {value?.kind === "unit" ? (
        <ZoneUnitSearchField
          label={t("common:unit_id")}
          value={value.unitId}
          onChange={(unitId) => onChange({ kind: "unit", unitId })}
          refUnits={refUnits}
        />
      ) : null}

      {value?.kind === "zonePage" ? (
        <ManageField label={t("zone:manage_target_page")}>
          <Select
            value={value.pageId}
            onValueChange={(pageId) =>
              onChange({ kind: "zonePage", pageId: pageId as ZonePageId })
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {zonePageOptions.map((page) => (
                <SelectItem key={page.id} value={page.id}>
                  {page.slug === "home"
                    ? t("zone:manage_home_page")
                    : page.slug}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ManageField>
      ) : null}

      {value?.kind === "external" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <ManageField label={t("zone:manage_target_url")}>
            <Input
              value={value.url}
              placeholder={t("common:url_placeholder")}
              onChange={(event) =>
                onChange({ ...value, url: event.target.value })
              }
            />
          </ManageField>
          <ManageField label={t("zone:manage_target_text")}>
            <Input
              value={value.text}
              onChange={(event) =>
                onChange({ ...value, text: event.target.value })
              }
            />
          </ManageField>
        </div>
      ) : null}
    </div>
  );
}
