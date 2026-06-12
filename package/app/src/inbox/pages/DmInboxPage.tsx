import { useTranslation } from "@rezics/i18n/react";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { getRouteApi } from "@tanstack/react-router";
import type React from "react";
import { InboxTabBar } from "../components/InboxTabBar";
import { ConversationListSection } from "../sections/ConversationListSection";

const routeApi = getRouteApi("/_mainLayout/inbox/dm/");

/**
 * 直接消息收件箱页面 —— 显示所有对话的列表，按最近活动时间排序。
 * Direct message inbox page — displays list of all conversations sorted by recent activity.
 *
 * 响应式布局：全宽容器最大 768px，中心对齐。
 * 标题、标签页和对话列表纵向堆叠，每个元素间隔适当。
 * Responsive layout: full-width container max 768px, center-aligned. Title, tab bar, and
 * conversation list stacked vertically with appropriate spacing.
 *
 * Mobile <640px:
 *   [  DM Inbox  ]
 *   [  DM | N... ]
 *   [  Conv 1    ]
 *   [  Conv 2    ]
 *   [  ...       ]
 *
 * Tablet 640-1023px:
 *   [      DM Inbox       ]
 *   [      DM | Notif ... ]
 *   [      Conv 1         ]
 *   [      Conv 2         ]
 *   [      ...            ]
 *
 * Desktop 1024-1535px:
 *   [            DM Inbox              ]
 *   [            DM | Notifications... ]
 *   [            Conv 1                ]
 *   [            Conv 2                ]
 *   [            ...                   ]
 *
 * Ultra-wide >=1536px:
 *   [                    DM Inbox                    ]
 *   [                    DM | Notifications...       ]
 *   [                    Conv 1                      ]
 *   [                    Conv 2                      ]
 *   [                    ...                         ]
 *
 * 所有宽度下统一采用 w-11/12（11/12 = 91.67%）左右内边距，
 * mx-auto 中心对齐。标题下方间距 mb-6，标签页下间距 mt-4。
 * All widths: unified w-11/12 (91.67%) side padding, mx-auto center alignment.
 * Title spacing mb-6, tab spacing mt-4.
 */
export const DmInboxPage: React.FC = () => {
  const { t } = useTranslation();
  const { peerId } = routeApi.useSearch();
  return (
    <div className="mx-auto mt-16 w-full px-4 max-w-3xl">
      <div className="mb-6">
        <AccentBarWithText text={t("community:dm_inbox_title")} />
      </div>
      <InboxTabBar active="dm" />
      <div className="mt-4">
        <ConversationListSection openPeerId={peerId} />
      </div>
    </div>
  );
};
