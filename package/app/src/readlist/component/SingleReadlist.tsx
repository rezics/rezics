import {
  Avatar,
  Box,
  Card,
  CardContent,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import type { ShelfDTO } from "@rezics/contract";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { MiniActionBar } from "@/engagement/component/MiniActionBar.tsx";
import { getTranslation } from "@/shared/util/translation-helpers";

/**
 * SingleReadlist grid card - now uses ShelfDTO.
 * Title/content come from shelf.translations[].
 */
interface SingleReadlistProps {
  data: ShelfDTO;
  handleBookListClick: (id: string, e: React.MouseEvent) => void;
  handleLike: (id: string) => void;
}

export function SingleReadlist({
  data,
  handleBookListClick,
  handleLike,
}: SingleReadlistProps) {
  const navigate = useNavigate();
  const translation = getTranslation(data.translations);
  const title = translation?.title ?? '';
  const description = translation?.description ?? '';

  return (
    <Card
      sx={{
        cursor: "pointer",
        transition: "box-shadow 0.2s",
        "&:hover": {
          boxShadow: 4,
        },
      }}
      onClick={(_e) => navigate({ to: `/readlist/${data.unitId}` })}
    >
      <CardContent sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          {title}
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mb: 2,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {description}
        </Typography>

        <Grid container spacing={1} sx={{ mb: 2 }}>
          {/* MOCK: shelf items don't have inline cover URLs yet */}
          <div
            className="relative w-full overflow-hidden rounded-md"
            style={{ aspectRatio: "16 / 9" }}
          >
            <Box
              className="w-full h-full flex items-center justify-center"
              sx={{ background: 'linear-gradient(135deg, #f5f5f5, #e0e0e0)' }}
            >
              <Typography variant="caption" color="text.secondary">
                {data.items?.length ?? 0} items
              </Typography>
            </Box>
          </div>
        </Grid>

        <Box
          sx={{
            mt: "auto",
            pt: 2,
            borderTop: 1,
            borderColor: "divider",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Avatar
              src={data.user?.avatar ?? undefined}
              sx={{ width: 24, height: 24 }}
            />
            <Typography variant="body2" color="text.secondary">
              {data.user?.name}
            </Typography>
          </Stack>

          <Stack spacing={1} alignItems="center">
            {/* biome-ignore lint/a11y/useSemanticElements: card interaction */}
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                handleLike(data.unitId);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  handleLike(data.unitId);
                }
              }}
              className="flex items-center"
            >
              <MiniActionBar
                unitId={data.unitId}
                hideReply={true}
                reactionSummaries={data.reactionSummaries}
              />
            </div>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
