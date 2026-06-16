import type { ShelfItemKind, ShelfItemType } from "@rezics/api/shelf";
import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import { BookmarkPlus } from "lucide-react";
import type React from "react";
import { CollectionModal } from "@/collection";
import { cn } from "@/shared/utils/css-util";
import { useShelfTrigger } from "../hooks/useShelfTrigger";
import type { EngagementSize } from "../types";
import { useReactionBarContext } from "./ReactionBarContext";

export type ShelfActionProps = {
  targetUnitId: string;
  variantUnitId?: string;
  targetItemType?: ShelfItemType;
  targetKind?: ShelfItemKind;
  /** Override the size from context. Rarely needed; prefer setting on the bar. 覆盖来自 context 的 size。很少需要；优先在 bar 上设置。 */
  size?: EngagementSize;
  /** When the target is a review, the collection modal surfaces the review-specific dual-mode UI. 当目标是评论时，收藏模态框会展示评论专属的双模式 UI。 */
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
  const { isAuthenticated, collection, auth, handleClick } = useShelfTrigger({
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
        <BookmarkPlus size={sizeToIconPx(size)} strokeWidth={2} />
        {t("shelf_title")}
      </Button>
      {isAuthenticated ? (
        <CollectionModal
          open={collection.open}
          onClose={collection.handleClose}
          onCollect={collection.handleCollect}
          shelves={collection.shelves}
          status={collection.status}
          isCollecting={collection.isCollecting}
          isLoading={collection.isLoading}
          isReview={isReview}
        />
      ) : (
        auth.AuthModal({})
      )}
    </>
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
