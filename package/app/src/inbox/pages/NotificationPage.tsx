import {
  useMarkAllAsReadMutation,
  useMarkAsReadMutation,
  useNotifications,
} from "@rezics/api/notification";
import {
  common_loading,
  notifications_empty,
  notifications_load_failed,
  notifications_mark_all_read,
  notifications_title,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { Button } from "@rezics/ui/shadcn";
import type React from "react";
import { InboxTabBar } from "../components/InboxTabBar.tsx";
import { NotificationCard } from "../components/NotificationCard.tsx";

const i18nMessages = {
  common_loading,
  notifications_empty,
  notifications_load_failed,
  notifications_mark_all_read,
  notifications_title,
};

export const NotificationPage: React.FC = () => {
  const m = useMessage(i18nMessages);
  const { data, isLoading, isError } = useNotifications(1, 50);
  const markAsRead = useMarkAsReadMutation();
  const markAllAsRead = useMarkAllAsReadMutation();

  const items = data?.items ?? [];

  return (
    <div className="mx-auto mt-16 w-11/12 max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <AccentBarWithText text={m.notifications_title()} />
        {items.some((item) => !item.read) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending}
          >
            {m.notifications_mark_all_read()}
          </Button>
        )}
      </div>
      <InboxTabBar active="notifications" />
      <div className="mt-4" />

      {isLoading && (
        <p className="text-sm text-muted-foreground">{m.common_loading()}</p>
      )}
      {isError && (
        <p className="text-sm text-destructive">
          {m.notifications_load_failed()}
        </p>
      )}
      {!isLoading && !isError && items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {m.notifications_empty()}
        </p>
      )}

      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <NotificationCard
              item={item}
              onClick={() =>
                markAsRead.mutate({
                  kind: item.kind,
                  sourceUnitId: item.sourceUnitId,
                })
              }
            />
          </li>
        ))}
      </ul>
    </div>
  );
};
