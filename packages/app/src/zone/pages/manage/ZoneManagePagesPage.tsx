import {
  useCreateZonePage,
  useDeleteZonePage,
  useUpdateZonePage,
} from "@rezics/contract/api/zone/zone.mutations";
import { zonePortalQueryOptions } from "@rezics/contract/api/zone/zone.queries";
import type {
  CreateZonePageInput,
  UpdateZonePageInput,
  ZonePageSummary,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ZoneManageSectionsTab } from "../../components/manage/ZoneManageSectionsTab";
import { useZoneManage } from "../../layouts/zoneManageContext";
import {
  addZonePageDraftIfMissing,
  collectZoneSectionIds,
  updateZoneManageJsonProblems,
  validateZoneManageDraft,
  type ZoneManageDraft,
  type ZoneManageJsonProblemsByKey,
  zoneManageDraftToPage,
  zoneShellToDraft,
} from "../../models/zoneManageDraft";
import { ZoneManageProblemNotices } from "./ZoneManageProblemNotices";

function sortPages(pages: readonly ZonePageSummary[]): ZonePageSummary[] {
  return [...pages].sort(
    (left, right) =>
      left.position.localeCompare(right.position) ||
      left.slug.localeCompare(right.slug),
  );
}

/**
 * Zone page and section management page. It owns the selected zone page read,
 * page metadata mutations, and selected page config draft.
 *
 * Zone 页面与分区管理页：持有当前选中 page 的读取、page 元数据 mutation 与当前
 * page config draft。
 *
 * Mobile (<640px):
 * ┌──────────────────────────┐
 * │ Validation alerts        │
 * │ Page selector/actions    │
 * │ Section editor           │
 * └──────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │ Page controls wrap above sections  │
 * │ Section editor full width          │
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌────────────────────────────────────────────┐
 * │ Page controls and section editor           │
 * └────────────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * ┌────────────────────────────────────────────┐
 * │ Centered max-width inherited from layout   │
 * └────────────────────────────────────────────┘
 */
export function ZoneManagePagesPage() {
  const { t } = useTranslation(["zone"]);
  const { zone, refUnits, readQuery } = useZoneManage();
  const sortedPages = useMemo(() => sortPages(zone.pages), [zone.pages]);
  const homePage =
    sortedPages.find((page) => page.id === zone.homePageId) ??
    sortedPages[0] ??
    null;
  const [selectedPageSlug, setSelectedPageSlug] = useState(
    homePage?.slug ?? "home",
  );
  const [draft, setDraft] = useState<ZoneManageDraft | null>(null);
  const [jsonProblemsByKey, setJsonProblemsByKey] =
    useState<ZoneManageJsonProblemsByKey>({});
  const draftSourceUnitIdRef = useRef<string | null>(null);
  const portalQuery = useQuery({
    ...zonePortalQueryOptions(zone.unitId, selectedPageSlug, readQuery),
    enabled: !!zone.unitId && !!selectedPageSlug,
  });
  const createPage = useCreateZonePage({
    onSuccess: () => toast.success(t("zone:manage_saved")),
    onError: (mutationError) => toast.error(mutationError.message),
  });
  const updatePage = useUpdateZonePage({
    onSuccess: () => toast.success(t("zone:manage_saved")),
    onError: (mutationError) => toast.error(mutationError.message),
  });
  const deletePage = useDeleteZonePage({
    onSuccess: () => toast.success(t("zone:manage_saved")),
    onError: (mutationError) => toast.error(mutationError.message),
  });

  useEffect(() => {
    if (sortedPages.length === 0) return;
    if (!sortedPages.some((page) => page.slug === selectedPageSlug)) {
      setSelectedPageSlug(homePage?.slug ?? sortedPages[0]!.slug);
    }
  }, [homePage, selectedPageSlug, sortedPages]);

  useEffect(() => {
    if (!portalQuery.data?.page) return;
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
      draftSourceUnitIdRef.current = zone.unitId;
    }
  }, [portalQuery.data?.page, zone]);

  const setJsonProblems = (key: string, problems: string[]) => {
    setJsonProblemsByKey((current) =>
      updateZoneManageJsonProblems(current, key, problems),
    );
  };
  const issues = draft ? validateZoneManageDraft(draft) : [];
  const hasJsonProblems = Object.values(jsonProblemsByKey).some(
    (problems) => problems.length > 0,
  );
  const saveBlocked = issues.length > 0 || hasJsonProblems;
  const saving =
    createPage.isPending || updatePage.isPending || deletePage.isPending;
  const managePages = sortedPages;
  const pageRefUnits = portalQuery.data?.refUnits ?? refUnits;
  const contextRealmUnitId =
    draft?.context.kind === "realm" ? draft.context.realmUnitId : null;
  const zoneTitle = zone.name || zone.slug || null;
  const zoneDescription = zone.description || null;
  const themeImages = draft?.theme.images ?? zone.theme.images ?? {};
  const editorCtx =
    draft &&
    ({
      refUnits: pageRefUnits,
      pages: managePages,
      defaultPageId:
        managePages.find((page) => page.id === zone.homePageId)?.id ??
        managePages[0]?.id ??
        null,
      allSectionIds: collectZoneSectionIds(draft.pages),
      contextRealmUnitId,
      contextRealmSlug: contextRealmUnitId
        ? (pageRefUnits[contextRealmUnitId]?.slug ?? null)
        : null,
      zoneTitle,
      zoneDescription,
      themeBannerUrl: themeImages.bannerUrl ?? null,
      themeLogoUrl: themeImages.logoUrl ?? null,
    } satisfies Parameters<typeof ZoneManageSectionsTab>[0]["ctx"]);

  const selectPage = (page: ZonePageSummary) => {
    setSelectedPageSlug(page.slug);
  };

  const createSelectedPage = (input: CreateZonePageInput) => {
    createPage.mutate(
      { unitId: zone.unitId, input },
      { onSuccess: () => setSelectedPageSlug(input.slug) },
    );
  };

  const updateSelectedPage = (pageId: string, input: UpdateZonePageInput) => {
    updatePage.mutate(
      { unitId: zone.unitId, pageId, input },
      {
        onSuccess: () => {
          if (input.slug) setSelectedPageSlug(input.slug);
        },
      },
    );
  };

  const deleteSelectedPage = (page: ZonePageSummary) => {
    const remaining = managePages.filter(
      (candidate) => candidate.id !== page.id,
    );
    const fallback =
      remaining.find((candidate) => candidate.id === zone.homePageId) ??
      remaining[0];
    deletePage.mutate(
      { unitId: zone.unitId, pageId: page.id },
      {
        onSuccess: () => {
          if (fallback) setSelectedPageSlug(fallback.slug);
        },
      },
    );
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
        unitId: zone.unitId,
        pageId,
        input: { config: zoneManageDraftToPage(draft, pageId) },
      });
    }
  };

  if (portalQuery.isLoading || !draft || !editorCtx) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <ZoneManageProblemNotices
        issues={issues}
        jsonProblemsByKey={jsonProblemsByKey}
      />
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
    </>
  );
}
