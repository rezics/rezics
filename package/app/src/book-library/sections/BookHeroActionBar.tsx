import {
  BookmarkAddOutlined,
  CheckCircleOutline,
  EditOutlined,
  IosShareOutlined,
} from "@mui/icons-material";
import {
  Button,
  IconButton,
  Menu,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from "@mui/material";
import { useCanEdit } from "@rezics/api/hooks";
import type { BookDTO } from "@rezics/contract";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useShareMenu } from "@/engagement/hooks/useShareMenu";

interface BookHeroActionBarProps {
  bookInfo: BookDTO;
  shareTitle?: string;
}

// MOCK: read-status state lives in component memory. Swap for the real
// shelf-membership hook once we expose `currently-reading / read / want-to-read`
// status from the backend.
type ReadStatus = "want" | "reading" | "read" | null;

const ghostButtonSx = {
  color: "rgba(255,255,255,0.9)",
  borderColor: "rgba(255,255,255,0.25)",
  textTransform: "none" as const,
  fontWeight: 500,
  borderRadius: "var(--rezics-radius-md, 8px)",
  "&:hover": {
    borderColor: "rgba(255,255,255,0.5)",
    bgcolor: "rgba(255,255,255,0.08)",
  },
};

export const BookHeroActionBar: React.FC<BookHeroActionBarProps> = ({
  bookInfo,
  shareTitle,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canEdit = useCanEdit({ resource: "book", ownerUnit: bookInfo });
  const bookId = bookInfo?.unitId ?? "";

  const [readStatus, setReadStatus] = useState<ReadStatus>(null);
  const share = useShareMenu({
    href: bookId ? `/book/${bookId}` : "/",
    title: shareTitle,
  });

  const handleAddToShelf = () => {
    // MOCK: route to the shelves-by-book page until a shelf-picker dialog exists.
    navigate({ to: "/shelf/book/$bookId", params: { bookId } });
  };

  const handleEdit = () => {
    if (bookId) navigate({ to: "/book/$bookId/edit", params: { bookId } });
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <Button
        variant="contained"
        size="large"
        startIcon={<BookmarkAddOutlined />}
        onClick={handleAddToShelf}
        sx={{
          bgcolor: "var(--rezics-color-brand-fill, #f4606c)",
          color: "var(--rezics-color-text-on-brand, #fff)",
          textTransform: "none",
          fontWeight: 500,
          borderRadius: "var(--rezics-radius-md, 8px)",
          boxShadow: "none",
          "&:hover": {
            bgcolor: "var(--rezics-color-brand-fill-hover, #e15462)",
            boxShadow: "none",
          },
        }}
      >
        {t("book.hero.actions.add_to_shelf", "加入書架")}
      </Button>

      <ToggleButtonGroup
        exclusive
        fullWidth
        size="small"
        value={readStatus}
        onChange={(_, v) => setReadStatus(v as ReadStatus)}
        sx={{
          "& .MuiToggleButton-root": {
            color: "rgba(255,255,255,0.8)",
            borderColor: "rgba(255,255,255,0.2)",
            textTransform: "none",
            fontSize: "0.75rem",
            py: 0.5,
            "&.Mui-selected": {
              color: "#fff",
              bgcolor: "rgba(255,255,255,0.12)",
              borderColor: "rgba(255,255,255,0.4)",
              "&:hover": { bgcolor: "rgba(255,255,255,0.18)" },
            },
            "&:hover": { bgcolor: "rgba(255,255,255,0.06)" },
          },
        }}
      >
        <ToggleButton value="want">
          {t("book.hero.actions.want_to_read", "想讀")}
        </ToggleButton>
        <ToggleButton value="reading">
          {t("book.hero.actions.reading", "在讀")}
        </ToggleButton>
        <ToggleButton value="read">
          <CheckCircleOutline sx={{ fontSize: 14, mr: 0.5 }} />
          {t("book.hero.actions.read", "已讀")}
        </ToggleButton>
      </ToggleButtonGroup>

      <div className="flex items-stretch gap-2">
        <Button
          variant="outlined"
          size="medium"
          startIcon={<IosShareOutlined />}
          onClick={share.handleOpen}
          sx={{ ...ghostButtonSx, flex: 1 }}
        >
          {t("common.share", "分享")}
        </Button>

        {canEdit && (
          <Tooltip
            title={t("book.hero.actions.edit_details", "編輯書籍詳情")}
            placement="top"
          >
            <IconButton
              aria-label={t("book.hero.actions.edit_details", "編輯書籍詳情")}
              onClick={handleEdit}
              size="medium"
              sx={{
                color: "rgba(255,255,255,0.9)",
                border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: "var(--rezics-radius-md, 8px)",
                "&:hover": {
                  bgcolor: "rgba(255,255,255,0.08)",
                  borderColor: "rgba(255,255,255,0.5)",
                },
              }}
            >
              <EditOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </div>

      <Menu
        anchorEl={share.anchorEl}
        open={share.open}
        onClose={share.handleClose}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem onClick={share.handleCopy}>
          {t("common.copy_link", "複製連結")}
        </MenuItem>
        {share.canWebShare && (
          <MenuItem onClick={share.handleWebShare}>
            {t("common.share_via", "分享…")}
          </MenuItem>
        )}
      </Menu>
    </div>
  );
};
