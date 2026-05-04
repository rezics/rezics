import type { ShelfDTO } from "@rezics/contract";
import { Card, CardContent } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { ReactionBar, type ReactionBarPost } from "@/engagement";
import { cn } from "@/shared/utils/css-util";
import { getTranslation } from "@/shared/utils/translation-helpers";
import { shelfCardActions, shelfPolicy } from "@/shelf/models/shelfPolicy";

interface ShelfCardProps {
  shelf: ShelfDTO;
  className?: string;
}

export const ShelfCard: React.FC<ShelfCardProps> = ({ shelf, className }) => {
  const navigate = useNavigate();
  const translation = getTranslation(shelf.translations);
  const title = translation?.title ?? "";
  const description = translation?.description ?? "";
  const itemsCount = shelf.items?.length ?? 0;

  const handleOpenShelf = () => {
    if (!shelf.unitId) return;
    navigate({
      to: "/shelf/$shelfId",
      params: { shelfId: shelf.unitId },
    });
  };

  const handleReplyInvoke = () => {
    if (!shelf.unitId) return;
    navigate({
      to: "/shelf/$shelfId",
      params: { shelfId: shelf.unitId },
      search: { focus: "reply" },
    });
  };

  const reactionPost: ReactionBarPost = {
    unitId: shelf.unitId,
    reactionSummaries: shelf.reactionSummaries as unknown[] | undefined,
    replyCount: (shelf as unknown as { replyCount?: number }).replyCount,
  };

  return (
    <Card
      className={cn(
        "border-0 shadow-none",
        shelf.unitId && "cursor-pointer",
        className,
      )}
      onClick={handleOpenShelf}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-border-whisper">
        {shelf.coverUrl ? (
          <img
            src={shelf.coverUrl}
            alt={title || "Shelf cover"}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, var(--rezics-sys-color-surface-subtle, rgba(0,0,0,0.04)), var(--rezics-sys-color-surface-canvas, transparent))",
            }}
          >
            <span className="text-xs text-text-secondary">
              {itemsCount} items
            </span>
          </div>
        )}
      </div>

      <CardContent>
        <h3 className="truncate text-lg font-semibold">
          {title || "Untitled Shelf"}
        </h3>

        <p className="mt-1 line-clamp-2 text-sm text-text-secondary">
          {description || "No description"}
        </p>

        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-xs text-text-secondary">
            {itemsCount} items
          </span>
          <span
            className="whitespace-nowrap text-xs text-text-brand"
            style={{ lineHeight: 1 }}
          >
            {shelf.user?.name || "Anonymous"}
          </span>
        </div>

        <div className="mt-3">
          <ReactionBar
            size="md"
            post={reactionPost}
            policy={shelfPolicy}
            actions={shelfCardActions}
            onReplyInvoke={handleReplyInvoke}
          />
        </div>
      </CardContent>
    </Card>
  );
};
