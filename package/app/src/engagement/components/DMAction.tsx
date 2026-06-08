import { useIsSubscribed } from "@rezics/api/subscription/subscription";
import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  buttonVariants,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { MessageCircle } from "lucide-react";
import type React from "react";
import { TextLink } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";
import { selectHasMemberSession, useAuthSessionStore } from "@/user";

export interface DMActionProps {
  /**
   * The peer's canonical user id (`USER` Unit id).
   * 对方的规范用户 id（`USER` Unit id）。
   */
  peerUserId: string;
  /**
   * Shown only as the accessible/tooltip label; the button text is fixed.
   * 仅作为无障碍/tooltip 标签显示；按钮文本是固定的。
   */
  peerName?: string;
  showLabel?: boolean;
  className?: string;
}

/**
 * Direct-message entry point. DM is permission-gated: the viewer must be signed
 * in and subscribed to the peer with the DM channel enabled (the
 * `dm_must_subscribe_to_dm` rule the server enforces on send). When signed out
 * the action is hidden; when signed in but not DM-eligible it renders a disabled
 * button explaining why; when eligible it links to the DM inbox addressed to the
 * peer, opening an existing thread if one exists.
 * 私信入口。DM 受权限管控：访问者必须已登录并对该对方持有启用了 DM 频道的订阅
 * （服务端在发送时强制执行 `dm_must_subscribe_to_dm` 规则）。未登录时隐藏该操作；
 * 已登录但不符合 DM 资格时渲染一个禁用按钮并说明原因；符合资格时链接到指向该对方的
 * DM 收件箱，若已存在会话则打开现有会话。
 */
export const DMAction: React.FC<DMActionProps> = ({
  peerUserId,
  peerName,
  showLabel = true,
  className,
}) => {
  const { t } = useTranslation(["community"]);
  const isAuthenticated = useAuthSessionStore(selectHasMemberSession);

  const { data: subscription, isPending } = useIsSubscribed(
    isAuthenticated ? peerUserId : "",
  );

  // Signed out: do not offer the action.
  // 未登录：不提供该操作。
  if (!isAuthenticated) return null;
  // While the eligibility check is in flight, render nothing to avoid flicker.
  // 资格检查进行中时不渲染任何内容，以避免闪烁。
  if (isPending) return null;

  const canDm =
    subscription?.subscribed === true && hasDmChannel(subscription.channels);

  if (!canDm) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled
                aria-label={t("community:dm_must_subscribe_to_dm")}
                className={cn("gap-1.5", className)}
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                {showLabel ? t("community:dm_action") : null}
              </Button>
            }
          />
          <TooltipContent>
            {t("community:dm_must_subscribe_to_dm")}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TextLink
      to="/inbox/dm"
      search={{ peerId: peerUserId }}
      aria-label={
        peerName ? `${t("community:dm_action")} · ${peerName}` : undefined
      }
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "gap-1.5 no-underline",
        className,
      )}
    >
      <MessageCircle className="h-4 w-4" aria-hidden="true" />
      {showLabel ? t("community:dm_action") : null}
    </TextLink>
  );
};

/**
 * Direct messaging requires an active subscription to the peer with the DM channel enabled.
 * 私信要求对该对方持有已启用 DM 频道的有效订阅。
 */
function hasDmChannel(channels: readonly string[] | undefined): boolean {
  if (!channels) return false;
  return channels.some(
    (channel) =>
      channel === "*" || channel === "dm" || channel.startsWith("dm."),
  );
}
