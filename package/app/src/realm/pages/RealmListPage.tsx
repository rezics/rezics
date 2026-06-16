import { useLeaveRealmMutation } from "@rezics/api/realm/realm.mutations";
import { realmQueries } from "@rezics/api/realm/realm.queries";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  selectedRealmItems,
  toggleRealmSelection,
} from "../models/realmBulkLeaveSelection";

type RealmWorkspaceTab = "joined" | "administered";

/**
 * Realm list page with tabbed workspace view (joined/administered) and bulk leave management.
 * 专区列表页，带标签页工作区视图（已加入/已管理）和批量离开管理。
 *
 * Layout responsive design:
 * - Mobile (<640px): Single-column layout, full-width header and content
 * - Tablet (640-1023px): Header flex row with search/action buttons stacked, tab content full-width
 * - Desktop (1024-1535px): Three-column max-width container, header row with inline buttons, realm items in flexbox column
 * - Ultra-wide (≥1536px): Same as desktop with additional side padding
 *
 * Mobile (<640px):
 * ┌─────────────────────────┐
 * │ Realms                  │ (stacked title + subtitle)
 * │ My community spaces     │
 * ├─────────────────────────┤
 * │ [Search] [Manage] [New] │ (vertical stack)
 * ├─────────────────────────┤
 * │ [Joined] [Administr...] │ (tab list)
 * ├─────────────────────────┤
 * │ ☐ Realm 1              │ (list item)
 * │   Description...        │
 * │          5 members      │
 * ├─────────────────────────┤
 * │ ☐ Realm 2              │
 * │   Description...        │
 * │        12 members       │
 * └─────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌───────────────────────────────────────┐
 * │ Realms    [Search] [Manage] [New]    │ (flex row)
 * │ My community spaces                   │
 * ├───────────────────────────────────────┤
 * │ [Joined] [Administered]               │ (tab list)
 * ├───────────────────────────────────────┤
 * │ ☐ Realm 1                            │
 * │   Description preview...              │
 * │              5 members                │
 * ├───────────────────────────────────────┤
 * │ ☐ Realm 2                            │
 * │   Description preview...              │
 * │             12 members                │
 * └───────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌──────────────────────────────────────────────────┐
 * │ Realms              [Search] [Manage] [New]      │ (flex row, justify-between)
 * │ My community spaces                              │
 * ├──────────────────────────────────────────────────┤
 * │ [Joined] [Administered]                          │
 * ├──────────────────────────────────────────────────┤
 * │ ┌────────────────────────────────────────────┐  │
 * │ │ ☐ [Logo] Realm 1        [OFFICIAL] 5 members│ │
 * │ │      Description preview line 1...        │  │
 * │ │      Description preview line 2...        │  │
 * │ └────────────────────────────────────────────┘  │
 * │ ┌────────────────────────────────────────────┐  │
 * │ │ ☐ [Logo] Realm 2        [PRIVATE]  12 members│ │
 * │ │      Description preview line 1...        │  │
 * │ └────────────────────────────────────────────┘  │
 * └──────────────────────────────────────────────────┘
 *
 * Ultra-wide (≥1536px):
 * ┌────────────────────────────────────────────────────────────┐
 * │ [Padding] Realms         [Search] [Manage] [New]  [Padding]│
 * │          My community spaces                               │
 * ├────────────────────────────────────────────────────────────┤
 * │ [Padding] [Joined] [Administered]                          │
 * ├────────────────────────────────────────────────────────────┤
 * │ [Padding] Realm items (same layout as desktop)  [Padding]  │
 * └────────────────────────────────────────────────────────────┘
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
  const leaveRealm = useLeaveRealmMutation({
    onSuccess: () => {
      setSelectedIds(new Set());
    },
  });

  useEffect(() => {
    if (!canManageList) {
      setManageMode(false);
      setSelectedIds(new Set());
    }
  }, [canManageList]);

  const query = useQuery({
    ...realmQueries.byMember(target.targetUserId ?? "", {
      view: activeTab === "administered" ? "managing" : "joined",
      languages: readContext.languages,
      appLocale: readContext.appLocale,
      languageMode: readContext.languageMode,
      limit: 50,
    }),
    enabled:
      Boolean(target.targetUserId) && readContext.ready && !target.isLoading,
  });

  const realms = useMemo(
    () => query.data?.realms.map(mapJoinedRealmToListItem) ?? [],
    [query.data?.realms],
  );
  const selectedRealms = selectedRealmItems(realms, selectedIds);
  const selectedCount = selectedRealms.length;
  const isLeaving = leaveRealm.isPending;

  const handleToggleRealm = (realmId: string) => {
    setSelectedIds((current) => toggleRealmSelection(current, realmId));
  };

  const handleLeaveSelected = async () => {
    try {
      await Promise.all(
        selectedRealms.map((realm) => leaveRealm.mutateAsync(realm.unitId)),
      );
      setConfirmOpen(false);
      setManageMode(false);
    } catch (error) {
      // Show toast on partial or total failure; keep dialog open for retry.
      // 部分或全部失败时弹出提示；保持对话框打开以便重试。
      toast.error(t("entity:realm_list_leave_failed"));
    }
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
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold leading-ui">
            {t("entity:realm_list_title")}
          </h1>
          <p className="mt-1 text-sm leading-ui text-text-secondary">
            {t("entity:realm_list_subtitle")}
          </p>
        </div>
        <div className="flex flex-row gap-2">
          <Button
            variant="ghost"
            onClick={() => navigate({ to: "/realm/search" })}
          >
            {t("common:search")}
          </Button>
          {canManageList && (
            <label className="flex items-center gap-2 rounded-md px-2 text-sm leading-ui text-text-secondary">
              <Checkbox
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
          {target.isLoading || query.isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : target.error || query.error ? (
            <p className="py-8 text-center text-sm leading-ui text-error-text">
              {t("settings:profile_realms_load_failed")}
            </p>
          ) : realms.length === 0 ? (
            <p className="py-8 text-center text-sm leading-ui text-text-secondary">
              {activeTab === "joined"
                ? t("settings:profile_realms_none_joined")
                : t("settings:profile_realms_none_managing")}
            </p>
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
    <div className="border border-border-whisper rounded-md p-4 transition-colors hover:border-border-defined">
      <div className="flex items-start gap-3">
        {manageMode && (
          <Checkbox
            checked={selected}
            onCheckedChange={onToggle}
            onClick={(event) => event.stopPropagation()}
            aria-label={`Select ${realm.title}`}
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
    </div>
  );

  if (manageMode) {
    return (
      <div
        role="button"
        tabIndex={0}
        className="text-left"
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggle();
          }
        }}
      >
        {content}
      </div>
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
