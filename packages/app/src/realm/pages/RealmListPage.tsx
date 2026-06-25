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
import { useLeaveRealmMutation } from "@rezics/contract/api/realm/realm.mutations";
import { realmQueries } from "@rezics/contract/api/realm/realm.queries";
import {
  usePinSubscriptionListEntryMutation,
  useReorderSubscriptionListEntriesMutation,
} from "@rezics/contract/api/subscription/subscription.mutations";
import { mySubscriptionListEntriesQuery } from "@rezics/contract/api/subscription/subscription.queries";
import { userQueries } from "@rezics/contract/api/user/user.queries";
import type {
  UserSubscriptionListEntryDTO,
  UserSubscriptionListSort,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Badge,
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
import { useNavigate } from "@tanstack/react-router";
import { GripVerticalIcon, PinIcon } from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { Link, unitHref } from "@/shared/ui/link";
import {
  mapJoinedRealmToListItem,
  type RealmListItemModel,
  selectHasMemberSession,
  useAuthSessionStore,
} from "@/user";
import { useUserScopedWorkspaceTarget } from "@/user/hooks/useUserScopedWorkspaceTarget";
import {
  DEFAULT_SUBSCRIPTION_LIST_SORT,
  isManualSubscriptionListSort,
  normalizeSubscriptionListSort,
  reorderSubscriptionListItems,
  SUBSCRIPTION_LIST_SORTS,
  sortSubscriptionListItems,
} from "@/user/models/subscriptionListOrdering";
import {
  selectedRealmItems,
  toggleRealmSelection,
} from "../models/realmBulkLeaveSelection";

type RealmWorkspaceTab = "joined" | "administered";

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
 * Realm 列表页面。用户查看已加入和管理的 realm，当前用户的已加入页支持排序切换、
 * 手动拖拽、固定置顶和批量离开。列表项使用默认 contained card。
 *
 * 窄屏时标题、搜索、排序 selector、管理开关和新建按钮纵向堆叠；宽屏时标题在左、
 * 控件在右且允许换行。列表行固定控件 shrink-0，主体 min-w-0 + truncate；
 * 过宽时外层 `w-full max-w-5xl mx-auto` 封顶居中。
 *
 * Mobile (<640px):
 * ┌──────────────────────────────────────────┐
 * │ Realms                                   │
 * │ Personal realm list                      │
 * │ [Search]                                 │
 * │ [Sort selector              v]           │
 * │ [ ] Manage                              │
 * │ [New realm]                              │
 * ├──────────────────────────────────────────┤
 * │ [Joined] [Administered]                  │
 * ├──────────────────────────────────────────┤
 * │ [Grip] [ ] Realm title       [Pin]       │
 * │            realm-slug                    │
 * └──────────────────────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌──────────────────────────────────────────┐
 * │ Realms        [Search] [Sort selector v] │
 * │ Personal list [ ] Manage [New realm]     │
 * ├──────────────────────────────────────────┤
 * │ [Joined] [Administered]                  │
 * ├──────────────────────────────────────────┤
 * │ [Grip] [ ] Realm title       [Pin]       │
 * │            realm-slug                    │
 * └──────────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌──────────────────────────────────────────┐
 * │ Realms        [Search] [Sort selector v] │
 * │ Personal list [ ] Manage [New realm]     │
 * ├──────────────────────────────────────────┤
 * │ [Joined] [Administered]                  │
 * ├──────────────────────────────────────────┤
 * │ [Grip] [ ] Realm title       members  P  │
 * │            Description preview           │
 * └──────────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * ┌──────────────────────────────────────────┐
 * │       Realms       [Search] [Sort v]     │
 * │       Personal list [ ] Manage [New]     │
 * ├──────────────────────────────────────────┤
 * │       [Joined] [Administered]            │
 * │       Contained cards centered in max    │
 * └──────────────────────────────────────────┘
 */
export function RealmListPage() {
  const { t } = useTranslation(["common", "entity", "settings"]);
  const navigate = useNavigate();
  const hasMemberSession = useAuthSessionStore(selectHasMemberSession);
  const target = useUserScopedWorkspaceTarget();
  const readContext = useReadLanguageContext();
  const [activeTab, setActiveTab] = useState<RealmWorkspaceTab>("joined");
  const [manageMode, setManageMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const canManageList = target.isCurrentUser && activeTab === "joined";
  const settingsQuery = useQuery({
    ...userQueries.settings(),
    enabled: hasMemberSession,
  });
  const defaultSort = normalizeSubscriptionListSort(
    settingsQuery.data?.subscriptionLists?.realms?.defaultSort ??
      DEFAULT_SUBSCRIPTION_LIST_SORT,
  );
  const [sort, setSort] = useState<UserSubscriptionListSort>(
    DEFAULT_SUBSCRIPTION_LIST_SORT,
  );
  const leaveRealm = useLeaveRealmMutation({
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
    ...realmQueries.byMember(target.targetUserId ?? "", {
      view: activeTab === "administered" ? "managing" : "joined",
      languages: readContext.languages,
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
      subscribedType: "REALM",
      sort,
      languages: readContext.languages.length
        ? readContext.languages.join(",")
        : undefined,
      appLocale: readContext.appLocale,
      limit: 100,
    }),
    enabled:
      target.isCurrentUser &&
      activeTab === "joined" &&
      readContext.ready &&
      !target.isLoading,
  });

  const realms = useMemo(
    () => query.data?.realms.map(mapJoinedRealmToListItem) ?? [],
    [query.data?.realms],
  );
  const entries = useMemo(
    () => sortSubscriptionListItems(entriesQuery.data?.entries ?? [], sort),
    [entriesQuery.data?.entries, sort],
  );
  const selectedRealms = selectedRealmItems(realms, selectedIds);
  const selectedEntries = useMemo(
    () => entries.filter((entry) => selectedIds.has(entry.subscribedUnitId)),
    [entries, selectedIds],
  );
  const usingEntries = target.isCurrentUser && activeTab === "joined";
  const selectedCount = usingEntries
    ? selectedEntries.length
    : selectedRealms.length;
  const isLeaving = leaveRealm.isPending;
  const manualSort = isManualSubscriptionListSort(sort);

  const handleToggleRealm = (realmId: string) => {
    setSelectedIds((current) => toggleRealmSelection(current, realmId));
  };

  const handleLeaveSelected = async () => {
    try {
      const selectedUnitIds = usingEntries
        ? selectedEntries.map((entry) => entry.subscribedUnitId)
        : selectedRealms.map((realm) => realm.unitId);
      await Promise.all(
        selectedUnitIds.map((unitId) => leaveRealm.mutateAsync(unitId)),
      );
      setConfirmOpen(false);
      setManageMode(false);
    } catch {
      // Show toast on partial or total failure; keep dialog open for retry.
      // 部分或全部失败时弹出提示；保持对话框打开以便重试。
      toast.error(t("entity:realm_list_leave_failed"));
    }
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
          {t("entity:realm_list_title")}
        </h1>
        <p className="text-sm leading-ui text-text-secondary">
          {t("entity:realm_list_sign_in_prompt")}
        </p>
        <div>
          <Button onClick={() => navigate({ to: "/login" })}>
            {t("common:sign_in")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold leading-ui">
            {t("entity:realm_list_title")}
          </h1>
          <p className="mt-1 text-sm leading-ui text-text-secondary">
            {t("entity:realm_list_subtitle")}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-0 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button
            variant="ghost"
            onClick={() => navigate({ to: "/realm/search" })}
          >
            {t("common:search")}
          </Button>
          {canManageList && (
            <Select
              value={sort}
              onValueChange={(value) =>
                setSort(normalizeSubscriptionListSort(value))
              }
            >
              <SelectTrigger className="w-full sm:w-56">
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
              htmlFor="realm-list-manage-mode"
              className="flex items-center gap-2 rounded-md px-2 text-sm leading-ui text-text-secondary"
            >
              <Checkbox
                id="realm-list-manage-mode"
                checked={manageMode}
                onCheckedChange={(checked) => {
                  setManageMode(Boolean(checked));
                  setSelectedIds(new Set());
                }}
              />
              {t("entity:realm_list_manage")}
            </label>
          )}
          {hasMemberSession && (
            <Button onClick={() => navigate({ to: "/realm/new" })}>
              {t("entity:realm_new_title")}
            </Button>
          )}
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as RealmWorkspaceTab)}
      >
        <TabsList className="mb-4">
          <TabsTrigger value="joined">
            {t("entity:realm_list_tab_joined")}
          </TabsTrigger>
          <TabsTrigger value="administered">
            {t("entity:realm_list_tab_administered")}
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
              {t("settings:profile_realms_load_failed")}
            </p>
          ) : (usingEntries ? entries.length : realms.length) === 0 ? (
            <p className="py-8 text-center text-sm leading-ui text-text-secondary">
              {activeTab === "joined"
                ? t("settings:profile_realms_none_joined")
                : t("settings:profile_realms_none_managing")}
            </p>
          ) : usingEntries ? (
            <div className="flex flex-col gap-2">
              {manageMode && (
                <div className="flex items-center justify-between gap-3 border-y border-border-whisper py-3">
                  <p className="text-sm leading-ui text-text-secondary">
                    {t("entity:realm_list_selected_count", {
                      count: selectedCount,
                    })}
                  </p>
                  <Button
                    variant="destructive"
                    disabled={selectedCount === 0 || isLeaving}
                    onClick={() => setConfirmOpen(true)}
                  >
                    {t("entity:realm_leave")}
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
                        handleToggleRealm(entry.subscribedUnitId)
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
                    {t("entity:realm_list_selected_count", {
                      count: selectedCount,
                    })}
                  </p>
                  <Button
                    variant="destructive"
                    disabled={selectedCount === 0 || isLeaving}
                    onClick={() => setConfirmOpen(true)}
                  >
                    {t("entity:realm_leave")}
                  </Button>
                </div>
              )}
              {realms.map((realm) => (
                <RealmManagementListItem
                  key={realm.unitId}
                  realm={realm}
                  manageMode={manageMode}
                  selected={selectedIds.has(realm.unitId)}
                  onToggle={() => handleToggleRealm(realm.unitId)}
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
              {t("entity:realm_list_leave_confirm_title")}
            </DialogTitle>
            <DialogDescription>
              {t("entity:realm_list_leave_confirm_description", {
                count: selectedCount,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button
              variant="destructive"
              disabled={selectedCount === 0 || isLeaving}
              onClick={() => void handleLeaveSelected()}
            >
              {t("entity:realm_leave")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RealmManagementListItem({
  realm,
  manageMode,
  selected,
  onToggle,
}: {
  realm: RealmListItemModel;
  manageMode: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation(["entity"]);
  const content = (
    <Card surface="contained" size="sm" className="p-4">
      <div className="flex items-start gap-3">
        {manageMode && (
          <Checkbox
            checked={selected}
            onCheckedChange={onToggle}
            onClick={(event) => event.stopPropagation()}
            aria-label={t("entity:realm_list_select_realm", {
              name: realm.title,
            })}
            className="mt-1"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-medium leading-ui text-text-primary">
              {realm.title}
            </span>
            {realm.isOfficial && (
              <Badge variant="outline" className="text-text-brand">
                {t("entity:realm_official")}
              </Badge>
            )}
            {!realm.isPublic && (
              <Badge variant="outline">{t("entity:realm_private")}</Badge>
            )}
          </div>
          {realm.description && (
            <p className="mt-1 line-clamp-2 text-sm leading-ui text-text-secondary">
              {realm.description}
            </p>
          )}
        </div>
        <span className="shrink-0 text-sm leading-ui text-text-secondary">
          {t("entity:realm_member_count", { count: realm.memberCount })}
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
      to={unitHref({
        type: "REALM",
        unitId: realm.unitId,
        slug: realm.slug,
      })}
      className="no-underline"
    >
      {content}
    </Link>
  );
}

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
  const { t } = useTranslation(["entity"]);
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
    type: "REALM",
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
              aria-label={t("entity:realm_list_drag_reorder")}
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
              aria-label={t("entity:realm_list_select_realm", {
                name: title,
              })}
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
              entry.pinned
                ? t("entity:realm_list_unpin")
                : t("entity:realm_list_pin")
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
