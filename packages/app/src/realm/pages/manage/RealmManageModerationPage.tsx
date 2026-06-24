import { useUpdateRealmMutation } from "@rezics/contract/api/realm/realm";
import { useTranslation } from "@rezics/i18n/react";
import { Card, CardContent, Checkbox, Label } from "@rezics/ui/shadcn";
import { toast } from "sonner";
import { useRealmManage } from "../../layouts/realmManageContext";
import { RealmModerationQueueSection } from "../../sections/RealmModerationQueueSection";

/**
 * Realm moderation management page for approval policy and moderation queue.
 *
 * Realm 审核管理页：管理内容审批策略与审核队列。
 *
 * Mobile (<640px):
 * ┌──────────────────────────┐
 * │ Approval toggle          │
 * │ Moderation queue         │
 * └──────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │ Approval card + queue stacked      │
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌────────────────────────────────────────────┐
 * │ Moderation controls and queue full width   │
 * └────────────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * ┌────────────────────────────────────────────┐
 * │ Centered max-width inherited from layout   │
 * └────────────────────────────────────────────┘
 */
export function RealmManageModerationPage() {
  const { t } = useTranslation(["community"]);
  const { realmId, realm } = useRealmManage();
  const updateRealm = useUpdateRealmMutation({
    onSuccess: () => toast.success(t("community:realm_settings_saved")),
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="flex flex-col gap-4">
      <Card surface="contained">
        <CardContent className="flex items-start gap-3 p-4">
          <Checkbox
            id="realm-content-approval"
            checked={realm.contentRequiresApproval ?? false}
            disabled={updateRealm.isPending}
            onCheckedChange={(checked) =>
              updateRealm.mutate({
                unitId: realmId,
                input: { contentRequiresApproval: checked === true },
              })
            }
          />
          <div className="flex flex-col gap-1">
            <Label
              htmlFor="realm-content-approval"
              className="text-sm font-medium leading-ui text-text-primary"
            >
              {t("community:realm_require_content_approval")}
            </Label>
            <p className="m-0 text-sm leading-body text-text-secondary">
              {t("community:realm_require_content_approval_description")}
            </p>
          </div>
        </CardContent>
      </Card>
      <RealmModerationQueueSection realmUnitId={realmId} />
    </div>
  );
}
