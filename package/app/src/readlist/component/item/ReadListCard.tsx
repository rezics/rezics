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
import { cn } from "@/shared/util/css-util";
import { getTranslation } from "@/shared/util/translation-helpers";

/**
 * ReadListCard - now uses ShelfDTO instead of ReadlistDTO.
 * Title/content come from shelf.translations[].
 */
interface ReadListCardProps {
  readlist: ShelfDTO;
  className?: string;
}

const ReadListCard: React.FC<ReadListCardProps> = ({ readlist, className }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const translation = getTranslation(readlist.translations);
  const title = translation?.title ?? '';
  const description = translation?.description ?? '';
  const itemsCount = readlist.items?.length ?? 0;

  const handleOpenReadList = () => {
    if (!readlist.unitId) return;
    navigate({
      to: "/readlist/$readlistId",
      params: { readlistId: readlist.unitId },
    });
  };

  return (
    <Card elevation={0} className={cn("w-full transition-all mb-1", className)}>
      <CardActionArea onClick={handleOpenReadList} disabled={!readlist.unitId}>
        <Box
          className="w-full aspect-[16/9] overflow-hidden relative"
          sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}
        >
          {/* MOCK: no coverUrl on ShelfDTO, show placeholder */}
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
            {title || "未命名书单"}
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            className="line-clamp-2 mt-1"
          >
            {description || "暂无简介"}
          </Typography>

          <Box className="flex items-center justify-between text-xs text-muted-foreground mt-3">
            <Box className="flex items-center gap-2">
              <Typography variant="caption" color="text.secondary">
                {itemsCount} 本书
              </Typography>
            </Box>

            <Typography
              variant="caption"
              color="primary"
              noWrap
              sx={{ lineHeight: 1 }}
            >
              {readlist.user?.name || "匿名"}
            </Typography>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export default ReadListCard;
