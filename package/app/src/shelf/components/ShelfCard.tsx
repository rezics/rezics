import { Box, Card, CardContent, Typography, useTheme } from "@mui/material";
import type { ShelfDTO } from "@rezics/contract";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { ReactionBar, type ReactionBarPost } from "@/engagement";
import { shelfCardActions, shelfPolicy } from "@/shelf/models/shelfPolicy";
import { getTranslation } from "@/shared/utils/translation-helpers";

interface ShelfCardProps {
  shelf: ShelfDTO;
  className?: string;
}

export const ShelfCard: React.FC<ShelfCardProps> = ({ shelf, className }) => {
  const theme = useTheme();
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
      elevation={0}
      className={className}
      onClick={handleOpenShelf}
      sx={shelf.unitId ? { cursor: "pointer" } : undefined}
    >
      <Box
        className="w-full aspect-[16/9] overflow-hidden relative"
        sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}
      >
        {shelf.coverUrl ? (
          <img
            src={shelf.coverUrl}
            alt={title || "Shelf cover"}
            className="w-full h-full object-cover"
          />
        ) : (
          <Box
            className="w-full h-full flex items-center justify-center"
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.action.hover}, ${theme.palette.background.default})`,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {itemsCount} items
            </Typography>
          </Box>
        )}
      </Box>

      <CardContent>
        <Typography variant="h6" className="truncate">
          {title || "Untitled Shelf"}
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          className="line-clamp-2 mt-1"
        >
          {description || "No description"}
        </Typography>

        <Box className="flex items-center justify-between text-xs mt-3">
          <Typography variant="caption" color="text.secondary">
            {itemsCount} items
          </Typography>
          <Typography
            variant="caption"
            color="primary"
            noWrap
            sx={{ lineHeight: 1 }}
          >
            {shelf.user?.name || "Anonymous"}
          </Typography>
        </Box>

        <Box className="mt-3">
          <ReactionBar
            size="md"
            post={reactionPost}
            policy={shelfPolicy}
            actions={shelfCardActions}
            onReplyInvoke={handleReplyInvoke}
          />
        </Box>
      </CardContent>
    </Card>
  );
};
