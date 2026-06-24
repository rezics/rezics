import { useTranslation } from "@rezics/i18n/react";
import { UnitExternalLinkEditor } from "@/unit-external-link";
import { useZoneManage } from "../../layouts/zoneManageContext";

/**
 * Zone sources management page for external link references.
 *
 * Zone 来源管理页：维护 external links 引用。
 *
 * Mobile (<640px):
 * ┌──────────────────────────┐
 * │ External link editor     │
 * └──────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │ External link editor full width    │
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌────────────────────────────────────────────┐
 * │ Sources editor inside manage container     │
 * └────────────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * ┌────────────────────────────────────────────┐
 * │ Centered max-width inherited from layout   │
 * └────────────────────────────────────────────┘
 */
export function ZoneManageSourcesPage() {
  const { t } = useTranslation(["common"]);
  const { zone } = useZoneManage();

  return (
    <UnitExternalLinkEditor
      unitId={zone.unitId}
      title={t("common:external_links_title")}
      description={t("common:external_links_zone_description")}
    />
  );
}
