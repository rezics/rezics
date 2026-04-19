import { Box, Divider, IconButton, Paper, Stack, Typography } from "@mui/material";
import { EditOutlined } from "@mui/icons-material";
import { useCanEdit } from "@rezics/api/hooks";
import type { BookDTO } from "@rezics/contract";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useTranslation } from "react-i18next";

export type MetadataPanelProps = {
  bookInfo: BookDTO;
  variant?: "panel" | "inline";
};

/**
 * Compact book metadata: ISBN, text length, page count, format.
 * Used as a sidebar section on desktop and inline on mobile.
 */
export const MetadataPanel: React.FC<MetadataPanelProps> = ({
  bookInfo,
  variant = "panel",
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canEdit = useCanEdit({ resource: "book", ownerUnit: bookInfo });

  const editButton = canEdit && bookInfo?.unitId ? (
    <IconButton
      size="small"
      aria-label={t("common.edit")}
      onClick={() => navigate({ to: `/book/${bookInfo.unitId}/edit` })}
    >
      <EditOutlined fontSize="small" />
    </IconButton>
  ) : null;

  const items = (
    <Stack spacing={1}>
      {bookInfo?.isbn13 && (
        <Typography variant="body2">
          {t("book.fields.isbn")}：{bookInfo.isbn13}
        </Typography>
      )}
      <Typography variant="body2">
        {t("book.fields.text_length")}：{bookInfo?.textLength ?? 0}
      </Typography>
      {bookInfo?.pageCount != null && (
        <Typography variant="body2">
          {t("book.fields.page_count" as any)}：{bookInfo.pageCount}
        </Typography>
      )}
      {bookInfo?.formatKey && (
        <Typography variant="body2">
          {t("book.fields.format" as any)}：{bookInfo.formatKey}
        </Typography>
      )}
    </Stack>
  );

  if (variant === "inline") {
    return (
      <Box>
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          mb={1}
        >
          <Typography variant="subtitle2" fontWeight={600}>
            {t("book.info_panel.title")}
          </Typography>
          {editButton}
        </Box>
        {items}
      </Box>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={1}
      >
        <Typography variant="subtitle1" fontWeight={600}>
          {t("book.info_panel.title")}
        </Typography>
        {editButton}
      </Box>
      <Divider sx={{ mb: 2 }} />
      {items}
    </Paper>
  );
};
