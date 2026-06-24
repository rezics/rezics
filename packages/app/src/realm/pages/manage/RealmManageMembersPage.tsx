import { useRealmManage } from "../../layouts/realmManageContext";
import { RealmMemberList } from "../../components/RealmMemberList";

/**
 * Realm members management page. The member list owns its own pagination and
 * action controls inside the shared management shell.
 *
 * Realm 成员管理页：成员列表自身负责分页与操作控件，并放入共享管理布局。
 *
 * Mobile (<640px):
 * ┌──────────────────────────┐
 * │ Member list              │
 * │ Load more / row actions  │
 * └──────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │ Member list full width             │
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌────────────────────────────────────────────┐
 * │ Member management list                     │
 * └────────────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * ┌────────────────────────────────────────────┐
 * │ Centered max-width inherited from layout   │
 * └────────────────────────────────────────────┘
 */
export function RealmManageMembersPage() {
  const { realmId } = useRealmManage();
  return <RealmMemberList realmId={realmId} />;
}
