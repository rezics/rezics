import {
  useMarkAsReadMutation,
  useNotifications,
} from "@rezics/api/notification";
import { useTranslation } from "@rezics/i18n/react";
import { NotificationCard } from "../components/NotificationCard.tsx";

export function NotificationTabSection() {
  const { t } = useTranslation(["common", "settings"]);
  const { data, isLoading, isError } = useNotifications(1, 10);
  const markAsRead = useMarkAsReadMutation();

  const items = data?.items ?? [];

  return (
    <div className="flex w-full max-w-sm flex-col gap-1 p-2">
      {isLoading && (
        <p className="px-2 py-4 text-sm text-muted-foreground">
          {t("common:loading")}
        </p>
      )}
      {isError && (
        <p className="px-2 py-4 text-sm text-destructive">
          {t("settings:notifications_load_failed")}
        </p>
      )}
      {!isLoading && !isError && items.length === 0 && (
        <p className="px-2 py-4 text-sm text-muted-foreground">
          {t("settings:notifications_empty")}
        </p>
      )}
      {items.map((item) => (
        <NotificationCard
          key={item.id}
          item={item}
          onClick={() =>
            markAsRead.mutate({
              kind: item.kind,
              sourceUnitId: item.sourceUnitId,
            })
          }
        />
      ))}
    </div>
  );
}
