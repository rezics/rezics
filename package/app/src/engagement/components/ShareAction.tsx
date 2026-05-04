import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rezics/ui/shadcn";
import { Share2 } from "lucide-react";
import type React from "react";
import { cn } from "@/shared/utils/css-util";
import { useShareMenu } from "../hooks/useShareMenu";
import type { EngagementSize } from "../types";
import { useReactionBarContext } from "./ReactionBarContext";

export type ShareActionProps = {
  /** Override the size from context. Rarely needed; prefer setting on the bar. */
  size?: EngagementSize;
  /** Absolute or relative URL to share. Resolved via `getShareHref` at the call site. */
  href: string;
  /** Optional title for the Web Share API. */
  title?: string;
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

export const ShareAction: React.FC<ShareActionProps> = ({
  size: sizeProp,
  href,
  title,
}) => {
  const ctx = useReactionBarContext();
  const size = sizeProp ?? ctx.size;
  const isPill = ctx.variant === "pill";
  const { canWebShare, handleCopy, handleWebShare } = useShareMenu({
    href,
    title,
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={size === "lg" ? "default" : "sm"}
          onClick={(event) => event.stopPropagation()}
          className={cn(
            "min-w-0 gap-1.5 text-text-secondary normal-case hover:text-text-primary",
            size === "sm" ? "px-2 text-xs" : size === "lg" ? "px-2.5 text-[0.95rem]" : "px-2.5 text-sm",
            isPill && "rounded-[var(--rezics-radius-pill,999px)] bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10",
            !isPill && "hover:bg-black/10 dark:hover:bg-white/10",
          )}
        >
          <Share2 size={sizeToIconPx(size)} strokeWidth={2} />
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onClick={(event) => event.stopPropagation()}
      >
        <DropdownMenuItem onClick={handleCopy}>Copy link</DropdownMenuItem>
        {canWebShare && (
          <DropdownMenuItem onClick={handleWebShare}>Share…</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
