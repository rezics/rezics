import { useUnsubscribeMutation } from "@rezics/api/subscription/subscription";
import { zoneQueries } from "@rezics/api/zone/zone";
import type { ZoneDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
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
import { type FC, useEffect, useMemo, useState } from "react";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { Link, unitHref } from "@/shared/ui/link";
import { selectHasMemberSession, useAuthSessionStore } from "@/user";
import { useUserScopedWorkspaceTarget } from "@/user/hooks/useUserScopedWorkspaceTarget";

type ZoneWorkspaceTab = "subscribed" | "administered";

/**
 * 领域列表页面。用户查看已订阅和管理的领域，支持批量退订功能。
 *
 * 布局结构：
 *
 * Header (with manage toggle):
 * ┌──────────────────────────────────────────┐
 * │ My Zones                          [Manage]│
 * │ Your subscribed realms                   │
 * └──────────────────────────────────────────┘
 *
 * Tab Navigation:
 * ┌──────────────────────────────────────────┐
 * │ [Subscribed]  [Administered]             │
 * └──────────────────────────────────────────┘
 *
 * Normal Mode (manage=false):
 * ┌──────────────────────────────────────────┐
 * │ [Link] Zone Name 1                 slug1 │
 * │ [Link] Zone Name 2                 slug2 │
 * │ [Link] Zone Name 3                 slug3 │
 * └──────────────────────────────────────────┘
 *
 * Manage Mode (manage=true):
 * ┌──────────────────────────────────────────┐
 * │ Selected 2 zones    [Unsubscribe Button] │
 * ├──────────────────────────────────────────┤
 * │ [X] Zone Name 1                    slug1 │
 * │ [X] Zone Name 2                    slug2 │
 * │ [ ] Zone Name 3                    slug3 │
 * └──────────────────────────────────────────┘
 *
 * Confirmation Dialog:
 * ┌──────────────────────────────────────────┐
 * │ Unsubscribe?                             │
 * │ Remove 2 zones from your subscriptions.  │
 * │                      [Cancel] [Confirm] │
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
  const unsubscribe = useUnsubscribeMutation({
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
    ...zoneQueries.byUser(target.targetUserId ?? "", {
      view: activeTab === "administered" ? "managing" : "subscribed",
      languages: readContext.languages.length
        ? readContext.languages.join(",")
        : undefined,
      appLocale: readContext.appLocale,
      languageMode: readContext.languageMode,
      limit: 50,
    }),
    enabled:
      Boolean(target.targetUserId) && readContext.ready && !target.isLoading,
  });

  const zones = query.data?.zones ?? [];
  const selectedZones = useMemo(
    () => zones.filter((zone) => selectedIds.has(zone.unitId)),
    [selectedIds, zones],
  );
  const selectedCount = selectedZones.length;
  const isUnsubscribing = unsubscribe.isPending;

  const toggleZone = (zoneUnitId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(zoneUnitId)) next.delete(zoneUnitId);
      else next.add(zoneUnitId);
      return next;
    });
  };

  const handleUnsubscribeSelected = async () => {
    await Promise.all(
      selectedZones.map((zone) => unsubscribe.mutateAsync(zone.unitId)),
    );
    setConfirmOpen(false);
    setManageMode(false);
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
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold leading-ui">
            {t("zone:list_title")}
          </h1>
          <p className="mt-1 text-sm leading-ui text-text-secondary">
            {t("zone:list_subtitle")}
          </p>
        </div>
        {canManageList && (
          <label className="flex items-center gap-2 rounded-md px-2 text-sm leading-ui text-text-secondary">
            <Checkbox
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
          {target.isLoading || query.isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : target.error || query.error ? (
            <p className="py-8 text-center text-sm leading-ui text-error-text">
              {t("settings:profile_zones_load_failed")}
            </p>
          ) : zones.length === 0 ? (
            <p className="py-8 text-center text-sm leading-ui text-text-secondary">
              {activeTab === "subscribed"
                ? t("settings:profile_zones_none_subscribed")
                : t("settings:profile_zones_none_managing")}
            </p>
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
  const content = (
    <div className="rounded-md border border-border-whisper p-4 transition-colors hover:border-border-defined">
      <div className="flex items-start gap-3">
        {manageMode && (
          <Checkbox
            checked={selected}
            onCheckedChange={onToggle}
            onClick={(event) => event.stopPropagation()}
            aria-label={`Select ${zone.name || zone.slug}`}
            className="mt-1"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-medium leading-ui text-text-primary">
              {zone.name || zone.slug}
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
      to={unitHref({ type: "ZONE", unitId: zone.unitId, slug: zone.slug })}
      className="no-underline"
    >
      {content}
    </Link>
  );
};
