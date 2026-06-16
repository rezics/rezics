import {
  meiliLabelSearchQueryOptions,
  postSearchQueryOptions,
  realmSearchQueryOptions,
  zoneSearchQueryOptions,
} from "@rezics/api/meili/meili.queries";
import { realmSidebarQuery } from "@rezics/api/realm/realm-sidebar.queries";
import { useUpdateRealmSidebarMutation } from "@rezics/api/realm/realm-sidebar.mutations";
import type {
  LabelSearchDocument,
  PostSearchDocument,
  RealmSidebar,
  RealmSidebarButtonItem,
  RealmSidebarImageItem,
  RealmSidebarPlacement,
  RealmSidebarStatsMetric,
  RealmSidebarWidget,
  RealmSearchDocument,
  ZoneSearchDocument,
} from "@rezics/contract";
import {
  emptyRealmSidebar,
  realmSidebarPlacementValues,
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
  "rules",
  "buttons",
  "images",
  "communityList",
  "calendar",
  "featuredZone",
  "zoneNav",
  "stats",
  "pinboard",
] as const satisfies readonly RealmSidebarWidget["kind"][];

const statMetrics = [
  "members",
  "posts",
  "wikiPages",
] as const satisfies readonly RealmSidebarStatsMetric[];

function copySidebar(sidebar: RealmSidebar | undefined): RealmSidebar {
  return structuredClone(sidebar ?? emptyRealmSidebar());
}

function widgetId(kind: RealmSidebarWidget["kind"]) {
  return `sidebar-${kind}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function newWidget(kind: RealmSidebarWidget["kind"]): RealmSidebarWidget {
  const id = widgetId(kind);
  switch (kind) {
    case "text":
      return { id, kind, contentUnitId: "" };
    case "rules":
      return { id, kind, mode: "summary" };
    case "buttons":
      return { id, kind, items: [] };
    case "images":
      return { id, kind, items: [] };
    case "communityList":
      return { id, kind, realmUnitIds: [] };
    case "calendar":
      return { id, kind, source: "realmPosts" };
    case "featuredZone":
      return { id, kind, zoneUnitId: "" };
    case "zoneNav":
      return { id, kind, zoneUnitId: "" };
    case "stats":
      return { id, kind, metrics: ["members"] };
    case "pinboard":
      return { id, kind, pinboardKey: "home" };
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

function placementLabel(placement: RealmSidebarPlacement) {
  switch (placement) {
    case "home":
      return getI18nRuntime().i18n.t("entity:realm_sidebar_placement_home");
    case "wiki":
      return getI18nRuntime().i18n.t("entity:realm_sidebar_placement_wiki");
    case "about":
      return getI18nRuntime().i18n.t("entity:realm_sidebar_placement_about");
  }
}

function widgetKindLabel(kind: RealmSidebarWidget["kind"]) {
  switch (kind) {
    case "text":
      return getI18nRuntime().i18n.t("entity:realm_sidebar_widget_text");
    case "rules":
      return getI18nRuntime().i18n.t("entity:realm_sidebar_widget_rules");
    case "buttons":
      return getI18nRuntime().i18n.t("entity:realm_sidebar_widget_buttons");
    case "images":
      return getI18nRuntime().i18n.t("entity:realm_sidebar_widget_images");
    case "communityList":
      return getI18nRuntime().i18n.t(
        "entity:realm_sidebar_widget_communityList",
      );
    case "calendar":
      return getI18nRuntime().i18n.t("entity:realm_sidebar_widget_calendar");
    case "featuredZone":
      return getI18nRuntime().i18n.t(
        "entity:realm_sidebar_widget_featuredZone",
      );
    case "zoneNav":
      return getI18nRuntime().i18n.t("entity:realm_sidebar_widget_zoneNav");
    case "stats":
      return getI18nRuntime().i18n.t("entity:realm_sidebar_widget_stats");
    case "pinboard":
      return getI18nRuntime().i18n.t("entity:realm_sidebar_widget_pinboard");
  }
}

function metricLabel(metric: RealmSidebarStatsMetric) {
  switch (metric) {
    case "members":
      return getI18nRuntime().i18n.t("entity:realm_sidebar_metric_members");
    case "posts":
      return getI18nRuntime().i18n.t("entity:realm_sidebar_metric_posts");
    case "wikiPages":
      return getI18nRuntime().i18n.t("entity:realm_sidebar_metric_wikiPages");
  }
}

function isComplete(widget: RealmSidebarWidget) {
  switch (widget.kind) {
    case "text":
      return Boolean(widget.contentUnitId);
    case "featuredZone":
    case "zoneNav":
      return Boolean(widget.zoneUnitId);
    case "buttons":
      return widget.items.every((item) => item.labelUnitId && item.target.url);
    case "images":
      return widget.items.every((item) => item.imageUrl);
    case "communityList":
      return true;
    default:
      return true;
  }
}

function upsertPlacement(
  sidebar: RealmSidebar,
  placement: RealmSidebarPlacement,
  widgets: RealmSidebarWidget[],
): RealmSidebar {
  return {
    ...sidebar,
    placements: {
      ...sidebar.placements,
      [placement]: widgets,
    },
  };
}

/**
 * Realm sidebar widget editor.
 *
 * Realm sidebar 编辑器：按 placement 管理 widget，所有实体引用通过搜索选择。
 *
 * Mobile (<640px):
 * ┌──────────────────────────┐
 * │ Placement tabs scroll    │
 * │ Add kind select          │
 * │ Widget cards stacked     │
 * │ Save                     │
 * └──────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │ Tabs + add controls full width     │
 * │ Widget rows with field editors     │
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌────────────────────────────────────────────┐
 * │ Single management column, stable row tools │
 * └────────────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * ┌────────────────────────────────────────────┐
 * │ Parent layout constrains width; no stretch │
 * └────────────────────────────────────────────┘
 */
export function RealmSidebarWidgetEditor({ realmId }: { realmId: string }) {
  const [placement, setPlacement] = useState<RealmSidebarPlacement>("home");
  const [draft, setDraft] = useState<RealmSidebar>(() => emptyRealmSidebar());
  const [addKind, setAddKind] = useState<RealmSidebarWidget["kind"]>("text");
  const [error, setError] = useState<string | null>(null);
  const { data } = useQuery(realmSidebarQuery(realmId));
  const updateSidebar = useUpdateRealmSidebarMutation();

  useEffect(() => {
    setDraft(copySidebar(data));
  }, [data]);

  const widgets = draft.placements[placement] ?? [];
  const incomplete = widgets.find((widget) => !isComplete(widget));

  const setWidgets = (nextWidgets: RealmSidebarWidget[]) => {
    setDraft((current) => upsertPlacement(current, placement, nextWidgets));
  };

  const updateWidget = (id: string, nextWidget: RealmSidebarWidget) => {
    setWidgets(
      widgets.map((widget) => (widget.id === id ? nextWidget : widget)),
    );
  };

  const addWidget = () => {
    setWidgets([...widgets, newWidget(addKind)]);
  };

  const moveWidget = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= widgets.length) return;
    const next = [...widgets];
    [next[index], next[target]] = [next[target], next[index]];
    setWidgets(next);
  };

  const removeWidget = (id: string) => {
    setWidgets(widgets.filter((widget) => widget.id !== id));
  };

  const save = async () => {
    setError(null);
    if (incomplete) {
      const message = getI18nRuntime().i18n.t(
        "entity:realm_sidebar_editor_incomplete",
      );
      setError(message);
      toast.error(message);
      return;
    }
    try {
      const saved = await updateSidebar.mutateAsync({
        realmId,
        sidebar: draft,
      });
      setDraft(copySidebar(saved));
      toast.success(
        getI18nRuntime().i18n.t("entity:realm_sidebar_editor_saved"),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(message);
      toast.error(message);
    }
  };

  return (
    <section className="flex flex-col gap-4 rounded-md bg-surface-subtle p-4">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium leading-ui text-text-primary">
          {getI18nRuntime().i18n.t("entity:realm_sidebar_editor_title")}
        </h3>
        <Tabs
          value={placement}
          onValueChange={(value) =>
            setPlacement(value as RealmSidebarPlacement)
          }
        >
          <TabsList className="w-full max-w-full justify-start overflow-x-auto">
            {realmSidebarPlacementValues.map((item) => (
              <TabsTrigger key={item} value={item} className="flex-none">
                {placementLabel(item)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="flex flex-col gap-1">
          <Label htmlFor="realm-sidebar-kind">
            {getI18nRuntime().i18n.t("entity:realm_sidebar_editor_add_kind")}
          </Label>
          <Select
            value={addKind}
            onValueChange={(value) =>
              setAddKind(value as RealmSidebarWidget["kind"])
            }
          >
            <SelectTrigger id="realm-sidebar-kind">
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
        {widgets.length ? (
          widgets.map((widget, index) => (
            <WidgetEditorCard
              key={widget.id}
              widget={widget}
              index={index}
              count={widgets.length}
              onChange={(nextWidget) => updateWidget(widget.id, nextWidget)}
              onMove={moveWidget}
              onRemove={() => removeWidget(widget.id)}
            />
          ))
        ) : (
          <p className="text-sm leading-body text-text-secondary">
            {getI18nRuntime().i18n.t("entity:realm_sidebar_editor_empty")}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {error ? (
          <p className="mr-auto text-sm leading-ui text-error-text">{error}</p>
        ) : null}
        <Button type="button" onClick={save} disabled={updateSidebar.isPending}>
          <Save className="size-4" />
          {getI18nRuntime().i18n.t("common:save")}
        </Button>
      </div>
    </section>
  );
}

function WidgetEditorCard({
  widget,
  index,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  widget: RealmSidebarWidget;
  index: number;
  count: number;
  onChange: (widget: RealmSidebarWidget) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-md border border-border-whisper bg-surface-base p-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-ui text-text-primary">
            {widgetKindLabel(widget.kind)}
          </p>
        </div>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={index === 0}
          onClick={() => onMove(index, -1)}
          aria-label={getI18nRuntime().i18n.t(
            "entity:realm_sidebar_editor_move_up",
          )}
        >
          <ArrowUp className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={index === count - 1}
          onClick={() => onMove(index, 1)}
          aria-label={getI18nRuntime().i18n.t(
            "entity:realm_sidebar_editor_move_down",
          )}
        >
          <ArrowDown className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={onRemove}
          aria-label={getI18nRuntime().i18n.t("common:delete")}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <LabelPicker
        value={widget.titleLabelUnitId ?? ""}
        onSelect={(titleLabelUnitId) =>
          onChange(
            titleLabelUnitId
              ? { ...widget, titleLabelUnitId }
              : (({ titleLabelUnitId: _title, ...rest }) =>
                  rest as RealmSidebarWidget)(widget),
          )
        }
        label={getI18nRuntime().i18n.t(
          "entity:realm_sidebar_editor_widget_title",
        )}
        optional
      />

      <WidgetSpecificFields widget={widget} onChange={onChange} />
    </article>
  );
}

function WidgetSpecificFields({
  widget,
  onChange,
}: {
  widget: RealmSidebarWidget;
  onChange: (widget: RealmSidebarWidget) => void;
}) {
  switch (widget.kind) {
    case "text":
      return (
        <PostPicker
          value={widget.contentUnitId}
          onSelect={(contentUnitId) => onChange({ ...widget, contentUnitId })}
          label={getI18nRuntime().i18n.t(
            "entity:realm_sidebar_editor_content_post",
          )}
        />
      );
    case "rules":
      return (
        <div className="flex flex-col gap-1">
          <Label>
            {getI18nRuntime().i18n.t("entity:realm_sidebar_editor_rule_mode")}
          </Label>
          <Select
            value={widget.mode ?? "summary"}
            onValueChange={(mode) =>
              onChange({
                ...widget,
                mode: mode as "summary" | "full",
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="summary">
                {getI18nRuntime().i18n.t(
                  "entity:realm_sidebar_editor_rule_summary",
                )}
              </SelectItem>
              <SelectItem value="full">
                {getI18nRuntime().i18n.t(
                  "entity:realm_sidebar_editor_rule_full",
                )}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
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
          {getI18nRuntime().i18n.t("entity:realm_sidebar_editor_calendar_note")}
        </p>
      );
    case "featuredZone":
      return (
        <ZonePicker
          value={widget.zoneUnitId}
          onSelect={(zoneUnitId) => onChange({ ...widget, zoneUnitId })}
          label={getI18nRuntime().i18n.t("entity:realm_sidebar_editor_zone")}
        />
      );
    case "zoneNav":
      return (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,14rem)]">
          <ZonePicker
            value={widget.zoneUnitId}
            onSelect={(zoneUnitId) => onChange({ ...widget, zoneUnitId })}
            label={getI18nRuntime().i18n.t("entity:realm_sidebar_editor_zone")}
          />
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${widget.id}-menu`}>
              {getI18nRuntime().i18n.t("entity:realm_sidebar_editor_menu_id")}
            </Label>
            <Input
              id={`${widget.id}-menu`}
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
                variant={active ? "secondary" : "outline"}
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
          {getI18nRuntime().i18n.t("entity:realm_sidebar_editor_pinboard_note")}
        </p>
      );
  }
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
            "entity:realm_sidebar_editor_search",
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
          {getI18nRuntime().i18n.t("entity:realm_sidebar_editor_selected")}
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
        label={getI18nRuntime().i18n.t("entity:realm_sidebar_editor_community")}
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
              {getI18nRuntime().i18n.t("entity:realm_sidebar_editor_selected")}
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
  items: RealmSidebarButtonItem[];
  onChange: (items: RealmSidebarButtonItem[]) => void;
}) {
  const addItem = () =>
    onChange([
      ...items,
      { labelUnitId: "", target: { kind: "external", url: "", text: "" } },
    ]);

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => (
        <div
          key={index}
          className="grid gap-3 rounded-md bg-surface-subtle p-3"
        >
          <LabelPicker
            value={item.labelUnitId}
            label={getI18nRuntime().i18n.t(
              "entity:realm_sidebar_editor_button_label",
            )}
            onSelect={(labelUnitId) => {
              const next = [...items];
              next[index] = { ...item, labelUnitId };
              onChange(next);
            }}
          />
          <ExternalTargetEditor
            url={item.target.kind === "external" ? item.target.url : ""}
            onChange={(url) => {
              const next = [...items];
              next[index] = {
                ...item,
                target: { kind: "external", url, text: url },
              };
              onChange(next);
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="justify-self-start"
            onClick={() =>
              onChange(items.filter((_, itemIndex) => itemIndex !== index))
            }
          >
            <Trash2 className="size-4" />
            {getI18nRuntime().i18n.t("common:delete")}
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="secondary" onClick={addItem}>
        <Link className="size-4" />
        {getI18nRuntime().i18n.t("entity:realm_sidebar_editor_add_button")}
      </Button>
    </div>
  );
}

function ImageItemsEditor({
  items,
  onChange,
}: {
  items: RealmSidebarImageItem[];
  onChange: (items: RealmSidebarImageItem[]) => void;
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
            <Label htmlFor={`sidebar-image-${index}`}>
              {getI18nRuntime().i18n.t("entity:realm_sidebar_editor_image_url")}
            </Label>
            <Input
              id={`sidebar-image-${index}`}
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
            value={item.altLabelUnitId ?? ""}
            label={getI18nRuntime().i18n.t(
              "entity:realm_sidebar_editor_image_alt",
            )}
            optional
            onSelect={(altLabelUnitId) => {
              const next = [...items];
              next[index] = altLabelUnitId
                ? { ...item, altLabelUnitId }
                : (({ altLabelUnitId: _alt, ...rest }) => rest)(item);
              onChange(next);
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="justify-self-start"
            onClick={() =>
              onChange(items.filter((_, itemIndex) => itemIndex !== index))
            }
          >
            <Trash2 className="size-4" />
            {getI18nRuntime().i18n.t("common:delete")}
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="secondary" onClick={addItem}>
        <ImagePlus className="size-4" />
        {getI18nRuntime().i18n.t("entity:realm_sidebar_editor_add_image")}
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
        {getI18nRuntime().i18n.t("entity:realm_sidebar_editor_external_url")}
      </Label>
      <Input
        value={url}
        onChange={(event) => onChange(event.target.value.trim())}
        placeholder="https://"
      />
    </div>
  );
}
