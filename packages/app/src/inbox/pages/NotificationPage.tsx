import {
  useMarkAllAsReadMutation,
  useMarkAsReadMutation,
} from "@rezics/contract/api/notification/notification.mutations";
import { useNotifications } from "@rezics/contract/api/notification/notification.queries";
import { useTranslation } from "@rezics/i18n/react";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { Button } from "@rezics/ui/shadcn";
import type React from "react";
import { InboxTabBar } from "../components/InboxTabBar.tsx";
import { NotificationCard } from "../components/NotificationCard.tsx";

/**
 * 通知页面 —— 显示用户通知列表，支持全部标记为已读操作。
 * Notification page — displays user notification list with mark-all-as-read capability.
 *
 * 响应式布局：全宽容器最大 768px，中心对齐。
 * 标题行（带"全部标记已读"按钮）、标签页、通知卡片列表纵向堆叠。
 * Responsive layout: full-width container max 768px, center-aligned. Title row with
 * "mark all as read" button, tab bar, and notification card list stacked vertically.
 *
 * Mobile <640px:
 *   [  通知  ] [标记已读]
 *   [   DM | 通知  ]
 *   [   Notification 1  ]
 *   [   Notification 2  ]
 *   [   ...             ]
 *
 * Tablet 640-1023px:
 *   [      通知          ] [标记已读]
 *   [      DM | 通知     ]
 *   [      Notification 1   ]
 *   [      Notification 2   ]
 *   [      ...              ]
 *
 * Desktop 1024-1535px:
 *   [             通知                ] [标记已读]
 *   [             DM | 通知            ]
 *   [             Notification 1       ]
 *   [             Notification 2       ]
 *   [             ...                  ]
 *
 * Ultra-wide >=1536px:
 *   [                    通知                      ] [标记已读]
 *   [                    DM | 通知                 ]
 *   [                    Notification 1            ]
 *   [                    Notification 2            ]
 *   [                    ...                       ]
 *
 * 标题行 justify-between，按钮仅在存在未读通知时显示。通知列表采用
 * flex flex-col gap-1，每条通知独占一行。所有宽度下统一采用 w-11/12
 * 左右内边距和 mx-auto 中心对齐。
 * Title row justify-between, button shows only if unread exist. Notification list
 * flex flex-col gap-1, one per row. All widths: unified w-11/12 padding, mx-auto.
 */
export const NotificationPage: React.FC = () => {
  const { t } = useTranslation(["common", "settings"]);
  const { data, isLoading, isError } = useNotifications(1, 50);
  const markAsRead = useMarkAsReadMutation();
  const markAllAsRead = useMarkAllAsReadMutation();

  const items = data?.items ?? [];

  return (
    <div className="mx-auto mt-16 w-full px-4 max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <AccentBarWithText text={t("settings:notifications_title")} />
        {items.some((item) => !item.read) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending}
          >
            {t("settings:notifications_mark_all_read")}
          </Button>
        )}
      </div>
      <InboxTabBar active="notifications" />
      <div className="mt-4" />

      {isLoading && (
        <p className="text-sm text-muted-foreground">{t("common:loading")}</p>
      )}
      {isError && (
        <p className="text-sm text-destructive">
          {t("settings:notifications_load_failed")}
        </p>
      )}
      {!isLoading && !isError && items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t("settings:notifications_empty")}
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
