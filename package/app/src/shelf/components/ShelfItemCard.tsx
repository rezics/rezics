import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ShelfItemDTO, ShelfView } from "@rezics/api/shelf";

interface ShelfItemCardProps {
  item: ShelfItemDTO;
  title?: string;
  viewMode: ShelfView;
}

export function ShelfItemCard({ item, title, viewMode }: ShelfItemCardProps) {
  const displayTitle = title ?? item.itemRef;
  const reviewCount = item.reviewIds.length;
  const tagCount = item.tagIds.length;

  if (viewMode === "list") {
    return (
      <Stack direction="row" spacing={2} alignItems="center" py={1} px={1}>
        <Chip label={item.kind} size="small" variant="outlined" />
        <Typography variant="body1" flex={1} noWrap>
          {displayTitle}
        </Typography>
        {reviewCount > 0 && (
          <Typography variant="caption" color="text.secondary">
            {reviewCount} review{reviewCount === 1 ? "" : "s"}
          </Typography>
        )}
        {tagCount > 0 && (
          <Typography variant="caption" color="text.secondary">
            {tagCount} tag{tagCount === 1 ? "" : "s"}
          </Typography>
        )}
      </Stack>
    );
  }

  if (viewMode === "review") {
    return (
      <Box py={1} px={1}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Chip label={item.kind} size="small" variant="outlined" />
          <Typography variant="body1" flex={1}>
            {displayTitle}
          </Typography>
          {reviewCount > 0 && (
            <Typography variant="caption" color="text.secondary">
              {reviewCount} review{reviewCount === 1 ? "" : "s"}
            </Typography>
          )}
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      py={1}
      px={1}
      sx={{
        display: "inline-flex",
        flexDirection: "column",
        width: 200,
      }}
    >
      <Box
        sx={{
          width: "100%",
          aspectRatio: "3/4",
          bgcolor: "action.hover",
          borderRadius: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          mb: 1,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {item.kind}
        </Typography>
      </Box>
      <Typography variant="body2" noWrap>
        {displayTitle}
      </Typography>
      {reviewCount > 0 && (
        <Typography variant="caption" color="text.secondary">
          {reviewCount} review{reviewCount === 1 ? "" : "s"}
        </Typography>
      )}
    </Box>
  );
}
