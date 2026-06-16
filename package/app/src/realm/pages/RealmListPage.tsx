import { myRealmsQuery } from "@rezics/api/realm/realm.queries";
import { useLeaveRealmMutation } from "@rezics/api/realm/realm.mutations";
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
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { Link, unitHref } from "@/shared/ui/link";
import {
  mapJoinedRealmToListItem,
  type RealmListItemModel,
  selectHasMemberSession,
  useAuthSessionStore,
} from "@/user";
import {
  selectedRealmItems,
  toggleRealmSelection,
} from "../models/realmBulkLeaveSelection";

export function RealmListPage() {
  const { t } = useTranslation(["common", "entity", "settings"]);
  const navigate = useNavigate();
  const hasMemberSession = useAuthSessionStore(selectHasMemberSession);
  const readContext = useReadLanguageContext();
  const [manageMode, setManageMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const leaveRealm = useLeaveRealmMutation({
    onSuccess: () => {
      setSelectedIds(new Set());
    },
  });

  const query = useQuery({
    ...myRealmsQuery({
      languages: readContext.languages,
      appLocale: readContext.appLocale,
      languageMode: readContext.languageMode,
    }),
    enabled: hasMemberSession && readContext.ready,
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
    await Promise.all(
      selectedRealms.map((realm) => leaveRealm.mutateAsync(realm.unitId)),
    );
    setConfirmOpen(false);
    setManageMode(false);
  };

  if (!hasMemberSession) {
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
          <Button
            variant={manageMode ? "outline" : "ghost"}
            onClick={() => {
              setManageMode((value) => !value);
              setSelectedIds(new Set());
            }}
          >
            {manageMode ? t("common:cancel") : t("entity:realm_list_manage")}
          </Button>
          <Button onClick={() => navigate({ to: "/realm/new" })}>
            {t("entity:realm_new_title")}
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : query.error ? (
        <p className="py-8 text-center text-sm leading-ui text-error-text">
          {t("settings:profile_realms_load_failed")}
        </p>
      ) : realms.length === 0 ? (
        <p className="py-8 text-center text-sm leading-ui text-text-secondary">
          {t("settings:profile_realms_none_joined")}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {manageMode && (
            <div className="flex items-center justify-between gap-3 border-y border-border-whisper py-3">
              <p className="text-sm leading-ui text-text-secondary">
                {t("entity:realm_list_selected_count", { count: selectedCount })}
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

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("entity:realm_list_leave_confirm_title")}
            </DialogTitle>
            <DialogDescription>
              {t("entity:realm_list_leave_confirm_description", { count: selectedCount })}
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
