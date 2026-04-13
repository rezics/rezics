import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Typography,
  useTheme,
} from "@mui/material";
import type { ShelfDTO } from "@rezics/contract";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { getTranslation } from "@/shared/util/translation-helpers";

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

  const handleClick = () => {
    if (!shelf.unitId) return;
    navigate({
      to: "/shelf/$shelfId",
      params: { shelfId: shelf.unitId },
    });
  };

  return (
    <Card elevation={0} className={className}>
      <CardActionArea onClick={handleClick} disabled={!shelf.unitId}>
        <Box
          className="w-full aspect-[16/9] overflow-hidden relative"
          sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}
        >
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
        </CardContent>
      </CardActionArea>
    </Card>
  );
};
