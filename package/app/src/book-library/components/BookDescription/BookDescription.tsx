import { Box, Typography } from "@mui/material";
import { useCanEdit } from "@rezics/api/hooks";
import { EditButtonFloatRightShow } from "@rezics/ui/composite/button/EditButtonFloatRight.tsx";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useTranslation } from "react-i18next";
import type { BookDescriptionProps } from "./types";

export const BookDescription: React.FC<BookDescriptionProps> = ({
  description,
  onEdit,
  book,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canEdit = useCanEdit({ resource: "book", ownerUnit: book });

  const handleEdit = () => {
    if (onEdit) {
      onEdit();
      return;
    }
    if (book?.unitId) {
      navigate({ to: `/book/${book.unitId}/edit` });
    }
  };

  return (
    <div>
      <Box>
        <div className="flex mb-4">
          <AccentBarWithText text={t("book.description")} />
          {canEdit && (
            <EditButtonFloatRightShow
              onClick={handleEdit}
              text={t("common.edit")}
            />
          )}
        </div>{" "}
        <Typography variant="body1" className="whitespace-pre-line">
          {description}
        </Typography>
      </Box>{" "}
    </div>
  );
};
