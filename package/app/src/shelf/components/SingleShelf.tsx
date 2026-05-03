import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import { useCanEdit } from "@rezics/api/hooks";
import type { ShelfDTO } from "@rezics/contract";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useTranslation } from "react-i18next";
import { getTranslation } from "@/shared/utils/translation-helpers";
import { Pencil as EditOutlined } from "lucide-react";

interface SingleShelfProps {
  shelf: ShelfDTO;
}

export const SingleShelf: React.FC<SingleShelfProps> = ({ shelf }) => {
  const translation = getTranslation(shelf.translations);
  const title = translation?.title ?? "Untitled Shelf";
  const description = translation?.description ?? "";
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canEdit = useCanEdit({ resource: "shelf", ownerUnit: shelf });
  const shelfId = shelf.unitId;

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="h5" fontWeight={600}>
          {title}
        </Typography>
        {canEdit && shelfId && (
          <IconButton
            size="small"
            aria-label={t("common.edit")}
            onClick={() => navigate({ to: `/shelf/${shelfId}/edit` })}
          >
            <EditOutlined fontSize="small" />
          </IconButton>
        )}
      </Box>
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
