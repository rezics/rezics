import { useReactionData } from "@rezics/api/reaction/reaction";
import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@rezics/ui/shadcn";
import { Copy, FilePenLine, Send, Share2 } from "lucide-react";
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
  /** Target Unit id whose authenticated share intent should be counted. */
  targetId?: string;
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
  targetId,
}) => {
  const { t } = useTranslation(["common"]);
  const ctx = useReactionBarContext();
  const size = sizeProp ?? ctx.size;
  const isPill = ctx.variant === "pill";
  const { shareCount } = useReactionData(targetId ?? "");
  const {
    authModal,
    canInternalShare,
    canWebShare,
    handleCopy,
    handleDirectShare,
    handleOpen,
    handleWebShare,
    handleWriteShare,
    isInternalSharePending,
  } = useShareMenu({ href, title, targetId });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          nativeButton
          render={(props) => (
            <Button
              {...props}
              variant="ghost"
              size={size === "lg" ? "default" : "sm"}
              onClick={(event) => {
                props.onClick?.(event);
                handleOpen(event);
              }}
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
              <Share2 size={sizeToIconPx(size)} strokeWidth={2} />
              <span>{t("common:share")}</span>
              {shareCount > 0 ? (
                <span className="tabular-nums text-text-tertiary">
                  {shareCount}
                </span>
              ) : null}
            </Button>
          )}
        />
        <DropdownMenuContent
          align="start"
          onClick={(event) => event.stopPropagation()}
        >
          <DropdownMenuLabel>{t("common:share_to_rezics")}</DropdownMenuLabel>
          <DropdownMenuItem
            disabled={!canInternalShare || isInternalSharePending}
            onClick={handleDirectShare}
          >
            <Send className="h-4 w-4" aria-hidden />
            {t("common:share_direct")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canInternalShare || isInternalSharePending}
            onClick={handleWriteShare}
          >
            <FilePenLine className="h-4 w-4" aria-hidden />
            {t("common:share_write")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleCopy}>
            <Copy className="h-4 w-4" aria-hidden />
            {t("common:copy_link")}
          </DropdownMenuItem>
          {canWebShare && (
            <DropdownMenuItem onClick={handleWebShare}>
              <Share2 className="h-4 w-4" aria-hidden />
              {t("common:share_via")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {authModal}
    </>
  );
};
