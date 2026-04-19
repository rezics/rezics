import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Typography,
  useTheme,
} from "@mui/material";
import type { PostDTO } from "@rezics/contract";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { PostBodyMarkdown } from "@/post";
import { cn } from "@/shared/utils/css-util";

interface ReviewCardProps {
  review: PostDTO;
  className?: string;
}

export const ReviewCard: React.FC<ReviewCardProps> = ({
  review,
  className,
}) => {
  const theme = useTheme();
  const navigate = useNavigate();

  const bookMetadata = (review.extra as any)?.book as
    | { coverUrl?: string; title?: string }
    | undefined;
  const reviewTitle = (review.extra as any)?.title as string | undefined;
  const rating = (review.extra as any)?.rating as number | undefined;

  const handleOpenReview = () => {
    if (!review.unitId) return;
    navigate({ to: "/review/$reviewId", params: { reviewId: review.unitId } });
  };

  return (
    <Card className={cn("w-full transition-all hover:shadow-md", className)}>
      <CardActionArea onClick={handleOpenReview} disabled={!review.unitId}>
        <CardContent>
          <Box className="flex gap-4">
            {bookMetadata?.coverUrl && (
              <Box
                className="flex-shrink-0 w-20 h-28 overflow-hidden rounded shadow-sm"
                sx={{ border: `1px solid ${theme.palette.divider}` }}
              >
                <img
                  src={bookMetadata.coverUrl}
                  alt={bookMetadata.title}
                  className="w-full h-full object-cover"
                />
              </Box>
            )}

            <Box className="flex-grow min-w-0">
              {bookMetadata?.title && (
                <Typography
                  variant="caption"
                  className="block truncate"
                  sx={{ letterSpacing: 1 }}
                >
                  《{bookMetadata.title}》
                </Typography>
              )}

              {reviewTitle && (
                <Typography
                  variant="h6"
                  className="truncate"
                  sx={{ fontSize: "1.1rem", color: "text.primary" }}
                >
                  {reviewTitle}
                </Typography>
              )}

              <PostBodyMarkdown
                body={review.body ?? ""}
                clamp={{ maxLines: 3 }}
              />
            </Box>
          </Box>

          <Box className="flex items-center justify-between text-xs text-muted-foreground mt-2">
            <Box className="flex items-center gap-2">0 观看</Box>

            <Box className="flex items-center gap-2">
              <Typography
                variant="caption"
                color="primary"
                noWrap
                sx={{ lineHeight: 1 }}
              >
                {review.author?.name || "匿名"}
              </Typography>

              {rating !== undefined && (
                <Typography
                  variant="caption"
                  color="secondary"
                  noWrap
                  sx={{ lineHeight: 1 }}
                >
                  {rating}
                </Typography>
              )}
            </Box>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export default ReviewCard;
