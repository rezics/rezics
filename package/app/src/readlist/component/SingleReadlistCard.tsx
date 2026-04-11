import BookmarkAddOutlinedIcon from "@mui/icons-material/BookmarkAddOutlined";
import ThumbUpAltOutlinedIcon from "@mui/icons-material/ThumbUpAltOutlined";
import {
  Box,
  Card,
  CardMedia,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import type { ShelfDTO } from "@rezics/contract";
import { LazyLoadImage } from "@rezics/ui/primitive/image/LazyLoadImage.tsx";
import { MUILink } from "@rezics/ui/primitive/link/MUILink.tsx";
import type React from "react";
import { useTranslation } from "react-i18next";
import { getTranslation } from "@/shared/util/translation-helpers";

/**
 * SingleReadlist card - now uses ShelfDTO instead of ReadlistResponse.
 * Title and content come from shelf.translations[].
 */
interface SingleReadlistProps {
  data: ShelfDTO;
  handleBookListClick: (id: string, e: React.MouseEvent) => void;
  handleLike: (id: string) => void;
  handleFavorite?: (id: string) => void;
  className?: string;
}

export function SingleReadlist({
  data,
  handleBookListClick,
  handleLike,
  handleFavorite,
  className = "",
}: SingleReadlistProps) {
  const { t } = useTranslation();
  const id = data.unitId;
  const translation = getTranslation(data.translations);
  const title = translation?.title ?? '';
  const description = translation?.description ?? '';
  const likeCount =
    Array.isArray(data.reactionSummaries)
      ? (data.reactionSummaries as any[]).find((r: any) => r.reaction === "like")?.count ?? 0
      : 0;
  const authorName = data.user?.name ?? data.user?.slug ?? "—";
  // MOCK: cover URL from first item or placeholder
  const cover = '';

  return (
    <Card
      component={MUILink as any}
      to={`/readlist/${id}`}
      onClick={(e: React.MouseEvent) => handleBookListClick(id, e)}
      elevation={0}
      className={`mt-4 h-[200px] flex flex-row items-stretch gap-4 w-full ${className}`}
    >
      {/* Cover */}
      {cover && (
        <CardMedia style={{ width: "36%", objectFit: "cover" }}>
          <LazyLoadImage
            src={cover}
            alt={title}
            className="w-full h-full object-cover"
          />
        </CardMedia>
      )}
      {/* Right content */}
      <Box className="flex flex-1 flex-col justify-between min-w-0">
        <Box className="flex flex-col gap-1 min-w-0">
          <Typography
            variant="subtitle1"
            className="font-semibold truncate"
            title={title}
          >
            {title}
          </Typography>
          {description && (
            <Typography
              variant="body2"
              color="text.secondary"
              className="line-clamp-2 whitespace-pre-wrap"
            >
              {description}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            {authorName}
          </Typography>
        </Box>
        <Box className="flex flex-row items-center justify-between mt-2">
          <Box className="flex flex-row items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            {data.items?.length ? (
              <span>
                {t("page.readlist.books_count", { count: data.items.length })}
              </span>
            ) : null}
          </Box>
          <Box className="flex flex-row items-center gap-1">
            <Tooltip
              title={`${t("page.readlist.like_tooltip")} (${likeCount})`}
            >
              <IconButton
                size="small"
                aria-label="like"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleLike(id);
                }}
              >
                <ThumbUpAltOutlinedIcon fontSize="small" />
                <Typography variant="caption" className="ml-1">
                  {likeCount}
                </Typography>
              </IconButton>
            </Tooltip>
            {handleFavorite && (
              <Tooltip title={t("page.readlist.favorite_tooltip")}>
                <IconButton
                  size="small"
                  aria-label="favorite"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleFavorite(id);
                  }}
                >
                  <BookmarkAddOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      </Box>
    </Card>
  );
}
