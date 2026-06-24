import {
  meiliLabelSearchQueryOptions,
  postSearchQueryOptions,
  realmSearchQueryOptions,
  zoneSearchQueryOptions,
} from "@rezics/api/meili/meili.queries";
import { realmDockQuery } from "@rezics/api/realm/realm-dock.queries";
import { useUpdateRealmDockMutation } from "@rezics/api/realm/realm-dock.mutations";
import type {
  LabelSearchDocument,
  PostSearchDocument,
  RealmDock,
  RealmDockBookmarkItem,
  RealmDockButtonItem,
  RealmDockCustomWidgetItem,
  RealmDockImageItem,
  RealmDockItem,
  RealmDockPlacement,
  RealmDockStatsMetric,
  RealmDockWidget,
  RealmSearchDocument,
  ZoneSearchDocument,
  ZoneLinkTarget,
} from "@rezics/contract";
import {
  defaultRealmDockMainItems,
  emptyRealmDock,
  realmDockMainRequiredBuiltinIds,
  realmDockPlacementValues,
} from "@rezics/contract";
import { getI18nRuntime } from "@rezics/i18n/runtime";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Link,
  Plus,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";

const widgetKinds = [
  "text",
  "buttons",
  "images",
  "communityList",
  "calendar",
  "featuredZone",
  "zoneNav",
  "stats",
  "pinboard",
] as const satisfies readonly RealmDockWidget["kind"][];

const statMetrics = [
  "members",
  "posts",
  "wikiPages",
] as const satisfies readonly RealmDockStatsMetric[];

function copyDock(dock: RealmDock | undefined): RealmDock {
  return normalizeDock(structuredClone(dock ?? emptyRealmDock()));
}

function normalizeDock(dock: RealmDock): RealmDock {
  const main = dock.placements.main ?? [];
  const present = new Set(
    main.flatMap((item) => (item.slot === "builtin" ? [item.id] : [])),
  );
  const missing = defaultRealmDockMainItems().filter(
    (item) => !present.has(item.id),
  );
  return {
    ...dock,
    placements: {
      ...dock.placements,
      main: [...main, ...missing],
    },
  };
}

function itemId(kind: string) {
  return `dock-${kind}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function newWidget(kind: RealmDockWidget["kind"]): RealmDockCustomWidgetItem {
  switch (kind) {
    case "text":
      return {
        slot: "widget",
        id: itemId(kind),
        widget: { kind, contentUnitId: "" },
      };
    case "buttons":
      return { slot: "widget", id: itemId(kind), widget: { kind, items: [] } };
    case "images":
      return { slot: "widget", id: itemId(kind), widget: { kind, items: [] } };
    case "communityList":
      return {
        slot: "widget",
        id: itemId(kind),
        widget: { kind, realmUnitIds: [] },
      };
    case "calendar":
      return {
        slot: "widget",
        id: itemId(kind),
        widget: { kind, source: "realmPosts" },
      };
    case "featuredZone":
      return {
        slot: "widget",
        id: itemId(kind),
        widget: { kind, zoneUnitId: "" },
      };
    case "zoneNav":
      return {
        slot: "widget",
        id: itemId(kind),
        widget: { kind, zoneUnitId: "" },
      };
    case "stats":
      return {
        slot: "widget",
        id: itemId(kind),
        widget: { kind, metrics: ["members"] },
      };
    case "pinboard":
      return {
        slot: "widget",
        id: itemId(kind),
        widget: { kind, pinboardKey: "home" },
      };
  }
}

function docTitle(
  doc:
    | LabelSearchDocument
    | PostSearchDocument
    | RealmSearchDocument
    | ZoneSearchDocument,
) {
  return doc.title ?? doc.titles?.[0] ?? doc.id;
}

function labelUnitId(doc: LabelSearchDocument) {
  return doc.unitId || doc.id;
}

function placementLabel(placement: RealmDockPlacement) {
  switch (placement) {
    case "main":
      return getI18nRuntime().i18n.t("entity:realm_dock_placement_main");
    case "wiki":
      return getI18nRuntime().i18n.t("entity:realm_dock_placement_wiki");
  }
}

function builtinLabel(id: RealmDockItem["id"]) {
  switch (id) {
    case "description":
      return getI18nRuntime().i18n.t(
        "entity:realm_dock_widget_description_title",
      );
    case "subscriptionStat":
      return getI18nRuntime().i18n.t(
        "entity:realm_dock_widget_subscriptionStat_title",
      );
    case "realmFacts":
      return getI18nRuntime().i18n.t(
        "entity:realm_dock_widget_realmFacts_title",
      );
    case "bookmarks":
      return getI18nRuntime().i18n.t(
        "entity:realm_dock_widget_bookmarks_title",
      );
    case "rules":
      return getI18nRuntime().i18n.t("entity:realm_dock_widget_rules_title");
    case "moderators":
      return getI18nRuntime().i18n.t(
        "entity:realm_dock_widget_moderators_title",
      );
    default:
      return id;
  }
}

function widgetKindLabel(kind: RealmDockWidget["kind"]) {
  switch (kind) {
    case "text":
      return getI18nRuntime().i18n.t("entity:realm_dock_widget_text_title");
    case "buttons":
      return getI18nRuntime().i18n.t("entity:realm_dock_widget_buttons_title");
    case "images":
      return getI18nRuntime().i18n.t("entity:realm_dock_widget_images_title");
    case "communityList":
      return getI18nRuntime().i18n.t(
        "entity:realm_dock_widget_communityList_title",
      );
    case "calendar":
      return getI18nRuntime().i18n.t("entity:realm_dock_widget_calendar_title");
    case "featuredZone":
      return getI18nRuntime().i18n.t(
        "entity:realm_dock_widget_featuredZone_title",
      );
    case "zoneNav":
      return getI18nRuntime().i18n.t("entity:realm_dock_widget_zoneNav_title");
    case "stats":
      return getI18nRuntime().i18n.t("entity:realm_dock_widget_stats_title");
    case "pinboard":
      return getI18nRuntime().i18n.t("entity:realm_dock_widget_pinboard_title");
  }
}

function metricLabel(metric: RealmDockStatsMetric) {
  switch (metric) {
    case "members":
      return getI18nRuntime().i18n.t("entity:realm_dock_metric_members");
    case "posts":
      return getI18nRuntime().i18n.t("entity:realm_dock_metric_posts");
    case "wikiPages":
      return getI18nRuntime().i18n.t("entity:realm_dock_metric_wikiPages");
  }
}

function externalTarget(url = ""): ZoneLinkTarget {
  return { kind: "external", url, text: url };
}

function isComplete(item: RealmDockItem) {
  if (item.slot === "builtin") return true;
  const widget = item.widget;
  switch (widget.kind) {
    case "text":
      return Boolean(widget.contentUnitId);
    case "featuredZone":
    case "zoneNav":
      return Boolean(widget.zoneUnitId);
    case "buttons":
      return widget.items.every(
        (button) => button.target.kind !== "external" || button.target.url,
      );
    case "images":
      return widget.items.every((image) => image.imageUrl);
    default:
      return true;
  }
}

function upsertPlacement(
  dock: RealmDock,
  placement: RealmDockPlacement,
  items: RealmDockItem[],
): RealmDock {
  return normalizeDock({
    ...dock,
    placements: {
      ...dock.placements,
      [placement]: items,
    },
  });
}

/**
 * Realm Dock editor.
 *
 * Mobile (<640px):
 * +--------------------------+
 * | Placement tabs scroll    |
 * | Add custom widget        |
 * | Dock items stacked       |
 * | Save                     |
 * +--------------------------+
 *
 * Tablet (640-1023px):
 * +------------------------------------+
 * | Tabs full width, item cards stacked|
 * +------------------------------------+
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | Management column with stable row tools  |
 * +------------------------------------------+
 *
 * Ultra-wide (>=1536px):
 * +------------------------------------------+
 * | Parent layout constrains width           |
 * +------------------------------------------+
 *
 * Dock 編輯器按 Main/Wiki placement 管理 item。Main 內建項只能排序，不能刪
 * 除；自訂 widget 可增刪改。預設文案由 app i18n 推導，LABEL Unit 只作
 * optional override，不要求使用者為明顯預設文案建立 label。
 */
export function RealmDockEditor({ realmId }: { realmId: string }) {
  const [placement, setPlacement] = useState<RealmDockPlacement>("main");
  const [draft, setDraft] = useState<RealmDock>(() => emptyRealmDock());
  const [addKind, setAddKind] = useState<RealmDockWidget["kind"]>("text");
  const [error, setError] = useState<string | null>(null);
  const { data } = useQuery(realmDockQuery(realmId));
  const updateDock = useUpdateRealmDockMutation();

  useEffect(() => {
    setDraft(copyDock(data));
  }, [data]);

  const items = draft.placements[placement] ?? [];
  const incomplete = items.find((item) => !isComplete(item));

  const setItems = (nextItems: RealmDockItem[]) => {
    setDraft((current) => upsertPlacement(current, placement, nextItems));
  };

  const updateItem = (id: string, nextItem: RealmDockItem) => {
    setItems(items.map((item) => (item.id === id ? nextItem : item)));
  };

  const addWidget = () => {
    setItems([...items, newWidget(addKind)]);
  };

  const moveItem = (id: string, direction: -1 | 1) => {
    const index = items.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const save = async () => {
    if (incomplete) {
      setError(getI18nRuntime().i18n.t("entity:realm_dock_editor_incomplete"));
      return;
    }
    setError(null);
    await updateDock.mutateAsync({ realmId, dock: draft });
    toast.success(getI18nRuntime().i18n.t("entity:realm_dock_editor_saved"));
  };

  return (
    <section className="flex flex-col gap-4 rounded-md bg-surface-subtle p-4">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium leading-ui text-text-primary">
          {getI18nRuntime().i18n.t("entity:realm_dock_editor_title")}
        </h3>
        <Tabs
          value={placement}
          onValueChange={(value) => setPlacement(value as RealmDockPlacement)}
        >
          <TabsList className="w-full max-w-full justify-start overflow-x-auto">
            {realmDockPlacementValues.map((item) => (
              <TabsTrigger key={item} value={item} className="flex-none">
                {placementLabel(item)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="flex flex-col gap-1">
          <Label htmlFor="realm-dock-kind">
            {getI18nRuntime().i18n.t("entity:realm_dock_editor_add_kind")}
          </Label>
          <Select
            value={addKind}
            onValueChange={(value) =>
              setAddKind(value as RealmDockWidget["kind"])
            }
          >
            <SelectTrigger id="realm-dock-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {widgetKinds.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {widgetKindLabel(kind)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" onClick={addWidget}>
          <Plus className="size-4" />
          {getI18nRuntime().i18n.t("common:add")}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {items.length ? (
          items.map((item, index) => (
            <DockItemEditorCard
              key={item.id}
              item={item}
              index={index}
              count={items.length}
              onChange={(nextItem) => updateItem(item.id, nextItem)}
              onMove={moveItem}
              onRemove={() => removeItem(item.id)}
            />
          ))
        ) : (
          <p className="text-sm leading-body text-text-secondary">
            {getI18nRuntime().i18n.t("entity:realm_dock_editor_empty")}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {error ? (
          <p className="mr-auto text-sm leading-ui text-error-text">{error}</p>
        ) : null}
        <Button type="button" onClick={save} disabled={updateDock.isPending}>
          <Save className="size-4" />
          {getI18nRuntime().i18n.t("common:save")}
        </Button>
      </div>
    </section>
  );
}

function DockItemEditorCard({
  item,
  index,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  item: RealmDockItem;
  index: number;
  count: number;
  onChange: (item: RealmDockItem) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const builtin = item.slot === "builtin";
  const lockedBuiltin =
    builtin && realmDockMainRequiredBuiltinIds.includes(item.id as any);
  return (
    <div className="grid gap-4 rounded-md bg-surface-base p-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <p className="mr-auto min-w-0 truncate text-sm font-medium leading-ui text-text-primary">
          {builtin ? builtinLabel(item.id) : widgetKindLabel(item.widget.kind)}
        </p>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={index === 0}
          onClick={() => onMove(item.id, -1)}
          aria-label={getI18nRuntime().i18n.t(
            "entity:realm_dock_editor_move_up",
          )}
        >
          <ArrowUp className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={index === count - 1}
          onClick={() => onMove(item.id, 1)}
          aria-label={getI18nRuntime().i18n.t(
            "entity:realm_dock_editor_move_down",
          )}
        >
          <ArrowDown className="size-4" />
        </Button>
        {!lockedBuiltin ? (
          <Button type="button" size="icon" variant="ghost" onClick={onRemove}>
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>
      {item.slot === "builtin" ? (
        <BuiltinFields item={item} onChange={onChange} />
      ) : (
        <CustomWidgetFields item={item} onChange={onChange} />
      )}
    </div>
  );
}

function BuiltinFields({
  item,
  onChange,
}: {
  item: Extract<RealmDockItem, { slot: "builtin" }>;
  onChange: (item: RealmDockItem) => void;
}) {
  switch (item.id) {
    case "description":
      return (
        <NumberField
          id={`${item.id}-max-lines`}
          label={getI18nRuntime().i18n.t("entity:realm_dock_editor_max_lines")}
          value={item.maxLines ?? 4}
          onChange={(maxLines) => onChange({ ...item, maxLines })}
        />
      );
    case "subscriptionStat":
      return (
        <LabelPicker
          value={item.labelOverrideUnitId ?? ""}
          label={getI18nRuntime().i18n.t(
            "entity:realm_dock_editor_label_override",
          )}
          optional
          onSelect={(labelOverrideUnitId) =>
            onChange(
              labelOverrideUnitId
                ? { ...item, labelOverrideUnitId }
                : (({ labelOverrideUnitId: _label, ...rest }) => rest)(item),
            )
          }
        />
      );
    case "bookmarks":
      return (
        <BookmarkItemsEditor
          items={item.items}
          onChange={(items) => onChange({ ...item, items })}
        />
      );
    case "rules":
      return (
        <Select
          value={item.mode ?? "summary"}
          onValueChange={(mode) =>
            onChange({ ...item, mode: mode as "summary" | "full" })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="summary">
              {getI18nRuntime().i18n.t("entity:realm_dock_editor_rule_summary")}
            </SelectItem>
            <SelectItem value="full">
              {getI18nRuntime().i18n.t("entity:realm_dock_editor_rule_full")}
            </SelectItem>
          </SelectContent>
        </Select>
      );
    case "moderators":
      return (
        <NumberField
          id={`${item.id}-limit`}
          label={getI18nRuntime().i18n.t("entity:realm_dock_editor_limit")}
          value={item.limit ?? 5}
          onChange={(limit) => onChange({ ...item, limit })}
        />
      );
    case "realmFacts":
      return null;
  }
}

function CustomWidgetFields({
  item,
  onChange,
}: {
  item: RealmDockCustomWidgetItem;
  onChange: (item: RealmDockItem) => void;
}) {
  const widget = item.widget;
  const updateWidget = (widget: RealmDockWidget) =>
    onChange({ ...item, widget });
  return (
    <div className="grid gap-3">
      <LabelPicker
        value={widget.titleOverrideUnitId ?? ""}
        label={getI18nRuntime().i18n.t(
          "entity:realm_dock_editor_title_override",
        )}
        optional
        onSelect={(titleOverrideUnitId) =>
          updateWidget(
            titleOverrideUnitId
              ? { ...widget, titleOverrideUnitId }
              : (({ titleOverrideUnitId: _title, ...rest }) =>
                  rest as RealmDockWidget)(widget),
          )
        }
      />
      <WidgetSpecificFields widget={widget} onChange={updateWidget} />
    </div>
  );
}

function WidgetSpecificFields({
  widget,
  onChange,
}: {
  widget: RealmDockWidget;
  onChange: (widget: RealmDockWidget) => void;
}) {
  switch (widget.kind) {
    case "text":
      return (
        <PostPicker
          value={widget.contentUnitId}
          label={getI18nRuntime().i18n.t(
            "entity:realm_dock_editor_content_post",
          )}
          onSelect={(contentUnitId) => onChange({ ...widget, contentUnitId })}
        />
      );
    case "buttons":
      return (
        <ButtonItemsEditor
          items={widget.items}
          onChange={(items) => onChange({ ...widget, items })}
        />
      );
    case "images":
      return (
        <ImageItemsEditor
          items={widget.items}
          onChange={(items) => onChange({ ...widget, items })}
        />
      );
    case "communityList":
      return (
        <RealmListPicker
          value={widget.realmUnitIds}
          onChange={(realmUnitIds) => onChange({ ...widget, realmUnitIds })}
        />
      );
    case "calendar":
      return (
        <p className="text-sm leading-body text-text-secondary">
          {getI18nRuntime().i18n.t("entity:realm_dock_editor_calendar_note")}
        </p>
      );
    case "featuredZone":
      return (
        <ZonePicker
          value={widget.zoneUnitId}
          label={getI18nRuntime().i18n.t("entity:realm_dock_editor_zone")}
          onSelect={(zoneUnitId) => onChange({ ...widget, zoneUnitId })}
        />
      );
    case "zoneNav":
      return (
        <div className="grid gap-3">
          <ZonePicker
            value={widget.zoneUnitId}
            label={getI18nRuntime().i18n.t("entity:realm_dock_editor_zone")}
            onSelect={(zoneUnitId) => onChange({ ...widget, zoneUnitId })}
          />
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${widget.kind}-menu`}>
              {getI18nRuntime().i18n.t("entity:realm_dock_editor_menu_id")}
            </Label>
            <Input
              id={`${widget.kind}-menu`}
              value={widget.menuId ?? ""}
              onChange={(event) =>
                onChange({
                  ...widget,
                  menuId: event.target.value.trim() || undefined,
                })
              }
            />
          </div>
        </div>
      );
    case "stats":
      return (
        <div className="flex flex-wrap gap-2">
          {statMetrics.map((metric) => {
            const active = widget.metrics.includes(metric);
            return (
              <Button
                key={metric}
                type="button"
                size="sm"
                variant={active ? "default" : "secondary"}
                onClick={() =>
                  onChange({
                    ...widget,
                    metrics: active
                      ? widget.metrics.filter((item) => item !== metric)
                      : [...widget.metrics, metric],
                  })
                }
              >
                {metricLabel(metric)}
              </Button>
            );
          })}
        </div>
      );
    case "pinboard":
      return (
        <p className="text-sm leading-body text-text-secondary">
          {getI18nRuntime().i18n.t("entity:realm_dock_editor_pinboard_note")}
        </p>
      );
  }
}

function NumberField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 1)}
      />
    </div>
  );
}

function SearchPicker<TDoc extends { id: string }>({
  value,
  label,
  optional,
  searchKind,
  onSelect,
  getId,
}: {
  value: string;
  label: string;
  optional?: boolean;
  searchKind: "post" | "label" | "realm" | "zone";
  onSelect: (id: string) => void;
  getId?: (doc: TDoc) => string;
}) {
  const readContext = useReadLanguageContext();
  const [query, setQuery] = useState("");
  const searchTerm = query.trim();
  const common = {
    keyword: searchTerm,
    languages: readContext.languages,
    appLocale: readContext.appLocale,
    limit: 6,
  };
  const postQuery = useQuery({
    ...postSearchQueryOptions(common),
    enabled: searchKind === "post" && readContext.ready && Boolean(searchTerm),
  });
  const labelQuery = useQuery({
    ...meiliLabelSearchQueryOptions(common),
    enabled: searchKind === "label" && readContext.ready && Boolean(searchTerm),
  });
  const realmQuery = useQuery({
    ...realmSearchQueryOptions(common),
    enabled: searchKind === "realm" && readContext.ready && Boolean(searchTerm),
  });
  const zoneQuery = useQuery({
    ...zoneSearchQueryOptions(common),
    enabled: searchKind === "zone" && readContext.ready && Boolean(searchTerm),
  });

  const results = useMemo(() => {
    if (searchKind === "post") return postQuery.data?.items ?? [];
    if (searchKind === "label") return labelQuery.data?.items ?? [];
    if (searchKind === "realm") return realmQuery.data?.items ?? [];
    return zoneQuery.data?.items ?? [];
  }, [
    labelQuery.data?.items,
    postQuery.data?.items,
    realmQuery.data?.items,
    searchKind,
    zoneQuery.data?.items,
  ]) as TDoc[];

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex min-w-0 items-center gap-2">
        <Search className="size-4 shrink-0 text-text-tertiary" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={getI18nRuntime().i18n.t(
            "entity:realm_dock_editor_search",
          )}
        />
        {optional && value ? (
          <Button type="button" variant="ghost" onClick={() => onSelect("")}>
            {getI18nRuntime().i18n.t("common:clear")}
          </Button>
        ) : null}
      </div>
      {value ? (
        <p className="text-xs leading-ui text-text-secondary">
          {getI18nRuntime().i18n.t("entity:realm_dock_editor_selected")}
        </p>
      ) : null}
      {results.length ? (
        <div className="grid gap-2">
          {results.map((item) => {
            const id = getId ? getId(item) : item.id;
            return (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={value === id ? "default" : "secondary"}
                className="min-w-0 justify-start"
                onClick={() => onSelect(id)}
              >
                <span className="truncate">{docTitle(item as any)}</span>
              </Button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function LabelPicker(props: {
  value: string;
  label: string;
  optional?: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <SearchPicker<LabelSearchDocument>
      {...props}
      searchKind="label"
      getId={labelUnitId}
    />
  );
}

function PostPicker(props: {
  value: string;
  label: string;
  onSelect: (id: string) => void;
}) {
  return <SearchPicker<PostSearchDocument> {...props} searchKind="post" />;
}

function ZonePicker(props: {
  value: string;
  label: string;
  onSelect: (id: string) => void;
}) {
  return <SearchPicker<ZoneSearchDocument> {...props} searchKind="zone" />;
}

function RealmListPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const addRealm = (realmUnitId: string) => {
    if (!realmUnitId || value.includes(realmUnitId)) return;
    onChange([...value, realmUnitId]);
  };

  return (
    <div className="flex flex-col gap-3">
      <SearchPicker<RealmSearchDocument>
        value=""
        label={getI18nRuntime().i18n.t("entity:realm_dock_editor_community")}
        searchKind="realm"
        onSelect={addRealm}
      />
      {value.length ? (
        <div className="flex flex-wrap gap-2">
          {value.map((realmUnitId) => (
            <Button
              key={realmUnitId}
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                onChange(value.filter((item) => item !== realmUnitId))
              }
            >
              <Trash2 className="size-4" />
              {getI18nRuntime().i18n.t("entity:realm_dock_editor_selected")}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ButtonItemsEditor({
  items,
  onChange,
}: {
  items: RealmDockButtonItem[];
  onChange: (items: RealmDockButtonItem[]) => void;
}) {
  const addItem = () => onChange([...items, { target: externalTarget() }]);

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => (
        <div
          key={index}
          className="grid gap-3 rounded-md bg-surface-subtle p-3"
        >
          <LabelPicker
            value={item.labelOverrideUnitId ?? ""}
            label={getI18nRuntime().i18n.t(
              "entity:realm_dock_editor_label_override",
            )}
            optional
            onSelect={(labelOverrideUnitId) => {
              const next = [...items];
              next[index] = labelOverrideUnitId
                ? { ...item, labelOverrideUnitId }
                : (({ labelOverrideUnitId: _label, ...rest }) => rest)(item);
              onChange(next);
            }}
          />
          <ExternalTargetEditor
            url={item.target.kind === "external" ? item.target.url : ""}
            onChange={(url) => {
              const next = [...items];
              next[index] = { ...item, target: externalTarget(url) };
              onChange(next);
            }}
          />
          <DeleteRowButton
            onClick={() =>
              onChange(items.filter((_, itemIndex) => itemIndex !== index))
            }
          />
        </div>
      ))}
      <Button type="button" size="sm" variant="secondary" onClick={addItem}>
        <Link className="size-4" />
        {getI18nRuntime().i18n.t("entity:realm_dock_editor_add_button")}
      </Button>
    </div>
  );
}

function ImageItemsEditor({
  items,
  onChange,
}: {
  items: RealmDockImageItem[];
  onChange: (items: RealmDockImageItem[]) => void;
}) {
  const addItem = () => onChange([...items, { imageUrl: "" }]);

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => (
        <div
          key={index}
          className="grid gap-3 rounded-md bg-surface-subtle p-3"
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor={`dock-image-${index}`}>
              {getI18nRuntime().i18n.t("entity:realm_dock_editor_image_url")}
            </Label>
            <Input
              id={`dock-image-${index}`}
              value={item.imageUrl}
              onChange={(event) => {
                const next = [...items];
                next[index] = { ...item, imageUrl: event.target.value.trim() };
                onChange(next);
              }}
              placeholder="https://"
            />
          </div>
          <LabelPicker
            value={item.altOverrideUnitId ?? ""}
            label={getI18nRuntime().i18n.t(
              "entity:realm_dock_editor_alt_override",
            )}
            optional
            onSelect={(altOverrideUnitId) => {
              const next = [...items];
              next[index] = altOverrideUnitId
                ? { ...item, altOverrideUnitId }
                : (({ altOverrideUnitId: _alt, ...rest }) => rest)(item);
              onChange(next);
            }}
          />
          <DeleteRowButton
            onClick={() =>
              onChange(items.filter((_, itemIndex) => itemIndex !== index))
            }
          />
        </div>
      ))}
      <Button type="button" size="sm" variant="secondary" onClick={addItem}>
        <ImagePlus className="size-4" />
        {getI18nRuntime().i18n.t("entity:realm_dock_editor_add_image")}
      </Button>
    </div>
  );
}

function BookmarkItemsEditor({
  items,
  onChange,
}: {
  items: RealmDockBookmarkItem[];
  onChange: (items: RealmDockBookmarkItem[]) => void;
}) {
  const addLink = () =>
    onChange([
      ...items,
      { id: itemId("bookmark"), kind: "link", target: externalTarget() },
    ]);
  const addGroup = () =>
    onChange([
      ...items,
      { id: itemId("bookmark-group"), kind: "group", items: [] },
    ]);

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => (
        <div
          key={item.id}
          className="grid gap-3 rounded-md bg-surface-subtle p-3"
        >
          <LabelPicker
            value={item.labelOverrideUnitId ?? ""}
            label={getI18nRuntime().i18n.t(
              "entity:realm_dock_editor_label_override",
            )}
            optional
            onSelect={(labelOverrideUnitId) => {
              const next = [...items];
              next[index] = labelOverrideUnitId
                ? { ...item, labelOverrideUnitId }
                : (({ labelOverrideUnitId: _label, ...rest }) => rest)(item);
              onChange(next);
            }}
          />
          {item.kind === "link" ? (
            <ExternalTargetEditor
              url={item.target.kind === "external" ? item.target.url : ""}
              onChange={(url) => {
                const next = [...items];
                next[index] = { ...item, target: externalTarget(url) };
                onChange(next);
              }}
            />
          ) : (
            <BookmarkGroupLinksEditor
              items={item.items}
              onChange={(groupItems) => {
                const next = [...items];
                next[index] = { ...item, items: groupItems };
                onChange(next);
              }}
            />
          )}
          <DeleteRowButton
            onClick={() =>
              onChange(items.filter((_, itemIndex) => itemIndex !== index))
            }
          />
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={addLink}>
          <Link className="size-4" />
          {getI18nRuntime().i18n.t("entity:realm_dock_editor_add_bookmark")}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={addGroup}>
          <Plus className="size-4" />
          {getI18nRuntime().i18n.t(
            "entity:realm_dock_editor_add_bookmark_group",
          )}
        </Button>
      </div>
    </div>
  );
}

function BookmarkGroupLinksEditor({
  items,
  onChange,
}: {
  items: Array<{
    id: string;
    labelOverrideUnitId?: string;
    target: ZoneLinkTarget;
  }>;
  onChange: (
    items: Array<{
      id: string;
      labelOverrideUnitId?: string;
      target: ZoneLinkTarget;
    }>,
  ) => void;
}) {
  const addLink = () =>
    onChange([
      ...items,
      { id: itemId("bookmark-link"), target: externalTarget() },
    ]);
  return (
    <div className="grid gap-2">
      {items.map((item, index) => (
        <div
          key={item.id}
          className="grid gap-2 rounded-md bg-surface-base p-2"
        >
          <LabelPicker
            value={item.labelOverrideUnitId ?? ""}
            label={getI18nRuntime().i18n.t(
              "entity:realm_dock_editor_label_override",
            )}
            optional
            onSelect={(labelOverrideUnitId) => {
              const next = [...items];
              next[index] = labelOverrideUnitId
                ? { ...item, labelOverrideUnitId }
                : (({ labelOverrideUnitId: _label, ...rest }) => rest)(item);
              onChange(next);
            }}
          />
          <ExternalTargetEditor
            url={item.target.kind === "external" ? item.target.url : ""}
            onChange={(url) => {
              const next = [...items];
              next[index] = { ...item, target: externalTarget(url) };
              onChange(next);
            }}
          />
          <DeleteRowButton
            onClick={() =>
              onChange(items.filter((_, itemIndex) => itemIndex !== index))
            }
          />
        </div>
      ))}
      <Button type="button" size="sm" variant="secondary" onClick={addLink}>
        <Link className="size-4" />
        {getI18nRuntime().i18n.t("entity:realm_dock_editor_add_bookmark")}
      </Button>
    </div>
  );
}

function ExternalTargetEditor({
  url,
  onChange,
}: {
  url: string;
  onChange: (url: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label>
        {getI18nRuntime().i18n.t("entity:realm_dock_editor_external_url")}
      </Label>
      <Input
        value={url}
        onChange={(event) => onChange(event.target.value.trim())}
        placeholder="https://"
      />
    </div>
  );
}

function DeleteRowButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="justify-self-start"
      onClick={onClick}
    >
      <Trash2 className="size-4" />
      {getI18nRuntime().i18n.t("common:delete")}
    </Button>
  );
}
