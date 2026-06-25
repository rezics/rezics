import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  usePinSubscriptionListEntryMutation,
  useReorderSubscriptionListEntriesMutation,
  useUnsubscribeMutation,
} from "@rezics/contract/api/subscription/subscription.mutations";
import { mySubscriptionListEntriesQuery } from "@rezics/contract/api/subscription/subscription.queries";
import { userQueries } from "@rezics/contract/api/user/user.queries";
import { zoneQueries } from "@rezics/contract/api/zone/zone.queries";
import type {
  UserSubscriptionListEntryDTO,
  UserSubscriptionListSort,
  ZoneDTO,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { GripVerticalIcon, PinIcon } from "lucide-react";
import {
  type CSSProperties,
  type FC,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { Link, unitHref } from "@/shared/ui/link";
import { selectHasMemberSession, useAuthSessionStore } from "@/user";
import { useUserScopedWorkspaceTarget } from "@/user/hooks/useUserScopedWorkspaceTarget";
import {
  DEFAULT_SUBSCRIPTION_LIST_SORT,
  isManualSubscriptionListSort,
  normalizeSubscriptionListSort,
  reorderSubscriptionListItems,
  SUBSCRIPTION_LIST_SORTS,
  sortSubscriptionListItems,
} from "@/user/models/subscriptionListOrdering";

type ZoneWorkspaceTab = "subscribed" | "administered";

function subscriptionListSortLabel(
  t: (key: string) => string,
  sort: UserSubscriptionListSort,
): string {
  switch (sort) {
    case "manualDesc":
      return t("settings:preferences_subscription_lists_sort_manualDesc");
    case "addedDesc":
      return t("settings:preferences_subscription_lists_sort_addedDesc");
    case "addedAsc":
      return t("settings:preferences_subscription_lists_sort_addedAsc");
    default:
      return t("settings:preferences_subscription_lists_sort_manualAsc");
  }
}

/**
 * 领域列表页面。用户查看已订阅和管理的领域，当前用户的订阅页支持排序切换、
 * 手动拖拽、固定置顶和批量退订。列表项使用默认 contained card。
 *
 * 窄屏时标题、排序 selector、管理开关纵向堆叠；宽屏时标题在左、控件在右。
 * 同行元素的固定控件 shrink-0，标题内容 min-w-0 + truncate；过宽时外层
 * `w-full max-w-5xl mx-auto` 封顶居中。
 *
 * Mobile (<640px):
 * ┌──────────────────────────────────────────┐
 * │ Zones                                    │
 * │ Personal zone list                       │
 * │ [Sort selector              v]           │
 * │ [ ] Manage                              │
 * ├──────────────────────────────────────────┤
 * │ [Subscribed] [Administered]              │
 * ├──────────────────────────────────────────┤
 * │ [Grip] [ ] Zone title        [Pin]       │
 * │            zone-slug                     │
 * └──────────────────────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌──────────────────────────────────────────┐
 * │ Zones                 [Sort selector v]  │
 * │ Personal zone list    [ ] Manage         │
 * ├──────────────────────────────────────────┤
 * │ [Subscribed] [Administered]              │
 * ├──────────────────────────────────────────┤
 * │ [Grip] [ ] Zone title        [Pin]       │
 * │            zone-slug                     │
 * └──────────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌──────────────────────────────────────────┐
 * │ Zones                 [Sort selector v]  │
 * │ Personal zone list    [ ] Manage         │
 * ├──────────────────────────────────────────┤
 * │ [Subscribed] [Administered]              │
 * ├──────────────────────────────────────────┤
 * │ [Grip] [ ] Zone title        zone-slug P │
 * │            Description preview           │
 * └──────────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * ┌──────────────────────────────────────────┐
 * │       Zones         [Sort selector v]    │
 * │       Personal zone list [ ] Manage      │
 * ├──────────────────────────────────────────┤
 * │       [Subscribed] [Administered]        │
 * │       Contained cards centered in max    │
 * └──────────────────────────────────────────┘
 */
export function ZoneListPage() {
  const { t } = useTranslation(["common", "settings", "zone"]);
  const hasMemberSession = useAuthSessionStore(selectHasMemberSession);
  const target = useUserScopedWorkspaceTarget();
  const readContext = useReadLanguageContext();
  const [activeTab, setActiveTab] = useState<ZoneWorkspaceTab>("subscribed");
  const [manageMode, setManageMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const canManageList = target.isCurrentUser && activeTab === "subscribed";
  const settingsQuery = useQuery({
    ...userQueries.settings(),
    enabled: hasMemberSession,
  });
  const defaultSort = normalizeSubscriptionListSort(
    settingsQuery.data?.subscriptionLists?.zones?.defaultSort ??
      DEFAULT_SUBSCRIPTION_LIST_SORT,
  );
  const [sort, setSort] = useState<UserSubscriptionListSort>(
    DEFAULT_SUBSCRIPTION_LIST_SORT,
  );
  const unsubscribe = useUnsubscribeMutation({
    onSuccess: () => {
      setSelectedIds(new Set());
    },
  });
  const reorderEntries = useReorderSubscriptionListEntriesMutation();
  const pinEntry = usePinSubscriptionListEntryMutation();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    if (!canManageList) {
      setManageMode(false);
      setSelectedIds(new Set());
    }
  }, [canManageList]);

  useEffect(() => {
    setSort(defaultSort);
  }, [defaultSort]);

  const query = useQuery({
    ...zoneQueries.byUser(target.targetUserId ?? "", {
      view: activeTab === "administered" ? "managing" : "subscribed",
      languages: readContext.languages.length
        ? readContext.languages.join(",")
        : undefined,
      appLocale: readContext.appLocale,
      limit: 50,
    }),
    enabled:
      Boolean(target.targetUserId) &&
      readContext.ready &&
      !target.isLoading &&
      (!target.isCurrentUser || activeTab === "administered"),
  });
  const entriesQuery = useQuery({
    ...mySubscriptionListEntriesQuery({
      subscribedType: "ZONE",
      sort,
      languages: readContext.languages.length
        ? readContext.languages.join(",")
        : undefined,
      appLocale: readContext.appLocale,
      limit: 100,
    }),
    enabled:
      target.isCurrentUser &&
      activeTab === "subscribed" &&
      readContext.ready &&
      !target.isLoading,
  });

  const zones = query.data?.zones ?? [];
  const entries = useMemo(
    () => sortSubscriptionListItems(entriesQuery.data?.entries ?? [], sort),
    [entriesQuery.data?.entries, sort],
  );
  const selectedZones = useMemo(
    () => zones.filter((zone) => selectedIds.has(zone.unitId)),
    [selectedIds, zones],
  );
  const selectedEntries = useMemo(
    () => entries.filter((entry) => selectedIds.has(entry.subscribedUnitId)),
    [entries, selectedIds],
  );
  const usingEntries = target.isCurrentUser && activeTab === "subscribed";
  const selectedCount = usingEntries
    ? selectedEntries.length
    : selectedZones.length;
  const isUnsubscribing = unsubscribe.isPending;
  const manualSort = isManualSubscriptionListSort(sort);

  const toggleZone = (zoneUnitId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(zoneUnitId)) next.delete(zoneUnitId);
      else next.add(zoneUnitId);
      return next;
    });
  };

  const handleUnsubscribeSelected = async () => {
    const selectedUnitIds = usingEntries
      ? selectedEntries.map((entry) => entry.subscribedUnitId)
      : selectedZones.map((zone) => zone.unitId);
    await Promise.all(
      selectedUnitIds.map((unitId) => unsubscribe.mutateAsync(unitId)),
    );
    setConfirmOpen(false);
    setManageMode(false);
  };

  const handleEntryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const updates = reorderSubscriptionListItems({
      visualItems: entries.map((entry) => ({
        id: entry.subscribedUnitId,
        pinned: entry.pinned,
        position: entry.position,
        createdAt: entry.createdAt,
      })),
      activeId: String(active.id),
      overId: String(over.id),
      selectedIds: manageMode ? selectedIds : new Set<string>(),
      sort,
    });
    if (updates.length === 0) return;
    reorderEntries.mutate({
      entries: updates.map((entry) => ({
        subscribedUnitId: entry.id,
        position: entry.position,
      })),
    });
  };

  if (!target.targetUserId && !target.isLoading && !hasMemberSession) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-12">
        <h1 className="text-2xl font-semibold leading-ui">
          {t("zone:list_title")}
        </h1>
        <p className="text-sm leading-ui text-text-secondary">
          {t("zone:list_sign_in_prompt")}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold leading-ui">
            {t("zone:list_title")}
          </h1>
          <p className="mt-1 text-sm leading-ui text-text-secondary">
            {t("zone:list_subtitle")}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-64">
          {canManageList && (
            <Select
              value={sort}
              onValueChange={(value) =>
                setSort(normalizeSubscriptionListSort(value))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUBSCRIPTION_LIST_SORTS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {subscriptionListSortLabel(t, option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {canManageList && (
            <label
              htmlFor="zone-list-manage-mode"
              className="flex items-center gap-2 rounded-md px-2 text-sm leading-ui text-text-secondary"
            >
              <Checkbox
                id="zone-list-manage-mode"
                checked={manageMode}
                onCheckedChange={(checked) => {
                  setManageMode(Boolean(checked));
                  setSelectedIds(new Set());
                }}
              />
              {t("zone:list_manage")}
            </label>
          )}
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as ZoneWorkspaceTab)}
      >
        <TabsList className="mb-4">
          <TabsTrigger value="subscribed">
            {t("zone:list_tab_subscribed")}
          </TabsTrigger>
          <TabsTrigger value="administered">
            {t("zone:list_tab_administered")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab}>
          {target.isLoading ||
          (usingEntries ? entriesQuery.isLoading : query.isLoading) ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : target.error ||
            (usingEntries ? entriesQuery.error : query.error) ? (
            <p className="py-8 text-center text-sm leading-ui text-error-text">
              {t("settings:profile_zones_load_failed")}
            </p>
          ) : (usingEntries ? entries.length : zones.length) === 0 ? (
            <p className="py-8 text-center text-sm leading-ui text-text-secondary">
              {activeTab === "subscribed"
                ? t("settings:profile_zones_none_subscribed")
                : t("settings:profile_zones_none_managing")}
            </p>
          ) : usingEntries ? (
            <div className="flex flex-col gap-2">
              {manageMode && (
                <div className="flex items-center justify-between gap-3 border-y border-border-whisper py-3">
                  <p className="text-sm leading-ui text-text-secondary">
                    {t("zone:list_selected_count", { count: selectedCount })}
                  </p>
                  <Button
                    variant="destructive"
                    disabled={selectedCount === 0 || isUnsubscribing}
                    onClick={() => setConfirmOpen(true)}
                  >
                    {t("zone:list_unsubscribe")}
                  </Button>
                </div>
              )}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={handleEntryDragEnd}
              >
                <SortableContext
                  items={entries.map((entry) => entry.subscribedUnitId)}
                  strategy={verticalListSortingStrategy}
                >
                  {entries.map((entry) => (
                    <SubscriptionEntryListItem
                      key={entry.subscribedUnitId}
                      entry={entry}
                      manualSort={manualSort}
                      manageMode={manageMode}
                      selected={selectedIds.has(entry.subscribedUnitId)}
                      busy={reorderEntries.isPending || pinEntry.isPending}
                      onToggleSelected={() =>
                        toggleZone(entry.subscribedUnitId)
                      }
                      onTogglePin={() =>
                        pinEntry.mutate({
                          subscribedUnitId: entry.subscribedUnitId,
                          input: { pinned: !entry.pinned },
                        })
                      }
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {manageMode && (
                <div className="flex items-center justify-between gap-3 border-y border-border-whisper py-3">
                  <p className="text-sm leading-ui text-text-secondary">
                    {t("zone:list_selected_count", { count: selectedCount })}
                  </p>
                  <Button
                    variant="destructive"
                    disabled={selectedCount === 0 || isUnsubscribing}
                    onClick={() => setConfirmOpen(true)}
                  >
                    {t("zone:list_unsubscribe")}
                  </Button>
                </div>
              )}
              {zones.map((zone) => (
                <ZoneManagementListItem
                  key={zone.unitId}
                  zone={zone}
                  manageMode={manageMode}
                  selected={selectedIds.has(zone.unitId)}
                  onToggle={() => toggleZone(zone.unitId)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("zone:list_unsubscribe_confirm_title")}
            </DialogTitle>
            <DialogDescription>
              {t("zone:list_unsubscribe_confirm_description", {
                count: selectedCount,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button
              variant="destructive"
              disabled={selectedCount === 0 || isUnsubscribing}
              onClick={() => void handleUnsubscribeSelected()}
            >
              {t("zone:list_unsubscribe")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const ZoneManagementListItem: FC<{
  zone: ZoneDTO;
  manageMode: boolean;
  selected: boolean;
  onToggle: () => void;
}> = ({ zone, manageMode, selected, onToggle }) => {
  const { t } = useTranslation(["zone"]);
  const zoneName = zone.name || zone.slug;
  const content = (
    <Card surface="contained" size="sm" className="p-4">
      <div className="flex items-start gap-3">
        {manageMode && (
          <Checkbox
            checked={selected}
            onCheckedChange={onToggle}
            onClick={(event) => event.stopPropagation()}
            aria-label={t("zone:list_select_zone", { name: zoneName })}
            className="mt-1"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-medium leading-ui text-text-primary">
              {zoneName}
            </span>
          </div>
          {zone.description && (
            <p className="mt-1 line-clamp-2 text-sm leading-ui text-text-secondary">
              {zone.description}
            </p>
          )}
        </div>
        <span className="shrink-0 text-sm leading-ui text-text-secondary">
          {zone.slug}
        </span>
      </div>
    </Card>
  );

  if (manageMode) {
    return (
      <button
        type="button"
        className="w-full border-0 bg-transparent p-0 text-left"
        onClick={onToggle}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      to={unitHref({ type: "ZONE", unitId: zone.unitId, slug: zone.slug })}
      className="no-underline"
    >
      {content}
    </Link>
  );
};

function SubscriptionEntryListItem({
  entry,
  manualSort,
  manageMode,
  selected,
  busy,
  onToggleSelected,
  onTogglePin,
}: {
  entry: UserSubscriptionListEntryDTO;
  manualSort: boolean;
  manageMode: boolean;
  selected: boolean;
  busy: boolean;
  onToggleSelected: () => void;
  onTogglePin: () => void;
}) {
  const { t } = useTranslation(["common", "zone"]);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: entry.subscribedUnitId,
    disabled: !manualSort || busy,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
  };
  const title = entry.subscribedTitle ?? entry.subscribedUnitId;
  const href = unitHref({
    type: "ZONE",
    unitId: entry.subscribedUnitId,
    slug: entry.subscribedSlug ?? null,
  });
  const body = (
    <div className="min-w-0 flex-1 text-left">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="min-w-0 truncate text-base font-medium leading-ui text-text-primary">
          {title}
        </span>
      </div>
      {entry.subscribedSlug && (
        <p className="mt-1 truncate text-sm leading-ui text-text-secondary">
          {entry.subscribedSlug}
        </p>
      )}
    </div>
  );

  return (
    <div ref={setNodeRef} style={style}>
      <Card surface="contained" size="sm" className="p-4">
        <div className="flex items-start gap-3">
          {manualSort && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 cursor-grab touch-none"
              disabled={busy}
              aria-label={t("zone:list_drag_reorder")}
              {...attributes}
              {...listeners}
            >
              <GripVerticalIcon className="h-4 w-4" />
            </Button>
          )}
          {manageMode && (
            <Checkbox
              checked={selected}
              onCheckedChange={onToggleSelected}
              aria-label={t("zone:list_select_zone", { name: title })}
              className="mt-2 shrink-0"
            />
          )}
          {manageMode ? (
            <button
              type="button"
              className="min-w-0 flex-1 border-0 bg-transparent p-0"
              onClick={onToggleSelected}
            >
              {body}
            </button>
          ) : (
            <Link to={href} className="min-w-0 flex-1 no-underline">
              {body}
            </Link>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            disabled={busy}
            onClick={onTogglePin}
            aria-label={
              entry.pinned ? t("zone:list_unpin") : t("zone:list_pin")
            }
          >
            <PinIcon
              className={
                entry.pinned
                  ? "h-4 w-4 fill-current text-text-brand"
                  : "h-4 w-4"
              }
            />
          </Button>
        </div>
      </Card>
    </div>
  );
}
