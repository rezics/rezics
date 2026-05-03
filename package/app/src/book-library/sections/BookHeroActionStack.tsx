import { BookmarkAddOutlined, CheckCircleOutline } from "@mui/icons-material";
import { Button, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface BookHeroActionStackProps {
  bookId: string;
}

// MOCK: read-status state lives in component memory. Swap for the real
// shelf-membership hook once we expose `currently-reading / read / want-to-read`
// status from the backend.
type ReadStatus = "want" | "reading" | "read" | null;

export const BookHeroActionStack: React.FC<BookHeroActionStackProps> = ({
  bookId,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [readStatus, setReadStatus] = useState<ReadStatus>(null);

  const handleAddToShelf = () => {
    // MOCK: route to existing shelves-by-book page until a shelf-picker
    // dialog exists.
    navigate({ to: "/shelf/book/$bookId", params: { bookId } });
  };

  return (
    <div className="flex flex-col items-stretch gap-2 w-full">
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
    </div>
  );
};
