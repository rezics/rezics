import { PinboardAdminSection } from "@/pinboard";
import { useRealmManage } from "../../layouts/realmManageContext";
import { RealmRuleManager } from "../../sections/RealmRuleManager";
import { RealmTagTreeEditor } from "../../sections/RealmTagTreeEditor";
import { RealmPolicyTagManager } from "../../sections/RealmPolicyTagManager";

/**
 * Realm organization management page for tag tree, tag display preferences,
 * and pinboard administration.
 *
 * Realm 组织管理页：编辑标签树、标签显示偏好与内容墙管理。
 *
 * Mobile (<640px):
 * ┌──────────────────────────┐
 * │ Tag tree editor          │
 * │ Policy tag manager       │
 * │ Tag view preferences     │
 * │ Pinboard admin           │
 * └──────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │ Organization editors stacked       │
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌────────────────────────────────────────────┐
 * │ Organization editors in readable column    │
 * └────────────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * ┌────────────────────────────────────────────┐
 * │ Centered max-width inherited from layout   │
 * └────────────────────────────────────────────┘
 */
export function RealmManageOrganizationPage() {
  const { realmId } = useRealmManage();

  return (
    <div className="flex flex-col gap-6">
      <RealmRuleManager realmId={realmId} />
      <RealmTagTreeEditor realmId={realmId} />
      <RealmPolicyTagManager realmId={realmId} />
      <PinboardAdminSection realmUnitId={realmId} />
    </div>
  );
}
