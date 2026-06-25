import { useDmStream } from "@rezics/contract/api/dm/use-dm-stream";
import { useUnreadCount } from "@rezics/contract/api/notification/notification.queries";
import { useNotificationStream } from "@rezics/contract/api/notification/use-notification-stream";
import { useTranslation } from "@rezics/i18n/react";
import { Badge, Button } from "@rezics/ui/shadcn";
import { Bell as NotificationsIcon } from "lucide-react";
import { HeaderTooltip } from "@/core/components/header/HeaderTooltip";
import { Link } from "@/shared/ui/link";
import { CreateMenu } from "../../components/create-menu/CreateMenu.tsx";
import { AccountMenu } from "./AccountMenu.tsx";

/**
 * 已认证用户的头部部分。显示通知徽章、创建菜单和账户菜单，
 * 同时初始化实时通知和私信流。
 * Authenticated user header section. Displays notification badge, create menu, and account menu,
 * while initializing live notification and DM streams.
 *
 * Mobile:            Tablet:             Desktop:            Ultra-wide:
 * ┌─────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐ ┌─────────────────────┐
 * │ [≡] [🔔99+] [+] │ │ [≡]    [🔔 99+] [+ ▼] │ │ [≡]    [🔔 99+] [+ ▼] │ │ [≡]    [🔔 99+]     │
 * │                 │ │        [@] [▼]       │ │        [@] [▼]       │ │   [+ ▼]   [@] [▼]   │
 * └─────────────────┘ └───────────────────────┘ └───────────────────────┘ └─────────────────────┘
 */
export function AuthenticatedSection() {
  // Live notification + DM streams — mounted once at the authenticated
  // shell level. The DM stream invalidates conversation/thread caches
  // on each incoming `dm.message` or `dm.read` event.
  // 实时通知 + 私信流——在已认证的 shell 层级仅挂载一次。
  // 每当收到 `dm.message` 或 `dm.read` 事件时，DM 流会使会话/线程缓存失效。
  const { t } = useTranslation(["shell"]);
  useNotificationStream();
  useDmStream();
  const { data } = useUnreadCount();
  const unread = data?.count ?? 0;
  const badgeText = unread > 99 ? "99+" : String(unread);

  return (
    <div className="flex items-center gap-1 md:gap-2">
      <Link to="/inbox/notification">
        <HeaderTooltip label={t("shell:app_inbox_tooltip")}>
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              unread > 0
                ? t("shell:app_notifications_unread", { count: unread })
                : t("shell:app_notifications_aria_label")
            }
            className="relative h-9 min-w-9 rounded-full bg-transparent md:h-10 md:min-w-10"
          >
            <NotificationsIcon className="w-5 h-5" />
            {unread > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]"
              >
                {badgeText}
              </Badge>
            )}
          </Button>
        </HeaderTooltip>
      </Link>
      <CreateMenu />
      <AccountMenu />
    </div>
  );
}
