import type React from "react";
import {
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
  useNotifications,
} from "@rezics/api/notification";
import { Button } from "@rezics/ui/shadcn";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { NotificationCard } from "../components/NotificationCard.tsx";

export const NotificationPage: React.FC = () => {
  const { data, isLoading, isError } = useNotifications(1, 50);
  const markAsRead = useMarkAsReadMutation();
  const markAllAsRead = useMarkAllAsReadMutation();

  const items = data?.items ?? [];

  return (
    <div className="mx-auto mt-16 w-11/12 max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <AccentBarWithText text="Notifications" />
        {items.some((item) => !item.read) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending}
          >
            Mark all as read
          </Button>
        )}
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
      {isError && (
        <p className="text-sm text-destructive">
          Could not load notifications.
        </p>
      )}
      {!isLoading && !isError && items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No notifications yet.
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
