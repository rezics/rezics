import { useDmBlockState, useSetDmBlockMutation } from "@rezics/api/dm/dm";
import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import { Ban } from "lucide-react";
import type React from "react";
import { cn } from "@/shared/utils/css-util";
import { selectHasMemberSession, useAuthSessionStore } from "@/user";

export interface BlockPeerActionProps {
  /** The peer's canonical user id (`USER` Unit id). 对方的规范用户 id（`USER` Unit id）。 */
  peerUserId: string;
  showLabel?: boolean;
  className?: string;
}

/**
 * Block/unblock a peer's direct messages. Shared between the profile DM action
 * area and the DM thread header. Hidden when signed out. Reflects and toggles
 * the viewer's own block (`peerBlocked`) via the typed DM block mutation.
 * 屏蔽/取消屏蔽某位对方的私信。在个人资料的私信操作区与私信会话头部之间共享。
 * 未登录时隐藏。通过带类型的 DM block mutation 反映并切换浏览者自己的屏蔽状态
 * （`peerBlocked`）。
 */
export const BlockPeerAction: React.FC<BlockPeerActionProps> = ({
  peerUserId,
  showLabel = true,
  className,
}) => {
  const { t } = useTranslation(["community"]);
  const isAuthenticated = useAuthSessionStore(selectHasMemberSession);
  const { data: blockState } = useDmBlockState(
    isAuthenticated ? peerUserId : "",
  );
  const setBlock = useSetDmBlockMutation();

  if (!isAuthenticated) return null;

  const peerBlocked = blockState?.peerBlocked ?? false;
  const label = peerBlocked
    ? t("community:dm_unblock")
    : t("community:dm_block");

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("gap-1.5", className)}
      disabled={setBlock.isPending}
      aria-label={showLabel ? undefined : label}
      onClick={() =>
        setBlock.mutate({ peerId: peerUserId, blocked: !peerBlocked })
      }
    >
      <Ban className="h-4 w-4" aria-hidden="true" />
      {showLabel ? label : null}
    </Button>
  );
};
