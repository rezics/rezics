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

export const SettingsNotificationsSection: FC = () => {
  const { t } = useTranslation(["common", "settings"]);
  useRequireAuth();

  const { data: settings, isLoading } = useQuery(userQueries.settings());
  const updateSettings = useUpdateSettingsMutation();
  const [saved, setSaved] = useState(false);

  // Labels/descriptions are looked up with static literal keys (never a
  // variable) so the i18n checker can resolve every one.
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
