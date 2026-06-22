import type { ShelfItemKind, ShelfItemType } from "@rezics/api/shelf";
import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import { BookmarkPlus } from "lucide-react";
import type React from "react";
import { cn } from "@/shared/utils/css-util";
import { AddToShelfDialog } from "@/shelf";
import { useShelfTrigger } from "../hooks/useShelfTrigger";
import { ENGAGEMENT_ICON_PX, type EngagementSize } from "../types";
import { useReactionBarContext } from "./ReactionBarContext";

export type ShelfActionProps = {
  targetUnitId: string;
  variantUnitId?: string;
  targetItemType?: ShelfItemType;
  targetKind?: ShelfItemKind;
  /** Override the size from context. Rarely needed; prefer setting on the bar. 覆盖来自 context 的 size。很少需要；优先在 bar 上设置。 */
  size?: EngagementSize;
  /** When the target is a review, the shelf dialog surfaces the review-specific dual-mode UI. 当目标是评论时，书架弹窗会展示评论专属的双模式 UI。 */
  isReview?: boolean;
};

export const ShelfAction: React.FC<ShelfActionProps> = ({
  targetUnitId,
  variantUnitId,
  targetItemType,
  targetKind,
  size: sizeProp,
  isReview,
}) => {
  const { t } = useTranslation("entity");
  const ctx = useReactionBarContext();
  const size = sizeProp ?? ctx.size;
  const isPill = ctx.variant === "pill";
  const { isAuthenticated, addToShelf, auth, handleClick } = useShelfTrigger({
    targetUnitId,
    variantUnitId,
    targetItemType,
    targetKind,
  });

  return (
    <>
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
        <BookmarkPlus size={ENGAGEMENT_ICON_PX[size]} strokeWidth={2} />
        {t("shelf_title")}
      </Button>
      {isAuthenticated ? (
        <AddToShelfDialog
          open={addToShelf.open}
          onOpenChange={addToShelf.setOpen}
          targetUnitId={targetUnitId}
          variantUnitId={variantUnitId}
          targetItemType={targetItemType}
          targetKind={targetKind}
          isReview={isReview}
        />
      ) : (
        auth.AuthModal({})
      )}
    </>
  );
};
