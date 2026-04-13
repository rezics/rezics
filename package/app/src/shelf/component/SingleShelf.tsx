import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ShelfDTO } from "@rezics/contract";
import type React from "react";
import { getTranslation } from "@/shared/util/translation-helpers";

interface SingleShelfProps {
  shelf: ShelfDTO;
}

export const SingleShelf: React.FC<SingleShelfProps> = ({ shelf }) => {
  const translation = getTranslation(shelf.translations);
  const title = translation?.title ?? "Untitled Shelf";
  const description = translation?.description ?? "";

  return (
    <Box>
      <Typography variant="h5" fontWeight={600}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body1" color="text.secondary" mt={1}>
          {description}
        </Typography>
      )}
      <Box mt={1}>
        <Typography variant="caption" color="text.secondary">
          {shelf.items?.length ?? 0} items
        </Typography>
        {shelf.user?.name && (
          <Typography variant="caption" color="text.secondary" ml={2}>
            by {shelf.user.name}
          </Typography>
        )}
      </Box>
    </Box>
  );
};
