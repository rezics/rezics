"use client";

import type { ReactNode } from "react";
import { type NotificationItem, NotificationsContent } from "./page";

const notifications: readonly NotificationItem[] = [
  {
    id: "notif-reply",
    type: "reply",
    actorName: "Alice Chen",
    time: "2h",
    read: false,
  },
  {
    id: "notif-mention",
    type: "mention",
    actorName: "一个名字非常非常长的用户用于压测通知列表的单行截断行为",
    time: "5h",
    read: false,
  },
  {
    id: "notif-follow",
    type: "follow",
    actorName: "Carol Liu",
    time: "1d",
    read: true,
  },
  {
    id: "notif-realm",
    type: "realm_invite",
    actorName: "Dave Zhang",
    targetName: "一个名字非常非常长的 realm 邀请目标用于压测通知内容截断",
    time: "Jun 18",
    read: true,
  },
];

function Frame({ children }: { readonly children: ReactNode }) {
  return <div className="mx-auto w-full max-w-3xl p-4">{children}</div>;
}

export default {
  Empty: (
    <Frame>
      <NotificationsContent />
    </Frame>
  ),
  MixedReadState: (
    <Frame>
      <NotificationsContent initialNotifications={notifications} />
    </Frame>
  ),
  MobilePressure: (
    <div className="w-80 p-3">
      <NotificationsContent initialNotifications={notifications} />
    </div>
  ),
  WidePressure: (
    <div className="mx-auto w-full max-w-6xl p-6">
      <NotificationsContent initialNotifications={notifications} />
    </div>
  ),
};
