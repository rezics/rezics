import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import type { ShelfItemDTO, ShelfView } from "@rezics/api/shelf";

interface ShelfItemCardProps {
  item: ShelfItemDTO;
  viewMode: ShelfView;
}

export function ShelfItemCard({ item, viewMode }: ShelfItemCardProps) {
  const [reviewTab, setReviewTab] = useState(0);
  const title = item.item?.translations?.[0]?.title ?? "Untitled";
  const type = item.item?.type ?? "UNKNOWN";
  const reviews = item.reviews ?? [];

  if (viewMode === "list") {
    return (
      <Stack direction="row" spacing={2} alignItems="center" py={1} px={1}>
        <Chip label={type} size="small" variant="outlined" />
        <Typography variant="body1" flex={1} noWrap>
          {title}
        </Typography>
        {item.keywords.length > 0 && (
          <Stack direction="row" spacing={0.5}>
            {item.keywords.map((kw) => (
              <Chip key={kw} label={kw} size="small" variant="outlined" />
            ))}
          </Stack>
        )}
      </Stack>
    );
  }

  if (viewMode === "review") {
    return (
      <Box py={1} px={1}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Chip label={type} size="small" variant="outlined" />
          <Typography variant="body1" flex={1}>
            {title}
          </Typography>
        </Stack>
        {reviews.length > 0 && (
          <Box mt={1}>
            <Tabs
              value={reviewTab}
              onChange={(_, v) => setReviewTab(v)}
              variant="scrollable"
              scrollButtons="auto"
            >
              {reviews.map((review, i) => (
                <Tab key={review.reviewUnitId} label={`Review ${i + 1}`} />
              ))}
            </Tabs>
          </Box>
        )}
        {item.keywords.length > 0 && (
          <Stack direction="row" spacing={0.5} mt={1}>
            {item.keywords.map((kw) => (
              <Chip key={kw} label={kw} size="small" variant="outlined" />
            ))}
          </Stack>
        )}
      </Box>
    );
  }

  // Grid mode (default)
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
          {type}
        </Typography>
      </Box>
      <Typography variant="body2" noWrap>
        {title}
      </Typography>
      {item.keywords.length > 0 && (
        <Stack direction="row" spacing={0.5} mt={0.5} flexWrap="wrap">
          {item.keywords.slice(0, 3).map((kw) => (
            <Chip key={kw} label={kw} size="small" variant="outlined" />
          ))}
        </Stack>
      )}
    </Box>
  );
}
