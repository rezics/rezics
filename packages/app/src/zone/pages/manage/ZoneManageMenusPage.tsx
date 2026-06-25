import { useUpdateZoneNav } from "@rezics/contract/api/zone/zone";
import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ZoneManageJsonFrame } from "../../components/manage/ZoneManageJsonFrame";
import { ZoneManageMenusTab } from "../../components/manage/ZoneManageMenusTab";
import { useZoneManage } from "../../layouts/zoneManageContext";
import {
  updateZoneManageJsonProblems,
  validateZoneManageDraft,
  type ZoneManageDraft,
  type ZoneManageJsonProblemsByKey,
  zoneManageDraftToNav,
  zoneShellToDraft,
} from "../../models/zoneManageDraft";
import { ZoneManageProblemNotices } from "./ZoneManageProblemNotices";

/**
 * Zone menus management page for navigation menus and menu-node trees.
 *
 * Zone 菜单管理页：编辑导航菜单与菜单节点树。
 *
 * Mobile (<640px):
 * ┌──────────────────────────┐
 * │ Validation alerts        │
 * │ Menu editor              │
 * │                  [Save]  │
 * └──────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │ Menu editor stacked full width     │
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌────────────────────────────────────────────┐
 * │ Menu editor inside manage container        │
 * └────────────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * ┌────────────────────────────────────────────┐
 * │ Centered max-width inherited from layout   │
 * └────────────────────────────────────────────┘
 */
export function ZoneManageMenusPage() {
  const { t } = useTranslation(["zone", "common"]);
  const { zone, refUnits, homePageId, homePageConfig } = useZoneManage();
  const [draft, setDraft] = useState<ZoneManageDraft | null>(null);
  const [jsonProblemsByKey, setJsonProblemsByKey] =
    useState<ZoneManageJsonProblemsByKey>({});
  const updateNav = useUpdateZoneNav({
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

  const saveMenus = () => {
    if (!draft) return;
    if (saveBlocked) {
      toast.error(t("zone:manage_config_invalid"));
      return;
    }
    updateNav.mutate({
      unitId: zone.unitId,
      input: { nav: zoneManageDraftToNav(draft) },
    });
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
        target={{ kind: "nav" }}
        onProblemsChange={setJsonProblems}
      >
        <ZoneManageMenusTab
          draft={draft}
          onDraftChange={setDraft}
          refUnits={refUnits}
          pages={zone.pages}
          defaultPageId={zone.homePageId}
        />
        <div className="mt-4 flex justify-end">
          <Button
            onClick={saveMenus}
            disabled={updateNav.isPending || saveBlocked}
          >
            {t("common:save")}
          </Button>
        </div>
      </ZoneManageJsonFrame>
    </>
  );
}
