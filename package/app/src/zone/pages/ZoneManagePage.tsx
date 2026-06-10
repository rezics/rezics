import {
  useUpdateZoneBoundary,
  useUpdateZoneNav,
  useUpdateZonePage,
  useUpdateZoneTheme,
  useUpdateZone,
  zonePortalQueryOptions,
  zoneQueryOptions,
} from "@rezics/api";
import { useServerPermission } from "@rezics/api/hooks";
import { myRealmMembershipQuery } from "@rezics/api/realm/realm";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { QueryErrorDisplay } from "@/core";
import { ZoneManageLifecycleTab } from "../components/manage/ZoneManageLifecycleTab";
import { ZoneManageMenusTab } from "../components/manage/ZoneManageMenusTab";
import { ZoneManageProfileTab } from "../components/manage/ZoneManageProfileTab";
import { ZoneManageSectionsTab } from "../components/manage/ZoneManageSectionsTab";
import { ZoneManageThemeTab } from "../components/manage/ZoneManageThemeTab";
import { canManageZone } from "../models/canManageZone";
import {
  collectZoneSectionIds,
  validateZoneManageDraft,
  type ZoneManageDraft,
  type ZoneManageIssue,
  type ZoneTranslationRow,
  zoneManageDraftToBoundary,
  zoneManageDraftToHomePage,
  zoneManageDraftToNav,
  zoneManageDraftToTheme,
  zoneShellToDraft,
  zoneRowsToTranslations,
  zoneTranslationsToRows,
} from "../models/zoneManageDraft";

export type ZoneManageTab =
  | "profile"
  | "sections"
  | "menus"
  | "theme"
  | "lifecycle";

type ZoneManagePageProps = {
  activeTab?: ZoneManageTab;
  onTabChange?: (tab: ZoneManageTab) => void;
} & (
  | {
      unitId: string;
      slug?: never;
    }
  | {
      unitId?: never;
      slug: string;
    }
);

const ISSUE_KEYS = {
  section_id_duplicate: "zone:manage_issue_section_id_duplicate",
  tab_id_duplicate: "zone:manage_issue_tab_id_duplicate",
  tab_default_invalid: "zone:manage_issue_tab_default_invalid",
  query_field_unsupported: "zone:manage_issue_query_field_unsupported",
  menu_id_duplicate: "zone:manage_issue_menu_id_duplicate",
  menu_too_deep: "zone:manage_issue_menu_too_deep",
  menu_leaf_missing_target: "zone:manage_issue_menu_leaf_missing_target",
  menu_group_missing_label: "zone:manage_issue_menu_group_missing_label",
  header_menu_invalid: "zone:manage_issue_header_menu_invalid",
} as const satisfies Record<ZoneManageIssue["code"], `zone:${string}`>;

function issueParams(issue: ZoneManageIssue): Record<string, string> {
  const { code: _code, ...rest } = issue;
  return Object.fromEntries(
    Object.entries(rest).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.join(", ") : String(value),
    ]),
  );
}

/**
 * Structured zone manage surface over the split shell/page envelopes:
 * Profile (translations + context), Pages & Sections, Menus, Theme,
 * Lifecycle. Shell tabs save their own columns; section edits save the
 * selected page envelope. The server remains the enforcement point for
 * cross-envelope invariants.
 * 基于拆分后的 shell/page 信封的结构化专区管理界面：资料（译文 + 语境）、
 * 页面与分区、菜单、主题、生命週期。Shell 标签页分别保存自己的列；
 * 分区编辑保存选中的页面信封。跨信封不变量仍由服务端强制执行。
 */
export function ZoneManagePage({
  unitId,
  slug,
  activeTab = "profile",
  onTabChange,
}: ZoneManagePageProps) {
  const { t } = useTranslation(["zone", "common"]);
  const bySlugQuery = useQuery({
    ...zoneQueryOptions(slug ?? ""),
    enabled: !unitId && !!slug,
  });
  const resolvedUnitId = unitId ?? bySlugQuery.data?.unitId ?? "";
  // The portal read also returns `refUnits` summaries used for label/image
  // previews throughout the editors.
  // 门户读取同时返回 `refUnits` 摘要，供编辑器各处的标签/图片预览使用。
  const portalQuery = useQuery({
    ...zonePortalQueryOptions(resolvedUnitId, "home"),
    enabled: !!resolvedUnitId,
  });
  const zone =
    portalQuery.data?.zone ?? (unitId ? undefined : bySlugQuery.data);
  const refUnits = portalQuery.data?.refUnits ?? {};
  const isLoading = unitId
    ? portalQuery.isLoading
    : bySlugQuery.isLoading || portalQuery.isLoading;
  const isError = unitId ? portalQuery.isError : bySlugQuery.isError;
  const error = unitId ? portalQuery.error : bySlugQuery.error;

  const membershipQuery = useQuery({
    ...myRealmMembershipQuery(zone?.ownerRealmUnitId ?? ""),
    enabled: Boolean(zone?.ownerRealmUnitId),
  });
  const permission = useServerPermission();
  const allowed = canManageZone({
    permission,
    ownerRealmMemberRoleKey: membershipQuery.data?.roleKey,
  });
  const updateZone = useUpdateZone({
    onSuccess: () => toast.success(t("zone:manage_saved")),
    onError: (mutationError) => toast.error(mutationError.message),
  });
  const updateBoundary = useUpdateZoneBoundary({
    onSuccess: () => toast.success(t("zone:manage_saved")),
    onError: (mutationError) => toast.error(mutationError.message),
  });
  const updateNav = useUpdateZoneNav({
    onSuccess: () => toast.success(t("zone:manage_saved")),
    onError: (mutationError) => toast.error(mutationError.message),
  });
  const updateTheme = useUpdateZoneTheme({
    onSuccess: () => toast.success(t("zone:manage_saved")),
    onError: (mutationError) => toast.error(mutationError.message),
  });
  const updatePage = useUpdateZonePage({
    onSuccess: () => toast.success(t("zone:manage_saved")),
    onError: (mutationError) => toast.error(mutationError.message),
  });

  const [draft, setDraft] = useState<ZoneManageDraft | null>(null);
  const [rows, setRows] = useState<ZoneTranslationRow[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  useEffect(() => {
    if (!zone || !portalQuery.data?.page) return;
    setDraft(
      zoneShellToDraft({
        boundary: zone.boundary,
        nav: zone.nav,
        theme: zone.theme,
        page: portalQuery.data.page.config,
      }),
    );
    setRows(zoneTranslationsToRows(zone.translations));
    setStartsAt(zone.startsAt ?? "");
    setEndsAt(zone.endsAt ?? "");
  }, [zone, portalQuery.data?.page]);

  const saving =
    updateZone.isPending ||
    updateBoundary.isPending ||
    updateNav.isPending ||
    updateTheme.isPending ||
    updatePage.isPending;
  const unitIdForSave = zone?.unitId ?? "";
  const issues = draft ? validateZoneManageDraft(draft) : [];

  const saveDraftConfig = (withTranslations: boolean) => {
    if (!draft) return;
    if (issues.length > 0) {
      toast.error(t("zone:manage_config_invalid"));
      return;
    }
    if (withTranslations) {
      updateZone.mutate({
        unitId: unitIdForSave,
        input: { translations: zoneRowsToTranslations(rows) },
      });
    }
    updateBoundary.mutate({
      unitId: unitIdForSave,
      input: { boundary: zoneManageDraftToBoundary(draft) },
    });
    updateNav.mutate({
      unitId: unitIdForSave,
      input: { nav: zoneManageDraftToNav(draft) },
    });
    updateTheme.mutate({
      unitId: unitIdForSave,
      input: { theme: zoneManageDraftToTheme(draft) },
    });
    const pageId = portalQuery.data?.page.id;
    if (pageId) {
      updatePage.mutate({
        unitId: unitIdForSave,
        pageId,
        input: { config: zoneManageDraftToHomePage(draft) },
      });
    }
  };

  const saveLifecycle = () => {
    updateZone.mutate({
      unitId: unitIdForSave,
      input: {
        startsAt: startsAt.trim() ? startsAt.trim() : null,
        endsAt: endsAt.trim() ? endsAt.trim() : null,
      },
    });
  };

  if (isLoading || membershipQuery.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <QueryErrorDisplay error={error} />
      </div>
    );
  }

  if (!zone) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="rounded-md bg-surface-subtle p-6 text-sm leading-body text-text-secondary">
          {t("zone:not_found_description")}
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="rounded-md bg-surface-subtle p-6">
          <h1 className="text-lg font-semibold leading-ui text-text-primary">
            {t("zone:manage")}
          </h1>
          <p className="mt-2 text-sm leading-body text-text-secondary">
            {t("zone:manage_denied")}
          </p>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const contextRealmUnitId =
    draft.context.kind === "realm" ? draft.context.realmUnitId : null;
  const editorCtx = {
    refUnits,
    allSectionIds: collectZoneSectionIds(draft.pages),
    contextRealmUnitId,
    contextRealmSlug: contextRealmUnitId
      ? (refUnits[contextRealmUnitId]?.slug ?? null)
      : null,
  };

  const configSaveRow = (
    <div className="mt-4 flex justify-end">
      <Button
        onClick={() => saveDraftConfig(false)}
        disabled={saving || issues.length > 0}
      >
        {t("common:save")}
      </Button>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold leading-ui text-text-primary">
          {t("zone:manage")} · {zone.name || zone.slug}
        </h1>
      </div>

      {issues.length > 0 ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>{t("zone:manage_issues")}</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {issues.map((issue, index) => (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: display list
                  key={index}
                >
                  {t(ISSUE_KEYS[issue.code], issueParams(issue))}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={(value) => onTabChange?.(value as ZoneManageTab)}
      >
        <TabsList className="mb-6 flex flex-wrap">
          <TabsTrigger value="profile">{t("zone:manage_profile")}</TabsTrigger>
          <TabsTrigger value="sections">
            {t("zone:manage_sections")}
          </TabsTrigger>
          <TabsTrigger value="menus">{t("zone:manage_menus")}</TabsTrigger>
          <TabsTrigger value="theme">{t("zone:manage_theme")}</TabsTrigger>
          <TabsTrigger value="lifecycle">
            {t("zone:manage_lifecycle")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ZoneManageProfileTab
            zone={zone}
            rows={rows}
            onRowsChange={setRows}
            draft={draft}
            onDraftChange={setDraft}
            refUnits={refUnits}
            onSave={() => saveDraftConfig(true)}
            saving={saving}
          />
        </TabsContent>

        <TabsContent value="sections">
          <ZoneManageSectionsTab
            draft={draft}
            onDraftChange={setDraft}
            ctx={editorCtx}
          />
          {configSaveRow}
        </TabsContent>

        <TabsContent value="menus">
          <ZoneManageMenusTab
            draft={draft}
            onDraftChange={setDraft}
            refUnits={refUnits}
          />
          {configSaveRow}
        </TabsContent>

        <TabsContent value="theme">
          <ZoneManageThemeTab draft={draft} onDraftChange={setDraft} />
          {configSaveRow}
        </TabsContent>

        <TabsContent value="lifecycle">
          <ZoneManageLifecycleTab
            startsAt={startsAt}
            endsAt={endsAt}
            onStartsAtChange={setStartsAt}
            onEndsAtChange={setEndsAt}
            onSave={saveLifecycle}
            saving={saving}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
