import SearchIcon from "@mui/icons-material/Search";
import { IconButton, InputBase, Paper } from "@mui/material";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export const BookHomeHeroSection: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = keyword.trim();
    if (trimmed) {
      navigate({ to: "/book/search", search: { keyword: trimmed } });
    } else {
      navigate({ to: "/book/search" });
    }
  };

  return (
    <div>
      <div className="space-y-2 mb-4">
        <p className="text-[10px] uppercase tracking-[0.35em] text-primary/80">
          {t("page.book_home.hero.kicker")}
        </p>
        <h1 className="text-2xl font-semibold leading-snug">
          <span className="text-primary">{t("page.book_home.hero.title")}</span>
        </h1>
        <p className="text-xs text-muted-foreground">
          {t("page.book_home.hero.subtitle")}
        </p>
      </div>

      <Paper
        component="form"
        onSubmit={handleSubmit}
        variant="outlined"
        sx={{
          p: "2px 4px",
          display: "flex",
          alignItems: "center",
        }}
      >
        <InputBase
          sx={{ ml: 1, flex: 1 }}
          placeholder={t("page.book_home.hero.search_placeholder")}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          inputProps={{
            "aria-label": t("page.book_home.hero.search_placeholder"),
          }}
        />
        <IconButton type="submit" sx={{ p: "10px" }} aria-label="search">
          <SearchIcon />
        </IconButton>
      </Paper>
    </div>
  );
};
