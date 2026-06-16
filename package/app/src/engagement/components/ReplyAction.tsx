import { Button } from "@rezics/ui/shadcn";
import { MessageSquare } from "lucide-react";
import type React from "react";
import { cn } from "@/shared/utils/css-util";
import type { EngagementSize } from "../types";
import { useReactionBarContext } from "./ReactionBarContext";

export type ReplyActionProps = {
  /**
   * Override the size from context. Rarely needed; prefer setting on the bar.
   * 覆盖来自 context 的尺寸。很少需要；优先在 bar 上设置。
   */
  size?: EngagementSize;
  replyCount?: number;
  mode?: "count" | "label";
  onInvoke?: () => void;
};

export const ReplyAction: React.FC<ReplyActionProps> = ({
  size: sizeProp,
  replyCount = 0,
  mode = "count",
  onInvoke,
}) => {
  const ctx = useReactionBarContext();
  const size = sizeProp ?? ctx.size;
  const isPill = ctx.variant === "pill";

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onInvoke?.();
  };

  const showCount = mode === "count" && replyCount > 0;
  const label = showCount ? String(replyCount) : "Reply";

  return (
    <Button
      variant="ghost"
      size={size === "lg" ? "default" : "sm"}
      onClick={handleClick}
      className={cn(
        "min-w-0 gap-1.5 text-text-secondary normal-case hover:text-text-primary",
        size === "sm"
          ? "px-2 text-xs"
          : size === "lg"
            ? "px-2.5 text-[0.95rem]"
            : "px-2.5 text-sm",
        isPill &&
          "rounded-[var(--radius-pill,999px)] bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10",
        !isPill && "hover:bg-black/10 dark:hover:bg-white/10",
      )}
    >
      <MessageSquare size={sizeToIconPx(size)} strokeWidth={2} />
      {label}
    </Button>
  );
};

function sizeToIconPx(size: EngagementSize): number {
  switch (size) {
    case "sm":
      return 16;
    case "lg":
      return 22;
    default:
      return 18;
  }
}
