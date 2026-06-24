import { useUpdateZoneNav, useUpdateZoneTheme } from "@rezics/contract/api";
import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ZoneManageJsonFrame } from "../../components/manage/ZoneManageJsonFrame";
import { ZoneManageThemeTab } from "../../components/manage/ZoneManageThemeTab";
import { useZoneManage } from "../../layouts/zoneManageContext";
import {
  updateZoneManageJsonProblems,
  validateZoneManageDraft,
  type ZoneManageDraft,
  type ZoneManageJsonProblemsByKey,
  zoneManageDraftToNav,
  zoneManageDraftToTheme,
  zoneShellToDraft,
} from "../../models/zoneManageDraft";
import { ZoneManageProblemNotices } from "./ZoneManageProblemNotices";

/**
 * Zone theme management page for theme tokens, images, and header menu
 * selection.
 *
 * Zone 主题管理页：编辑主题 token、图片与 header menu 选择。
 *
 * Mobile (<640px):
 * ┌──────────────────────────┐
 * │ Validation alerts        │
 * │ Theme editor             │
 * │                  [Save]  │
 * └──────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │ Theme editor stacked full width    │
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌────────────────────────────────────────────┐
 * │ Theme editor inside manage container       │
 * └────────────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * ┌────────────────────────────────────────────┐
 * │ Centered max-width inherited from layout   │
 * └────────────────────────────────────────────┘
 */
export function ZoneManageThemePage() {
  const { t } = useTranslation(["zone", "common"]);
  const { zone, homePageId, homePageConfig } = useZoneManage();
  const [draft, setDraft] = useState<ZoneManageDraft | null>(null);
  const [jsonProblemsByKey, setJsonProblemsByKey] =
    useState<ZoneManageJsonProblemsByKey>({});
  const updateNav = useUpdateZoneNav({
    onSuccess: () => toast.success(t("zone:manage_saved")),
    onError: (mutationError) => toast.error(mutationError.message),
  });
  const updateTheme = useUpdateZoneTheme({
    onSuccess: () => toast.success(t("zone:manage_saved")),
    onError: (mutationError) => toast.error(mutationError.message),
  });

  useEffect(() => {
    setDraft(
      zoneShellToDraft({
        boundary: zone.boundary,
        nav: zone.nav,
        theme: zone.theme,
        page: homePageConfig,
        pageId: homePageId,
      }),
    );
  }, [homePageConfig, homePageId, zone]);

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
  const saving = updateNav.isPending || updateTheme.isPending;

  const saveTheme = async () => {
    if (!draft) return;
    if (saveBlocked) {
      toast.error(t("zone:manage_config_invalid"));
      return;
    }
    try {
      await Promise.all([
        updateNav.mutateAsync({
          unitId: zone.unitId,
          input: { nav: zoneManageDraftToNav(draft) },
        }),
        updateTheme.mutateAsync({
          unitId: zone.unitId,
          input: { theme: zoneManageDraftToTheme(draft) },
        }),
      ]);
    } catch {
      // Global MutationCache.onError handles the toast.
      // 全局 MutationCache.onError 处理 toast 通知。
    }
  };

  if (!draft) return null;

  return (
    <>
      <ZoneManageProblemNotices
        issues={issues}
        jsonProblemsByKey={jsonProblemsByKey}
      />
      <ZoneManageJsonFrame
        draft={draft}
        onDraftChange={setDraft}
        target={{ kind: "theme" }}
        onProblemsChange={setJsonProblems}
      >
        <ZoneManageThemeTab draft={draft} onDraftChange={setDraft} />
        <div className="mt-4 flex justify-end">
          <Button onClick={saveTheme} disabled={saving || saveBlocked}>
            {t("common:save")}
          </Button>
        </div>
      </ZoneManageJsonFrame>
    </>
  );
}
