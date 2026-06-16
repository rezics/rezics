import type { TagTreeNode } from "@rezics/contract";
import { PinboardAdminSection } from "@/pinboard";
import { useRealmManage } from "../../layouts/realmManageContext";
import {
  TagTreeEditor,
  TagViewPreferenceEditor,
} from "../../sections/RealmManageEditors";

/**
 * Realm organization management page for tag tree, tag display preferences,
 * and pinboard administration.
 *
 * Realm 组织管理页：编辑标签树、标签显示偏好与内容墙管理。
 *
 * Mobile (<640px):
 * ┌──────────────────────────┐
 * │ Tag tree editor          │
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
  const { realmId, realm } = useRealmManage();

  return (
    <div className="flex flex-col gap-6">
      <TagTreeEditor
        realmId={realmId}
        initialValue={realm.extra?.tagTree as TagTreeNode[] | undefined}
      />
      <TagViewPreferenceEditor
        realmId={realmId}
        initialValue={realm.extra?.tagView}
      />
      <PinboardAdminSection realmUnitId={realmId} />
    </div>
  );
}
