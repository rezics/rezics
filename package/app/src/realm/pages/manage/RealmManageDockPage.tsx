import { RealmDockEditor } from "@/realm-dock";
import { useRealmManage } from "../../layouts/realmManageContext";

/**
 * Realm Dock management page.
 *
 * Mobile (<640px):
 * +--------------------------+
 * | Dock editor              |
 * | placement tabs           |
 * | stacked item editors     |
 * +--------------------------+
 *
 * Tablet (640-1023px):
 * +------------------------------------+
 * | Dock editor full width             |
 * +------------------------------------+
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | Dock management column                   |
 * +------------------------------------------+
 *
 * Ultra-wide (>=1536px):
 * +------------------------------------------+
 * | Centered max-width inherited from layout |
 * +------------------------------------------+
 *
 * Realm Dock 管理頁：管理 Main Dock 與 Wiki Dock。這不是 Wiki 內容管理；
 * Wiki Dock 只是 Wiki 頁面上方的導覽/輔助停靠區。
 */
export function RealmManageDockPage() {
  const { realmId } = useRealmManage();

  return (
    <div className="flex flex-col gap-6">
      <RealmDockEditor realmId={realmId} />
    </div>
  );
}
