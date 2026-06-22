import { useUpdateZone } from "@rezics/api";
import { useTranslation } from "@rezics/i18n/react";
import { useEffect, useState } from "react";
import { ZoneManageLifecycleTab } from "../../components/manage/ZoneManageLifecycleTab";
import { useZoneManage } from "../../layouts/zoneManageContext";

/**
 * Zone lifecycle management page for publication start/end timestamps.
 *
 * Zone 生命週期管理页：编辑发布开始与结束时间。
 *
 * Mobile (<640px):
 * ┌──────────────────────────┐
 * │ Starts at                │
 * │ Ends at                  │
 * │                  [Save]  │
 * └──────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │ Starts at | Ends at                │
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌────────────────────────────────────────────┐
 * │ Lifecycle form inside manage container     │
 * └────────────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * ┌────────────────────────────────────────────┐
 * │ Centered max-width inherited from layout   │
 * └────────────────────────────────────────────┘
 */
export function ZoneManageLifecyclePage() {
  const { t } = useTranslation(["zone"]);
  const { zone } = useZoneManage();
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const updateZone = useUpdateZone();

  useEffect(() => {
    setStartsAt(zone.startsAt ?? "");
    setEndsAt(zone.endsAt ?? "");
  }, [zone.endsAt, zone.startsAt]);

  const saveLifecycle = () => {
    updateZone.mutate({
      unitId: zone.unitId,
      input: {
        startsAt: startsAt.trim() ? startsAt.trim() : null,
        endsAt: endsAt.trim() ? endsAt.trim() : null,
      },
    });
  };

  return (
    <ZoneManageLifecycleTab
      startsAt={startsAt}
      endsAt={endsAt}
      onStartsAtChange={setStartsAt}
      onEndsAtChange={setEndsAt}
      onSave={saveLifecycle}
      saving={updateZone.isPending}
    />
  );
}
