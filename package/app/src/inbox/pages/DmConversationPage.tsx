import { useConversation } from "@rezics/api/dm/dm";
import { useTranslation } from "@rezics/i18n/react";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { Link, useParams } from "@tanstack/react-router";
import type React from "react";
import { QueryErrorDisplay } from "@/core";
import { ConversationThreadSection } from "../sections/ConversationThreadSection";

/**
 * 直接消息会话页面 —— 显示与单个对方的完整消息线程。
 * Direct message conversation page — displays complete message thread with a single peer.
 *
 * 响应式布局：全宽容器最大 768px，边距自适应。所有断点统一采用
 * flex column 堆叠式布局。会话头部（标题 + 返回链接）固定在消息线程上方。
 * Responsive layout: full-width container max 768px, margins auto-adapt. All breakpoints
 * use unified flex-column stacking. Thread header (title + back link) fixed above messages.
 *
 * Mobile <640px:
 *   [  Peer Name      ] ← link
 *   [  Message Thread ]
 *   [  Input + Send   ]
 *
 * Tablet 640-1023px:
 *   [     Peer Name        ] ← link
 *   [     Message Thread    ]
 *   [     Input + Send      ]
 *
 * Desktop 1024-1535px:
 *   [            Peer Name               ] ← link
 *   [            Message Thread          ]
 *   [            Input + Send            ]
 *
 * Ultra-wide >=1536px:
 *   [                    Peer Name                      ] ← link
 *   [                    Message Thread                 ]
 *   [                    Input + Send                   ]
 *
 * 所有宽度下采用一致的居中对齐（mx-auto），左右内边距 w-11/12（11/12 = 91.67%）。
 * 消息线程区 h-[calc(100vh-8rem)] 自适应窗口高度，减去顶部导航栏和标题空间。
 * All widths: centered alignment (mx-auto), padded sides w-11/12 (91.67%). Message area
 * h-[calc(100vh-8rem)] adapts to viewport, subtracting nav and title space.
 */
export const DmConversationPage: React.FC = () => {
  const { t } = useTranslation(["community"]);
  const { conversationId } = useParams({
    from: "/_mainLayout/inbox/dm/$conversationId",
  });
  const {
    data: conversation,
    isError,
    error,
  } = useConversation(conversationId);
  const peerLabel =
    conversation?.peerName ??
    conversation?.peerSlug ??
    conversation?.peerId ??
    t("community:inbox_conversation_title");

  return (
    <div className="mx-auto mt-16 flex h-[calc(100vh-8rem)] w-full px-4 max-w-3xl flex-col">
      <div className="mb-4 flex items-center justify-between">
        <AccentBarWithText text={peerLabel} />
        <Link
          to="/inbox/dm"
          className="text-sm text-text-secondary hover:text-text-primary"
        >
          {t("community:inbox_all_conversations")}
        </Link>
      </div>
      {isError ? (
        // Conversation query failed — show error instead of infinite loading
        // 会话查询失败 —— 显示错误而非无限加载
        <QueryErrorDisplay error={error} />
      ) : conversation ? (
        <ConversationThreadSection
          conversationId={conversationId}
          peerId={conversation.peerId}
        />
      ) : (
        <p className="text-sm text-text-secondary">
          {t("community:inbox_conversation_loading")}
        </p>
      )}
    </div>
  );
};
