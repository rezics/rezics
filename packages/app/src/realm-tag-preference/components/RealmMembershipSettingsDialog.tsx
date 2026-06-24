import {
  useLeaveRealmMutation,
  useMuteRealmMutation,
  useUnmuteRealmMutation,
} from "@rezics/api/realm/realm";
import { useIsSubscribed } from "@rezics/api/subscription/subscription";
import { userQueries } from "@rezics/api/user/user.queries";
import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { BellIcon, ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CurrentRealmTagPreferencePanel } from "./CurrentRealmTagPreferencePanel";

export interface RealmMembershipSettingsDialogProps {
  realmId: string;
  realmTitle: string;
}

/**
 * Realm 詳情頁的已加入狀態控制。Header 僅顯示一個入口；通知、realm tag
 * display 與離開 realm 都收進 dialog，避免同屏重複動作。
 *
 * Mobile (<640px):
 * +--------------+
 * | [Joined]     |
 * +--------------+
 * | Settings     |
 * | Tags         |
 * | [All][P][None]|
 * | [Leave realm]|
 * +--------------+
 *
 * Tablet (640-1023px):
 * +------------------------+
 * | [Joined settings]      |
 * +------------------------+
 * | Realm settings         |
 * | [Book] [Game] [Media]  |
 * | [All][Personal][None] |
 * | [Leave realm]          |
 * +------------------------+
 *
 * Desktop (1024-1535px):
 * +----------------------------+
 * | [Joined settings]          |
 * +----------------------------+
 * | Realm settings             |
 * | [Book] [Game] [Media]      |
 * | [All] [Personalized] [None]|
 * | [Leave realm]              |
 * +----------------------------+
 *
 * Ultra-wide (>=1536px):
 * +----------------------------------+
 * | [Joined settings]                |
 * +----------------------------------+
 * | Realm settings                   |
 * | [Book] [Game] [Media]            |
 * | [All] [Personalized] [None]      |
 * | [Leave realm]                    |
 * +----------------------------------+
 *
 * 通知按鈕行使用 flex-wrap；三個按鈕同 h-8，寬度不足時換行，寬螢幕留白
 * 留在右側。dialog 以 w-full + desktop max width 靜態封頂，不跟內容伸展。
 */
export function RealmMembershipSettingsDialog({
  realmId,
  realmTitle,
}: RealmMembershipSettingsDialogProps) {
  const { t } = useTranslation(["common", "settings", "entity"]);
  const [open, setOpen] = useState(false);
  const { data: settings } = useQuery(userQueries.settings());
  const { data: subscription, isLoading: subscriptionLoading } =
    useIsSubscribed(realmId);
  const mute = useMuteRealmMutation({
    onSuccess: () =>
      toast.success(t("settings:realm_membership_notifications_none_saved")),
    onError: (error) => toast.error(error.message),
  });
  const unmute = useUnmuteRealmMutation({
    onSuccess: () =>
      toast.success(t("settings:realm_membership_notifications_all_saved")),
    onError: (error) => toast.error(error.message),
  });
  const leave = useLeaveRealmMutation({
    onSuccess: () => {
      toast.success(t("settings:realm_membership_left"));
      setOpen(false);
    },
    onError: (error) => toast.error(error.message),
  });
  const subscribed = subscription?.subscribed ?? false;
  const notificationPending =
    subscriptionLoading || mute.isPending || unmute.isPending;

  const handleNotificationAll = () => {
    if (notificationPending || subscribed) return;
    unmute.mutate(realmId);
  };

  const handleNotificationNone = () => {
    if (notificationPending || !subscribed) return;
    mute.mutate(realmId);
  };

  const handleLeave = () => {
    if (leave.isPending) return;
    leave.mutate(realmId);
  };

  const notificationButtonClass =
    "h-8 rounded-md px-3 aria-disabled:opacity-50";

  const personalizedButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={notificationButtonClass}
      aria-disabled="true"
    >
      {t("settings:realm_membership_notifications_personalized")}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1 rounded-full px-2 md:px-4"
        onClick={() => setOpen(true)}
      >
        <BellIcon className="h-4 w-4" />
        {t("settings:realm_tag_preference_joined_status")}
        <ChevronDownIcon className="h-4 w-4" />
      </Button>
      <DialogContent className="flex max-h-[90vh] min-h-0 w-full flex-col gap-0 overflow-hidden p-0 sm:!max-w-3xl">
        <DialogHeader className="border-b border-border-whisper p-4">
          <DialogTitle>
            {t("settings:realm_tag_preference_dialog_title", {
              realm: realmTitle,
            })}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <CurrentRealmTagPreferencePanel
            realmId={realmId}
            settings={settings}
          />
          <section className="flex min-w-0 flex-col gap-4 border-t border-border-whisper p-4">
            <div className="flex min-w-0 flex-col gap-1">
              <h3 className="text-sm font-medium leading-ui">
                {t("settings:realm_membership_notifications_title")}
              </h3>
              <p className="text-sm leading-ui text-text-secondary">
                {t("settings:realm_membership_notifications_description")}
              </p>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={subscribed ? "default" : "outline"}
                size="sm"
                className={notificationButtonClass}
                onClick={handleNotificationAll}
                disabled={notificationPending}
              >
                <BellIcon className="h-4 w-4" />
                {t("settings:realm_membership_notifications_all")}
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger render={personalizedButton} />
                  <TooltipContent>
                    {t(
                      "settings:realm_membership_notifications_personalized_pending",
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                type="button"
                variant={subscribed ? "outline" : "default"}
                size="sm"
                className={notificationButtonClass}
                onClick={handleNotificationNone}
                disabled={notificationPending}
              >
                {t("settings:realm_membership_notifications_none")}
              </Button>
            </div>
          </section>
          <section className="flex min-w-0 flex-col border-t border-border-whisper p-4">
            <div className="flex justify-start">
              <Button
                type="button"
                variant="destructive"
                className="rounded-md"
                onClick={handleLeave}
                disabled={leave.isPending}
              >
                {t("settings:realm_membership_leave_title")}
              </Button>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
