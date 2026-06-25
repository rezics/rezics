import { useUpdateZone, useUpdateZoneBoundary } from "@rezics/contract/api/zone/zone";
import { useTranslation } from "@rezics/i18n/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ZoneManageJsonFrame } from "../../components/manage/ZoneManageJsonFrame";
import { ZoneManageProfileTab } from "../../components/manage/ZoneManageProfileTab";
import { useZoneManage } from "../../layouts/zoneManageContext";
import {
  updateZoneManageJsonProblems,
  validateZoneManageDraft,
  type ZoneManageDraft,
  type ZoneManageJsonProblemsByKey,
  type ZoneTranslationRow,
  zoneManageDraftToBoundary,
  zoneRowsToTranslations,
  zoneShellToDraft,
  zoneTranslationsToRows,
} from "../../models/zoneManageDraft";
import { ZoneManageProblemNotices } from "./ZoneManageProblemNotices";

/**
 * Zone profile management page for translations and boundary context. The JSON
 * frame and structured form edit the same boundary draft.
 *
 * Zone 资料管理页：编辑译文与 boundary context。JSON frame 与结构化表单共享
 * 同一份 boundary draft。
 *
 * Mobile (<640px):
 * ┌──────────────────────────┐
 * │ Validation alerts        │
 * │ Profile editor           │
 * │ Boundary JSON frame      │
 * └──────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │ Profile form stacked full width    │
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌────────────────────────────────────────────┐
 * │ Profile editor inside manage container     │
 * └────────────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * ┌────────────────────────────────────────────┐
 * │ Centered max-width inherited from layout   │
 * └────────────────────────────────────────────┘
 */
export function ZoneManageProfilePage() {
  const { t } = useTranslation(["zone"]);
  const { zone, refUnits, homePageId, homePageConfig } = useZoneManage();
  const [draft, setDraft] = useState<ZoneManageDraft | null>(null);
  const [rows, setRows] = useState<ZoneTranslationRow[]>([]);
  const [jsonProblemsByKey, setJsonProblemsByKey] =
    useState<ZoneManageJsonProblemsByKey>({});
  const updateZone = useUpdateZone({
    onSuccess: () => toast.success(t("zone:manage_saved")),
    onError: (mutationError) => toast.error(mutationError.message),
  });
  const updateBoundary = useUpdateZoneBoundary({
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
    setRows(zoneTranslationsToRows(zone.translations));
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
  const saving = updateZone.isPending || updateBoundary.isPending;

  const saveProfile = () => {
    if (!draft) return;
    if (saveBlocked) {
      toast.error(t("zone:manage_config_invalid"));
      return;
    }
    updateZone.mutate({
      unitId: zone.unitId,
      input: { translations: zoneRowsToTranslations(rows) },
    });
    updateBoundary.mutate({
      unitId: zone.unitId,
      input: { boundary: zoneManageDraftToBoundary(draft) },
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
    </>
  );
}
