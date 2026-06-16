import { useRealmManage } from "../../layouts/realmManageContext";
import {
  FeaturedZonePicker,
  WikiSidebarPicker,
} from "../../sections/RealmManageEditors";

/**
 * Realm wiki management page for featured zone and sidebar slot selection.
 *
 * Realm Wiki 管理页：选择特色专区与 Wiki 侧栏内容。
 *
 * Mobile (<640px):
 * ┌──────────────────────────┐
 * │ Featured zone picker     │
 * │ Wiki sidebar picker      │
 * └──────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │ Wiki editors stacked full width    │
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌────────────────────────────────────────────┐
 * │ Wiki editors in one management column      │
 * └────────────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * ┌────────────────────────────────────────────┐
 * │ Centered max-width inherited from layout   │
 * └────────────────────────────────────────────┘
 */
export function RealmManageWikiPage() {
  const { realmId, realm } = useRealmManage();

  return (
    <div className="flex flex-col gap-6">
      <FeaturedZonePicker
        realmId={realmId}
        value={realm.extra?.featuredZoneUnitId ?? null}
      />
      <WikiSidebarPicker
        realmId={realmId}
        value={realm.extra?.wikiSidebar ?? null}
      />
    </div>
  );
}
