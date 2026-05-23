import {
  useMarkAsReadMutation,
  useNotifications,
} from "@rezics/api/notification";
import * as m from "@rezics/i18n/messages";
import { NotificationCard } from "../components/NotificationCard.tsx";

export function NotificationTabSection() {
  const { data, isLoading, isError } = useNotifications(1, 10);
  const markAsRead = useMarkAsReadMutation();

  const items = data?.items ?? [];

  return (
    <div className="flex w-full max-w-sm flex-col gap-1 p-2">
      {isLoading && (
        <p className="px-2 py-4 text-sm text-muted-foreground">
          {m.common_loading()}
        </p>
      )}
      {isError && (
        <p className="px-2 py-4 text-sm text-destructive">
          {m.notifications_load_failed()}
        </p>
      )}
      {!isLoading && !isError && items.length === 0 && (
        <p className="px-2 py-4 text-sm text-muted-foreground">
          {m.notifications_empty()}
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
