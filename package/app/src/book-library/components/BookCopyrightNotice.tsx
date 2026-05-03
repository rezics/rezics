import { Box, Stack, Typography } from "@mui/material";
import type React from "react";
import { useTranslation } from "react-i18next";
import { Copyright as CopyrightOutlined } from "lucide-react";

export const BookCopyrightNotice: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Box>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <CopyrightOutlined
          size={16} color={"var(--rezics-color-text-tertiary)"} style={{ marginTop: "2px", flexShrink: 0 }}
        />
        <Stack spacing={0.5}>
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              lineHeight: 1.55,
              display: "block",
            }}
          >
            {t("book.copyright_notice.body")}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: "var(--rezics-color-text-tertiary)",
              lineHeight: 1.55,
              display: "block",
            }}
          >
            {t("book.copyright_notice.fair_use")}
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
};
