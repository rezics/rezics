import {
  useCreateZonePage,
  useDeleteZonePage,
  useUpdateZone,
  useUpdateZoneBoundary,
  useUpdateZoneNav,
  useUpdateZonePage,
  useUpdateZoneTheme,
  zonePortalQueryOptions,
  zoneQueryOptions,
} from "@rezics/api";
import { useServerPermission } from "@rezics/api/hooks";
import { myRealmMembershipQuery } from "@rezics/api/realm/realm";
import type {
  CreateZonePageInput,
  UpdateZonePageInput,
} from "@rezics/contract";
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { QueryErrorDisplay } from "@/core";
import { UnitExternalLinkEditor } from "@/unit-external-link";
import { ZoneManageJsonFrame } from "../components/manage/ZoneManageJsonFrame";
import { ZoneManageLifecycleTab } from "../components/manage/ZoneManageLifecycleTab";
import { ZoneManageMenusTab } from "../components/manage/ZoneManageMenusTab";
import { ZoneManageProfileTab } from "../components/manage/ZoneManageProfileTab";
import { ZoneManageSectionsTab } from "../components/manage/ZoneManageSectionsTab";
import { ZoneManageThemeTab } from "../components/manage/ZoneManageThemeTab";
import { canManageZone } from "../models/canManageZone";
import {
  addZonePageDraftIfMissing,
  collectZoneSectionIds,
  updateZoneManageJsonProblems,
  validateZoneManageDraft,
  type ZoneManageDraft,
  type ZoneManageIssue,
  type ZoneManageJsonProblemsByKey,
  type ZoneTranslationRow,
  zoneManageDraftToBoundary,
  zoneManageDraftToNav,
  zoneManageDraftToPage,
  zoneManageDraftToTheme,
  zoneRowsToTranslations,
  zoneShellToDraft,
  zoneTranslationsToRows,
} from "../models/zoneManageDraft";

export type ZoneManageTab =
  | "profile"
  | "sections"
  | "sources"
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
  dynamic_tags_target_unsupported:
    "zone:manage_issue_dynamic_tags_target_unsupported",
  dynamic_tags_probability_invalid:
    "zone:manage_issue_dynamic_tags_probability_invalid",
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
  const { t, i18n } = useTranslation(["zone", "common"]);
  const bySlugQuery = useQuery({
    ...zoneQueryOptions(slug ?? ""),
    enabled: !unitId && !!slug,
  });
  const resolvedUnitId = unitId ?? bySlugQuery.data?.unitId ?? "";
  const summaryZone = unitId ? undefined : bySlugQuery.data;
  const sortedPages = useMemo(
    () =>
      [...(summaryZone?.pages ?? [])].sort(
        (left, right) =>
          left.position.localeCompare(right.position) ||
          left.slug.localeCompare(right.slug),
      ),
    [summaryZone?.pages],
  );
  const homePage =
    sortedPages.find((page) => page.id === summaryZone?.homePageId) ??
    sortedPages[0] ??
    null;
  const [selectedPageSlug, setSelectedPageSlug] = useState("home");

  useEffect(() => {
    if (!summaryZone || sortedPages.length === 0) return;
    if (!sortedPages.some((page) => page.slug === selectedPageSlug)) {
      setSelectedPageSlug(homePage?.slug ?? sortedPages[0]!.slug);
    }
  }, [homePage, selectedPageSlug, sortedPages, summaryZone]);

  // The portal read also returns `refUnits` summaries used for label/image
  // previews throughout the editors.
  // 门户读取同时返回 `refUnits` 摘要，供编辑器各处的标签/图片预览使用。
  const portalQuery = useQuery({
    ...zonePortalQueryOptions(resolvedUnitId, selectedPageSlug),
    enabled: !!resolvedUnitId && !!selectedPageSlug,
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
  const createPage = useCreateZonePage({
    onSuccess: () => toast.success(t("zone:manage_saved")),
    onError: (mutationError) => toast.error(mutationError.message),
  });
  const deletePage = useDeleteZonePage({
    onSuccess: () => toast.success(t("zone:manage_saved")),
    onError: (mutationError) => toast.error(mutationError.message),
  });

  const [draft, setDraft] = useState<ZoneManageDraft | null>(null);
  const [rows, setRows] = useState<ZoneTranslationRow[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [jsonProblemsByKey, setJsonProblemsByKey] =
    useState<ZoneManageJsonProblemsByKey>({});
  const draftSourceUnitIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!zone || !portalQuery.data?.page) return;
    const nextPage = portalQuery.data.page;
    const sourceChanged = draftSourceUnitIdRef.current !== zone.unitId;
    setDraft((current) => {
      const fresh = zoneShellToDraft({
        boundary: zone.boundary,
        nav: zone.nav,
        theme: zone.theme,
        page: nextPage.config,
        pageId: nextPage.id,
      });
      if (!current || sourceChanged) return fresh;
      return addZonePageDraftIfMissing(current, nextPage.id, nextPage.config);
    });
    if (sourceChanged) {
      setRows(zoneTranslationsToRows(zone.translations));
      setStartsAt(zone.startsAt ?? "");
      setEndsAt(zone.endsAt ?? "");
      draftSourceUnitIdRef.current = zone.unitId;
    }
  }, [zone, portalQuery.data?.page]);

  const saving =
    updateZone.isPending ||
    updateBoundary.isPending ||
    updateNav.isPending ||
    updateTheme.isPending ||
    updatePage.isPending ||
    createPage.isPending ||
    deletePage.isPending;
  const unitIdForSave = zone?.unitId ?? "";
  const issues = draft ? validateZoneManageDraft(draft) : [];
  const hasJsonProblems = Object.values(jsonProblemsByKey).some(
    (problems) => problems.length > 0,
  );
  const saveBlocked = issues.length > 0 || hasJsonProblems;
  const setJsonProblems = useCallback((key: string, problems: string[]) => {
    setJsonProblemsByKey((current) =>
      updateZoneManageJsonProblems(current, key, problems),
    );
  }, []);

  const saveProfile = () => {
    if (!draft) return;
    if (saveBlocked) {
      toast.error(t("zone:manage_config_invalid"));
      return;
    }
    updateZone.mutate({
      unitId: unitIdForSave,
      input: { translations: zoneRowsToTranslations(rows) },
    });
    updateBoundary.mutate({
      unitId: unitIdForSave,
      input: { boundary: zoneManageDraftToBoundary(draft) },
    });
  };

  const saveMenus = () => {
    if (!draft) return;
    if (saveBlocked) {
      toast.error(t("zone:manage_config_invalid"));
      return;
    }
    updateNav.mutate({
      unitId: unitIdForSave,
      input: { nav: zoneManageDraftToNav(draft) },
    });
  };

  const saveTheme = async () => {
    if (!draft) return;
    if (saveBlocked) {
      toast.error(t("zone:manage_config_invalid"));
      return;
    }
    try {
      await Promise.all([
        updateNav.mutateAsync({
          unitId: unitIdForSave,
          input: { nav: zoneManageDraftToNav(draft) },
        }),
        updateTheme.mutateAsync({
          unitId: unitIdForSave,
          input: { theme: zoneManageDraftToTheme(draft) },
        }),
      ]);
    } catch {
      // Global MutationCache.onError handles the toast.
      // 全局 MutationCache.onError 处理 toast 通知。
    }
  };

  const saveSelectedPage = () => {
    if (!draft) return;
    if (saveBlocked) {
      toast.error(t("zone:manage_config_invalid"));
      return;
    }
    const pageId = portalQuery.data?.page.id;
    if (pageId) {
      updatePage.mutate({
        unitId: unitIdForSave,
        pageId,
        input: { config: zoneManageDraftToPage(draft, pageId) },
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
  const localizedZoneInfoRow =
    rows.find(
      (row) =>
        row.language === i18n.language &&
        (row.title.trim() || row.description.trim()),
    ) ?? rows.find((row) => row.title.trim() || row.description.trim());
  const zoneTitle =
    localizedZoneInfoRow?.title.trim() || zone.name || zone.slug || null;
  const zoneDescription =
    localizedZoneInfoRow?.description.trim() || zone.description || null;
  const themeImages = draft.theme.images ?? zone.theme.images ?? {};
  const managePages =
    sortedPages.length > 0
      ? sortedPages
      : [...zone.pages].sort(
          (left, right) =>
            left.position.localeCompare(right.position) ||
            left.slug.localeCompare(right.slug),
        );
  const editorCtx = {
    refUnits,
    pages: managePages,
    defaultPageId:
      managePages.find((page) => page.id === zone.homePageId)?.id ??
      managePages[0]?.id ??
      null,
    allSectionIds: collectZoneSectionIds(draft.pages),
    contextRealmUnitId,
    contextRealmSlug: contextRealmUnitId
      ? (refUnits[contextRealmUnitId]?.slug ?? null)
      : null,
    zoneTitle,
    zoneDescription,
    themeBannerUrl: themeImages.bannerUrl ?? null,
    themeLogoUrl: themeImages.logoUrl ?? null,
  };

  const selectPage = (page: (typeof managePages)[number]) => {
    setSelectedPageSlug(page.slug);
  };

  const createSelectedPage = (input: CreateZonePageInput) => {
    createPage.mutate(
      { unitId: unitIdForSave, input },
      { onSuccess: () => setSelectedPageSlug(input.slug) },
    );
  };

  const updateSelectedPage = (pageId: string, input: UpdateZonePageInput) => {
    updatePage.mutate(
      { unitId: unitIdForSave, pageId, input },
      {
        onSuccess: () => {
          if (input.slug) setSelectedPageSlug(input.slug);
        },
      },
    );
  };

  const deleteSelectedPage = (page: (typeof managePages)[number]) => {
    const remaining = managePages.filter(
      (candidate) => candidate.id !== page.id,
    );
    const fallback =
      remaining.find((candidate) => candidate.id === zone.homePageId) ??
      remaining[0];
    deletePage.mutate(
      { unitId: unitIdForSave, pageId: page.id },
      {
        onSuccess: () => {
          if (fallback) setSelectedPageSlug(fallback.slug);
        },
      },
    );
  };

  const saveRow = (onSave: () => void) => (
    <div className="mt-4 flex justify-end">
      <Button onClick={onSave} disabled={saving || saveBlocked}>
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

      {hasJsonProblems ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>{t("zone:manage_json_invalid")}</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {Object.entries(jsonProblemsByKey).flatMap(([key, problems]) =>
                problems.map((problem) => (
                  <li key={`${key}:${problem}`}>{problem}</li>
                )),
              )}
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
          <TabsTrigger value="sources">{t("zone:manage_sources")}</TabsTrigger>
          <TabsTrigger value="menus">{t("zone:manage_menus")}</TabsTrigger>
          <TabsTrigger value="theme">{t("zone:manage_theme")}</TabsTrigger>
          <TabsTrigger value="lifecycle">
            {t("zone:manage_lifecycle")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ZoneManageJsonFrame
            draft={draft}
            onDraftChange={setDraft}
            target={{ kind: "boundary" }}
            onProblemsChange={setJsonProblems}
          >
            <ZoneManageProfileTab
              zone={zone}
              rows={rows}
              onRowsChange={setRows}
              draft={draft}
              onDraftChange={setDraft}
              refUnits={refUnits}
              onSave={saveProfile}
              saving={saving}
              saveDisabled={saveBlocked}
            />
          </ZoneManageJsonFrame>
        </TabsContent>

        <TabsContent value="sections">
          <ZoneManageSectionsTab
            draft={draft}
            onDraftChange={setDraft}
            ctx={editorCtx}
            pages={managePages}
            homePageId={zone.homePageId}
            selectedPageId={portalQuery.data?.page.id ?? null}
            onSelectPage={selectPage}
            onCreatePage={createSelectedPage}
            onUpdatePage={updateSelectedPage}
            onDeletePage={deleteSelectedPage}
            onSaveSelectedPage={saveSelectedPage}
            saving={saving}
            saveDisabled={saveBlocked || !portalQuery.data?.page.id}
            onJsonProblemsChange={setJsonProblems}
          />
        </TabsContent>

        <TabsContent value="sources">
          <UnitExternalLinkEditor
            unitId={zone.unitId}
            title={t("common:external_links_title")}
            description={t("common:external_links_zone_description")}
          />
        </TabsContent>

        <TabsContent value="menus">
          <ZoneManageJsonFrame
            draft={draft}
            onDraftChange={setDraft}
            target={{ kind: "nav" }}
            onProblemsChange={setJsonProblems}
          >
            <ZoneManageMenusTab
              draft={draft}
              onDraftChange={setDraft}
              refUnits={refUnits}
              pages={managePages}
              defaultPageId={editorCtx.defaultPageId}
            />
            {saveRow(saveMenus)}
          </ZoneManageJsonFrame>
        </TabsContent>

        <TabsContent value="theme">
          <ZoneManageJsonFrame
            draft={draft}
            onDraftChange={setDraft}
            target={{ kind: "theme" }}
            onProblemsChange={setJsonProblems}
          >
            <ZoneManageThemeTab draft={draft} onDraftChange={setDraft} />
            {saveRow(saveTheme)}
          </ZoneManageJsonFrame>
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
