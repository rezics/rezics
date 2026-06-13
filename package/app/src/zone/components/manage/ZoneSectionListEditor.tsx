import type {
  ZoneCollectionItem,
  ZoneColumn,
  ZoneColumnsSection,
  ZoneContentSection,
  ZonePageSection,
  ZoneSectionDisplay,
  ZoneStatsMetric,
  ZoneTabsSection,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  Card,
  CardContent,
  Checkbox,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import { Plus } from "lucide-react";
import { useId, useRef, useState } from "react";
import {
  canInsertZoneSectionKind,
  createZoneSection,
  moveListItem,
  nextZoneId,
  type ZoneSectionSlot,
  zoneSectionSlotAllowedKinds,
} from "../../models/zoneManageDraft";
import type { ZoneRefUnitMap } from "../../models/zoneMenu";
import { ZoneFragmentField } from "./ZoneFragmentField";
import { ZoneLabelField } from "./ZoneLabelField";
import { ZoneLinkTargetField } from "./ZoneLinkTargetField";
import {
  CheckGroup,
  ManageField,
  ManageGroupHeading,
  RowActions,
} from "./ZoneManageFields";
import { ZoneQueryEditor } from "./ZoneQueryEditor";

const KIND_KEYS = {
  hero: "zone:manage_kind_hero",
  richText: "zone:manage_kind_richText",
  collection: "zone:manage_kind_collection",
  query: "zone:manage_kind_query",
  feed: "zone:manage_kind_feed",
  stats: "zone:manage_kind_stats",
  sources: "zone:manage_kind_sources",
  tabs: "zone:manage_kind_tabs",
  columns: "zone:manage_kind_columns",
} as const satisfies Record<ZonePageSection["kind"], `zone:${string}`>;

const DISPLAY_KEYS = {
  tiles: "zone:manage_display_tiles",
  grid: "zone:manage_display_grid",
  list: "zone:manage_display_list",
  carousel: "zone:manage_display_carousel",
  covers: "zone:manage_display_covers",
  featured: "zone:manage_display_featured",
  "avatar-wall": "zone:manage_display_avatar_wall",
} as const satisfies Record<ZoneSectionDisplay, `zone:${string}`>;

const DISPLAY_OPTIONS = Object.keys(DISPLAY_KEYS) as ZoneSectionDisplay[];

const FEED_KIND_KEYS = {
  all: "zone:manage_feed_all",
  updates: "zone:manage_feed_updates",
  reviews: "zone:manage_feed_reviews",
} as const;

const STATS_METRIC_KEYS = {
  articles: "zone:stats_articles",
  members: "zone:stats_members",
} as const satisfies Record<ZoneStatsMetric, `zone:${string}`>;

const NONE = "__none__";
const ZONE_COLUMNS_MIN = 2;
const ZONE_COLUMNS_MAX = 4;

export type ZoneManageEditorContext = {
  refUnits: ZoneRefUnitMap;
  /**
   * Every section id in the whole draft (all pages, nested included) so
   * added sections get globally unique ids.
   * 整个草稿中的所有分区 id（所有页面，含嵌套），使新增分区获得全局唯一
   * id。
   */
  allSectionIds: string[];
  contextRealmUnitId: string | null;
  contextRealmSlug: string | null;
};

/**
 * Section list editor for one slot (page top level, a tabs pane, or a
 * columns pane). The add-kind select is constrained per slot, which is what
 * makes the contract's nesting rules unrepresentable in the UI: no
 * containers inside tabs panes, no columns inside columns.
 * 单个插槽（页面顶层、tabs 面板或 columns 面板）的分区列表编辑器。
 * 新增 kind 选择按插槽收窄，使契约的嵌套规则在 UI 中不可表达：tabs
 * 面板内无容器，columns 内无 columns。
 */
export function ZoneSectionListEditor({
  sections,
  onChange,
  slot,
  ctx,
}: {
  sections: readonly ZonePageSection[];
  onChange: (sections: ZonePageSection[]) => void;
  slot: ZoneSectionSlot;
  ctx: ZoneManageEditorContext;
}) {
  const { t } = useTranslation(["zone"]);
  const allowedKinds = zoneSectionSlotAllowedKinds(slot);
  const [addKind, setAddKind] = useState<ZonePageSection["kind"]>(
    allowedKinds[0] as ZonePageSection["kind"],
  );

  const add = () => {
    // Defense in depth on top of the constrained select.
    // 在收窄的选择器之上的纵深防御。
    if (!canInsertZoneSectionKind(slot, addKind)) return;
    const id = nextZoneId(addKind, ctx.allSectionIds);
    onChange([...sections, createZoneSection(addKind, id)]);
  };

  return (
    <div className="flex flex-col gap-3">
      {sections.map((section, index) => (
        <ZoneSectionEditor
          key={section.id}
          section={section}
          slot={slot}
          ctx={ctx}
          onChange={(next) =>
            onChange(
              sections.map((current, currentIndex) =>
                currentIndex === index ? next : current,
              ),
            )
          }
          onRemove={() =>
            onChange(
              sections.filter((_, currentIndex) => currentIndex !== index),
            )
          }
          onMoveUp={
            index > 0
              ? () => onChange(moveListItem(sections, index, "up"))
              : undefined
          }
          onMoveDown={
            index < sections.length - 1
              ? () => onChange(moveListItem(sections, index, "down"))
              : undefined
          }
        />
      ))}
      <div className="flex items-center gap-2">
        <Select
          value={addKind}
          onValueChange={(kind) => setAddKind(kind as ZonePageSection["kind"])}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allowedKinds.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {t(KIND_KEYS[kind])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="mr-1 size-4" aria-hidden />
          {t("zone:manage_add_section")}
        </Button>
      </div>
    </div>
  );
}

function ZoneSectionEditor({
  section,
  slot,
  ctx,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  section: ZonePageSection;
  slot: ZoneSectionSlot;
  ctx: ZoneManageEditorContext;
  onChange: (section: ZonePageSection) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const { t } = useTranslation(["zone", "common"]);
  const [expanded, setExpanded] = useState(false);

  return (
    <Card surface="contained">
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="flex min-w-0 items-center gap-2 text-left"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
          >
            <span className="shrink-0 rounded-sm bg-surface-subtle px-2 py-0.5 text-xs font-medium leading-dense text-text-secondary">
              {t(KIND_KEYS[section.kind])}
            </span>
            <span className="truncate font-mono text-xs leading-dense text-text-tertiary">
              {section.id}
            </span>
          </button>
          <RowActions
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onRemove={onRemove}
          />
        </div>

        {expanded ? (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-3">
              <ManageField label={t("zone:manage_section_id")}>
                <Input
                  value={section.id}
                  onChange={(event) =>
                    onChange({ ...section, id: event.target.value })
                  }
                  className="font-mono text-sm"
                />
              </ManageField>
              <ManageField label={t("zone:manage_limit")}>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={section.limit ?? ""}
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    const next = { ...section };
                    if (event.target.value && Number.isFinite(parsed)) {
                      next.limit = parsed;
                    } else {
                      delete next.limit;
                    }
                    onChange(next);
                  }}
                />
              </ManageField>
              <ManageField label={t("zone:manage_empty_state")}>
                <Select
                  value={section.emptyState ?? "show-empty"}
                  onValueChange={(value) =>
                    onChange({
                      ...section,
                      emptyState: value as "hide" | "show-empty",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="show-empty">
                      {t("zone:manage_empty_state_show")}
                    </SelectItem>
                    <SelectItem value="hide">
                      {t("zone:manage_empty_state_hide")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </ManageField>
            </div>

            <ZoneLabelField
              label={t("zone:manage_title_label")}
              value={section.titleLabelUnitId}
              onChange={(titleLabelUnitId) => {
                const next = { ...section };
                if (titleLabelUnitId) next.titleLabelUnitId = titleLabelUnitId;
                else delete next.titleLabelUnitId;
                onChange(next);
              }}
              refUnits={ctx.refUnits}
            />

            <ZoneSectionKindFields
              section={section}
              slot={slot}
              ctx={ctx}
              onChange={onChange}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ZoneSectionKindFields({
  section,
  slot: _slot,
  ctx,
  onChange,
}: {
  section: ZonePageSection;
  slot: ZoneSectionSlot;
  ctx: ZoneManageEditorContext;
  onChange: (section: ZonePageSection) => void;
}) {
  const { t } = useTranslation(["zone", "common"]);
  const baseId = useId();

  switch (section.kind) {
    case "hero":
      return (
        <div className="flex flex-col gap-4">
          <label
            htmlFor={`${baseId}-show-description`}
            className="flex items-center gap-2 text-sm leading-ui text-text-primary"
          >
            <Checkbox
              id={`${baseId}-show-description`}
              checked={section.showDescription !== false}
              onCheckedChange={(checked) => {
                const next = { ...section };
                if (checked) delete next.showDescription;
                else next.showDescription = false;
                onChange(next);
              }}
            />
            {t("zone:manage_hero_show_description")}
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <ManageField
              label={t("zone:manage_hero_banner")}
              hint={section.bannerImageUrl}
            >
              <Input
                value={section.bannerImageUrl ?? ""}
                placeholder="https://"
                className="font-mono text-sm"
                onChange={(event) => {
                  const next = { ...section };
                  if (event.target.value) {
                    next.bannerImageUrl = event.target.value;
                  } else {
                    delete next.bannerImageUrl;
                  }
                  onChange(next);
                }}
              />
            </ManageField>
            <ManageField
              label={t("zone:manage_hero_logo")}
              hint={section.logoImageUrl}
            >
              <Input
                value={section.logoImageUrl ?? ""}
                placeholder="https://"
                className="font-mono text-sm"
                onChange={(event) => {
                  const next = { ...section };
                  if (event.target.value) {
                    next.logoImageUrl = event.target.value;
                  } else {
                    delete next.logoImageUrl;
                  }
                  onChange(next);
                }}
              />
            </ManageField>
          </div>
          <div className="flex flex-col gap-2">
            <ManageGroupHeading>
              {t("zone:manage_hero_ctas")}
            </ManageGroupHeading>
            <ZoneCollectionItemsEditor
              items={section.ctas ?? []}
              onChange={(ctas) => {
                const next = { ...section };
                if (ctas.length > 0) next.ctas = ctas;
                else delete next.ctas;
                onChange(next);
              }}
              ctx={ctx}
            />
          </div>
        </div>
      );

    case "richText":
      return (
        <ZoneFragmentField
          label={t("zone:manage_content_unit")}
          value={section.contentUnitId}
          onChange={(contentUnitId) => onChange({ ...section, contentUnitId })}
          refUnits={ctx.refUnits}
          contextRealmUnitId={ctx.contextRealmUnitId}
          contextRealmSlug={ctx.contextRealmSlug}
        />
      );

    case "collection":
      return (
        <div className="flex flex-col gap-4">
          <ZoneDisplaySelect
            value={section.display}
            onChange={(display) => onChange({ ...section, display })}
          />
          <div className="flex flex-col gap-2">
            <ManageGroupHeading>{t("zone:manage_items")}</ManageGroupHeading>
            <ZoneCollectionItemsEditor
              items={section.items}
              onChange={(items) => onChange({ ...section, items })}
              ctx={ctx}
            />
          </div>
        </div>
      );

    case "query":
      return (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <ZoneDisplaySelect
              value={section.display}
              onChange={(display) => onChange({ ...section, display })}
            />
            <label
              htmlFor={`${baseId}-load-more`}
              className="flex items-center gap-2 pb-2 text-sm leading-ui text-text-primary"
            >
              <Checkbox
                id={`${baseId}-load-more`}
                checked={section.loadMore === true}
                onCheckedChange={(checked) => {
                  const next = { ...section };
                  if (checked) next.loadMore = true;
                  else delete next.loadMore;
                  onChange(next);
                }}
              />
              {t("zone:manage_load_more")}
            </label>
          </div>
          <ZoneQueryEditor
            query={section.query}
            onChange={(query) => onChange({ ...section, query })}
            dynamicTags={section.dynamicTags}
            onDynamicTagsChange={(dynamicTags) => {
              const next = { ...section };
              if (dynamicTags) next.dynamicTags = dynamicTags;
              else delete next.dynamicTags;
              onChange(next);
            }}
            refUnits={ctx.refUnits}
          />
        </div>
      );

    case "feed":
      return (
        <ManageField label={t("zone:manage_feed_kind")}>
          <Select
            value={section.feedKind ?? "all"}
            onValueChange={(feedKind) =>
              onChange({
                ...section,
                feedKind: feedKind as "all" | "updates" | "reviews",
              })
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["all", "updates", "reviews"] as const).map((feedKind) => (
                <SelectItem key={feedKind} value={feedKind}>
                  {t(FEED_KIND_KEYS[feedKind])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ManageField>
      );

    case "stats":
      return (
        <CheckGroup
          label={t("zone:manage_metrics")}
          options={["articles", "members"] as const}
          values={section.metrics}
          onChange={(metrics) => onChange({ ...section, metrics })}
          renderOption={(metric) => t(STATS_METRIC_KEYS[metric])}
        />
      );

    case "sources":
      return null;

    case "tabs":
      return (
        <ZoneTabsSectionFields
          section={section}
          ctx={ctx}
          onChange={onChange}
        />
      );

    case "columns":
      return (
        <ZoneColumnsSectionFields
          section={section}
          ctx={ctx}
          onChange={onChange}
        />
      );
  }
}

function ZoneDisplaySelect({
  value,
  onChange,
}: {
  value: ZoneSectionDisplay;
  onChange: (display: ZoneSectionDisplay) => void;
}) {
  const { t } = useTranslation(["zone"]);
  return (
    <ManageField label={t("zone:manage_display")}>
      <Select
        value={value}
        onValueChange={(display) => onChange(display as ZoneSectionDisplay)}
      >
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DISPLAY_OPTIONS.map((display) => (
            <SelectItem key={display} value={display}>
              {t(DISPLAY_KEYS[display])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </ManageField>
  );
}

/**
 * Shared editor for `ZoneCollectionItem[]` (collection items and hero
 * CTAs): link target plus optional LABEL override. Uses a stable counter
 * to key items since `ZoneCollectionItem` has no id field.
 * `ZoneCollectionItem[]` 的共享编辑器（集合条目与 hero CTA）：链接目标
 * 加可选的 LABEL 覆盖。由于 `ZoneCollectionItem` 没有 id 字段，使用
 * 稳定计数器为条目分配 key。
 */
function ZoneCollectionItemsEditor({
  items,
  onChange,
  ctx,
}: {
  items: readonly ZoneCollectionItem[];
  onChange: (items: ZoneCollectionItem[]) => void;
  ctx: ZoneManageEditorContext;
}) {
  const { t } = useTranslation(["zone", "common"]);

  // Stable keys for items that lack an id field. The counter ref persists
  // across renders; the key map is rebuilt when the list length changes
  // (add/remove) to stay in sync.
  // 为缺少 id 字段的条目提供稳定 key。计数器 ref 跨渲染保持；key 映射
  // 在列表长度变化（增删）时重建以保持同步。
  const counterRef = useRef(0);
  const keysRef = useRef<number[]>([]);
  if (keysRef.current.length !== items.length) {
    // Preserve existing keys for items that remain; assign new keys for
    // additions at the end.
    // 为仍然存在的条目保留现有 key；为末尾新增的条目分配新 key。
    const next: number[] = [];
    for (let i = 0; i < items.length; i++) {
      next.push(keysRef.current[i] ?? ++counterRef.current);
    }
    keysRef.current = next;
  }

  const handleRemove = (removeIndex: number) => {
    keysRef.current = keysRef.current.filter((_, i) => i !== removeIndex);
    onChange(items.filter((_, i) => i !== removeIndex));
  };

  const handleMoveUp = (moveIndex: number) => {
    const nextKeys = [...keysRef.current];
    [nextKeys[moveIndex - 1], nextKeys[moveIndex]] = [
      nextKeys[moveIndex],
      nextKeys[moveIndex - 1],
    ];
    keysRef.current = nextKeys;
    onChange(moveListItem(items, moveIndex, "up"));
  };

  const handleMoveDown = (moveIndex: number) => {
    const nextKeys = [...keysRef.current];
    [nextKeys[moveIndex], nextKeys[moveIndex + 1]] = [
      nextKeys[moveIndex + 1],
      nextKeys[moveIndex],
    ];
    keysRef.current = nextKeys;
    onChange(moveListItem(items, moveIndex, "down"));
  };

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => (
        <div
          key={keysRef.current[index]}
          className="flex flex-col gap-3 rounded-md bg-surface-subtle p-3"
        >
          <div className="flex justify-end">
            <RowActions
              onMoveUp={index > 0 ? () => handleMoveUp(index) : undefined}
              onMoveDown={
                index < items.length - 1
                  ? () => handleMoveDown(index)
                  : undefined
              }
              onRemove={() => handleRemove(index)}
            />
          </div>
          <ZoneLinkTargetField
            value={item.target}
            onChange={(target) => {
              if (!target) return;
              onChange(
                items.map((current, currentIndex) =>
                  currentIndex === index ? { ...current, target } : current,
                ),
              );
            }}
            refUnits={ctx.refUnits}
          />
          <ZoneLabelField
            label={t("zone:manage_node_label")}
            value={item.labelUnitId}
            onChange={(labelUnitId) =>
              onChange(
                items.map((current, currentIndex) => {
                  if (currentIndex !== index) return current;
                  const next = { ...current };
                  if (labelUnitId) next.labelUnitId = labelUnitId;
                  else delete next.labelUnitId;
                  return next;
                }),
              )
            }
            refUnits={ctx.refUnits}
          />
        </div>
      ))}
      <div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            onChange([
              ...items,
              { target: { kind: "zonePage", pageId: "home" } },
            ])
          }
        >
          <Plus className="mr-1 size-4" aria-hidden />
          {t("zone:manage_add_item")}
        </Button>
      </div>
    </div>
  );
}

function ZoneTabsSectionFields({
  section,
  ctx,
  onChange,
}: {
  section: ZoneTabsSection;
  ctx: ZoneManageEditorContext;
  onChange: (section: ZonePageSection) => void;
}) {
  const { t } = useTranslation(["zone", "common"]);

  const updateTab = (
    index: number,
    patch: Partial<ZoneTabsSection["tabs"][number]>,
  ) => {
    onChange({
      ...section,
      tabs: section.tabs.map((tab, currentIndex) =>
        currentIndex === index ? { ...tab, ...patch } : tab,
      ),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <ManageField label={t("zone:manage_default_tab")}>
        <Select
          value={section.defaultTabId ?? NONE}
          onValueChange={(value) => {
            const next = { ...section };
            if (value === NONE) delete next.defaultTabId;
            else next.defaultTabId = value;
            onChange(next);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{t("common:none")}</SelectItem>
            {section.tabs.map((tab) => (
              <SelectItem key={tab.id} value={tab.id} className="font-mono">
                {tab.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ManageField>

      {section.tabs.map((tab, index) => (
        <div
          key={tab.id}
          className="flex flex-col gap-3 rounded-md bg-surface-subtle p-3"
        >
          <div className="flex items-end justify-between gap-3">
            <ManageField label={t("zone:manage_tab_id")}>
              <Input
                value={tab.id}
                className="font-mono text-sm"
                onChange={(event) =>
                  updateTab(index, { id: event.target.value })
                }
              />
            </ManageField>
            <RowActions
              onMoveUp={
                index > 0
                  ? () =>
                      onChange({
                        ...section,
                        tabs: moveListItem(section.tabs, index, "up"),
                      })
                  : undefined
              }
              onMoveDown={
                index < section.tabs.length - 1
                  ? () =>
                      onChange({
                        ...section,
                        tabs: moveListItem(section.tabs, index, "down"),
                      })
                  : undefined
              }
              onRemove={() =>
                onChange({
                  ...section,
                  tabs: section.tabs.filter(
                    (_, currentIndex) => currentIndex !== index,
                  ),
                })
              }
            />
          </div>
          <ZoneLabelField
            label={t("zone:manage_title_label")}
            value={tab.titleLabelUnitId}
            onChange={(titleLabelUnitId) => {
              const next = { ...tab };
              if (titleLabelUnitId) next.titleLabelUnitId = titleLabelUnitId;
              else delete next.titleLabelUnitId;
              updateTab(index, next);
            }}
            refUnits={ctx.refUnits}
          />
          {/* Tabs panes accept content sections only (slot="tabs"). */}
          {/* tabs 面板只接受内容分区（slot="tabs"）。 */}
          <ZoneSectionListEditor
            sections={tab.sections}
            onChange={(sections) =>
              updateTab(index, { sections: sections as ZoneContentSection[] })
            }
            slot="tabs"
            ctx={ctx}
          />
        </div>
      ))}

      <div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            onChange({
              ...section,
              tabs: [
                ...section.tabs,
                {
                  id: nextZoneId(
                    "tab",
                    section.tabs.map((tab) => tab.id),
                  ),
                  sections: [],
                },
              ],
            })
          }
        >
          <Plus className="mr-1 size-4" aria-hidden />
          {t("zone:manage_add_tab")}
        </Button>
      </div>
    </div>
  );
}

function ZoneColumnsSectionFields({
  section,
  ctx,
  onChange,
}: {
  section: ZoneColumnsSection;
  ctx: ZoneManageEditorContext;
  onChange: (section: ZonePageSection) => void;
}) {
  const { t } = useTranslation(["zone"]);
  const updateColumns = (columns: ZoneColumn[]) =>
    onChange({ ...section, columns });

  return (
    <div className="flex flex-col gap-4">
      {section.columns.map((column, index) => (
        <div
          key={column.id}
          className="flex flex-col gap-4 rounded-md bg-surface-subtle p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <ManageGroupHeading>
              {t("zone:manage_column", { number: index + 1 })}
            </ManageGroupHeading>
            <RowActions
              onMoveUp={
                index > 0
                  ? () =>
                      updateColumns(moveListItem(section.columns, index, "up"))
                  : undefined
              }
              onMoveDown={
                index < section.columns.length - 1
                  ? () =>
                      updateColumns(
                        moveListItem(section.columns, index, "down"),
                      )
                  : undefined
              }
              onRemove={
                section.columns.length > ZONE_COLUMNS_MIN
                  ? () =>
                      updateColumns(
                        section.columns.filter(
                          (_, currentIndex) => currentIndex !== index,
                        ),
                      )
                  : undefined
              }
            />
          </div>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_8rem]">
            <ManageField label={t("zone:manage_column_id")}>
              <Input
                value={column.id}
                onChange={(event) =>
                  updateColumns(
                    section.columns.map((current, currentIndex) =>
                      currentIndex === index
                        ? { ...current, id: event.target.value }
                        : current,
                    ),
                  )
                }
                className="font-mono text-sm"
              />
            </ManageField>
            <ManageField label={t("zone:manage_column_ratio")}>
              <Input
                type="number"
                min={1}
                max={12}
                value={column.ratio}
                onChange={(event) => {
                  if (event.target.value === "") return;
                  const ratio = Number(event.target.value);
                  if (!Number.isInteger(ratio) || ratio < 1 || ratio > 12) {
                    return;
                  }
                  updateColumns(
                    section.columns.map((current, currentIndex) =>
                      currentIndex === index ? { ...current, ratio } : current,
                    ),
                  );
                }}
              />
            </ManageField>
          </div>
          {/* Columns panes accept content sections or tabs (slot="columns"). */}
          {/* columns 面板接受内容分区或 tabs（slot="columns"）。 */}
          <ZoneSectionListEditor
            sections={column.sections}
            onChange={(sections) =>
              updateColumns(
                section.columns.map((current, currentIndex) =>
                  currentIndex === index
                    ? {
                        ...current,
                        sections: sections as ZoneColumn["sections"],
                      }
                    : current,
                ),
              )
            }
            slot="columns"
            ctx={ctx}
          />
        </div>
      ))}

      <div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={section.columns.length >= ZONE_COLUMNS_MAX}
          onClick={() =>
            updateColumns([
              ...section.columns,
              {
                id: nextZoneId(
                  "column",
                  section.columns.map((column) => column.id),
                ),
                ratio: 1,
                sections: [],
              },
            ])
          }
        >
          <Plus className="mr-1 size-4" aria-hidden />
          {t("zone:manage_add_column")}
        </Button>
      </div>
    </div>
  );
}
