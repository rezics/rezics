"use client";

import {
  BellIcon,
  CheckIcon,
  MessageSquareIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/locale";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | [Mark all read]             |
 * |-----------------------------|
 * | [ico] User replied...  [rd] |
 * | [ico] User mentioned.  [rd] |
 * | [ico] User followed ...[rd] |
 * |       (empty state)         |
 * +-----------------------------+
 * w-full, items stack vertically.
 * [ico] = type icon (shrink-0), content truncates (min-w-0 truncate),
 * [rd] = mark-read button (shrink-0). Narrow: icon 16px, text truncates.
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * |                      [Mark all read] |
 * |--------------------------------------|
 * | [ico] User replied to ...     2h [v] |
 * | [ico] User mentioned you     5h [v] |
 * | [ico] User followed you     1d [v]  |
 * +--------------------------------------+
 * max-w-3xl mx-auto (inherited from inbox layout).
 * Time column visible alongside action.
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * |                          [Mark all read] |
 * |------------------------------------------|
 * | [ico]  User replied to your...  2h  [v]  |
 * | [ico]  User mentioned you in... 5h  [v]  |
 * +------------------------------------------+
 * Same as Tablet, wider content area.
 *
 * Ultra-wide (>=1536px):
 * Same as Desktop.
 *
 * 通知列表页。每条通知显示类型图标 + 内容 + 时间 + 标记已读按钮。
 * 空状态时显示占位提示。
 */

export interface NotificationItem {
  readonly id: string;
  readonly type: "reply" | "mention" | "follow" | "realm_invite";
  readonly actorName: string;
  readonly targetName?: string;
  readonly time: string;
  readonly read: boolean;
}

// Placeholder data until API is connected
// API 连接前的占位数据
const PLACEHOLDER_NOTIFICATIONS: readonly NotificationItem[] = [];

const ICON_MAP = {
  reply: MessageSquareIcon,
  mention: BellIcon,
  follow: UserPlusIcon,
  realm_invite: UsersIcon,
} as const;

export function NotificationsContent({
  initialNotifications = PLACEHOLDER_NOTIFICATIONS,
}: {
  readonly initialNotifications?: readonly NotificationItem[];
} = {}) {
  const [t] = useT();
  const [notifications, setNotifications] =
    useState<readonly NotificationItem[]>(initialNotifications);

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const NOTIFICATION_TEXT_MAP: Record<
    NotificationItem["type"],
    (item: NotificationItem) => string
  > = {
    reply: (item) => t.inbox.notificationReply(item.actorName),
    mention: (item) => t.inbox.notificationMention(item.actorName),
    follow: (item) => t.inbox.notificationFollow(item.actorName),
    realm_invite: (item) =>
      t.inbox.notificationRealmInvite(item.targetName ?? ""),
  };

  const getNotificationText = (item: NotificationItem): string =>
    NOTIFICATION_TEXT_MAP[item.type](item);

  if (notifications.length === 0) {
    return (
      <div className="text-muted-foreground py-12 text-center text-sm">
        {t.inbox.noNotifications}
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      <div className="flex justify-end">
        <Button onClick={markAllRead} size="sm" variant="ghost">
          <CheckIcon className="mr-1.5 size-3.5" />
          {t.inbox.markAllRead}
        </Button>
      </div>

      <ul className="divide-border divide-y">
        {notifications.map((item) => {
          const Icon = ICON_MAP[item.type];
          return (
            <li
              className={`flex items-center gap-3 px-2 py-3 ${
                item.read ? "opacity-60" : ""
              }`}
              key={item.id}
            >
              {/* Type icon — fixed size */}
              {/* 类型图标 — 固定尺寸 */}
              <span className="text-muted-foreground shrink-0">
                <Icon className="size-4" />
              </span>

              {/* Content — truncates when narrow */}
              {/* 内容 — 窄屏时截断 */}
              <span className="min-w-0 flex-1 truncate text-sm">
                {getNotificationText(item)}
              </span>

              {/* Time — hidden on very narrow, visible from sm */}
              {/* 时间 — 极窄时隐藏，sm 起可见 */}
              <span className="text-muted-foreground hidden shrink-0 text-xs sm:inline">
                {item.time}
              </span>

              {/* Mark-read button */}
              {/* 标记已读按钮 */}
              {!item.read && (
                <Button
                  className="shrink-0"
                  onClick={() => markAsRead(item.id)}
                  size="icon-xs"
                  variant="ghost"
                >
                  <CheckIcon className="size-3.5" />
                  <span className="sr-only">{t.inbox.markAsRead}</span>
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function NotificationsPage() {
  return <NotificationsContent />;
}
