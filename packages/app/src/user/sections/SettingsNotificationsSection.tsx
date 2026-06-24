import { useUpdateSettingsMutation } from "@rezics/api/user/user.mutations";
import { userQueries } from "@rezics/api/user/user.queries";
import {
  NOTIFICATION_PREFERENCE_KEYS,
  type NotificationPreferenceKey,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Alert, AlertDescription, Checkbox } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { type FC, useState } from "react";
import { SettingsSection } from "@/user/components/SettingsSection";
import { useRequireAuth } from "@/user/pages/useAuth";

/**
 * 通知部分：允许用户管理各种通知偏好（回复、关注、直消、审核、领域、系统）。
 * 用户可以独立切换每种通知类型，即时反馈保存确认消息，以及错误提示。
 *
 * Desktop (≥1024px):
 * ┌─────────────────────────────────────┐
 * │ Notification Preferences            │
 * │ Saved: Settings updated!            │
 * │                                     │
 * │ [X] Replies                         │
 * │     Notify when someone replies     │
 * │ [X] Follows                         │
 * │     Notify when someone follows     │
 * │ [ ] Direct Messages                 │
 * │     Notify on new direct messages   │
 * │ [X] Moderation                      │
 * │     Notify on moderation actions    │
 * │ [X] Realm Notifications             │
 * │     Notify on realm activity        │
 * │ [X] System Notifications            │
 * │     Notify on system updates        │
 * └─────────────────────────────────────┘
 *
 * Tablet (768px-1023px):
 * ┌──────────────────────────────┐
 * │ Notification Preferences     │
 * │ [Saved]                      │
 * │                              │
 * │ [X] Replies                  │
 * │     Notify when someone      │
 * │     replies to you           │
 * │ [X] Follows                  │
 * │     Notify when someone      │
 * │     follows you              │
 * │ [ ] Direct Messages          │
 * │     Notify on new DM         │
 * │ [X] Moderation               │
 * │     Notify on moderation     │
 * └──────────────────────────────┘
 *
 * Mobile (480px-767px):
 * ┌──────────────────┐
 * │Notification      │
 * │Preferences       │
 * │[Saved]           │
 * │                  │
 * │[X] Replies       │
 * │    Reply notify  │
 * │[X] Follows       │
 * │    Follow notify │
 * │[ ] Direct Msg    │
 * │    DM notify     │
 * │[X] Moderation    │
 * │    Mod notify    │
 * └──────────────────┘
 *
 * Small Mobile (<480px):
 * ┌──────────┐
 * │Notif     │
 * │[Saved]   │
 * │          │
 * │[X]Reply  │
 * │[X]Follow │
 * │[ ]DM     │
 * │[X]Mod    │
 * │[X]Realm  │
 * │[X]System │
 * └──────────┘
 */
export const SettingsNotificationsSection: FC = () => {
  const { t } = useTranslation(["common", "settings"]);
  useRequireAuth();

  const { data: settings, isLoading } = useQuery(userQueries.settings());
  const updateSettings = useUpdateSettingsMutation();
  const [saved, setSaved] = useState(false);

  // Labels/descriptions are looked up with static literal keys (never a
  // variable) so the i18n checker can resolve every one.
  // 标签/描述使用静态字面量键（绝不用变量）查找，以便 i18n 检查器能解析每一个。
  const labels: Record<NotificationPreferenceKey, string> = {
    reply: t("settings:notification_prefs_kind_reply"),
    follow: t("settings:notification_prefs_kind_follow"),
    dm: t("settings:notification_prefs_kind_dm"),
    moderation: t("settings:notification_prefs_kind_moderation"),
    realm: t("settings:notification_prefs_kind_realm"),
    system: t("settings:notification_prefs_kind_system"),
  };
  const descriptions: Record<NotificationPreferenceKey, string> = {
    reply: t("settings:notification_prefs_kind_reply_desc"),
    follow: t("settings:notification_prefs_kind_follow_desc"),
    dm: t("settings:notification_prefs_kind_dm_desc"),
    moderation: t("settings:notification_prefs_kind_moderation_desc"),
    realm: t("settings:notification_prefs_kind_realm_desc"),
    system: t("settings:notification_prefs_kind_system_desc"),
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  const prefs = settings?.notifications ?? {};

  const handleToggle = (key: NotificationPreferenceKey, next: boolean) => {
    updateSettings.mutate(
      { notifications: { [key]: next } },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
      },
    );
  };

  return (
    <SettingsSection
      title={t("settings:notification_prefs_title")}
      description={t("settings:notification_prefs_description")}
      divider={false}
    >
      {saved && (
        <Alert className="mb-4 text-success-text" aria-live="polite">
          <AlertDescription>
            {t("settings:notification_prefs_saved")}
          </AlertDescription>
        </Alert>
      )}
      {updateSettings.error && (
        <Alert variant="destructive" className="mb-4" aria-live="assertive">
          <AlertDescription>{updateSettings.error.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-5">
        {NOTIFICATION_PREFERENCE_KEYS.map((key) => {
          const enabled = prefs[key] !== false;
          return (
            <label
              key={key}
              htmlFor={`notif-${key}`}
              className="flex items-start gap-3 cursor-pointer"
            >
              <Checkbox
                id={`notif-${key}`}
                checked={enabled}
                disabled={updateSettings.isPending}
                onCheckedChange={(checked) =>
                  handleToggle(key, checked === true)
                }
                className="mt-0.5"
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium">{labels[key]}</span>
                <span className="text-sm text-text-secondary">
                  {descriptions[key]}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </SettingsSection>
  );
};
