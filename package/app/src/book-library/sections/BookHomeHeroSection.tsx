import { Button, Input } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { Search as SearchIcon } from "lucide-react";
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

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-1 px-1 py-[2px] border border-rezics-color-border-defined rounded-md"
      >
        <Input
          className="ml-1 flex-1 border-0 shadow-none focus-visible:ring-0"
          placeholder={t("page.book_home.hero.search_placeholder")}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          aria-label={t("page.book_home.hero.search_placeholder")}
        />
        <Button
          type="submit"
          size="icon"
          variant="ghost"
          aria-label="search"
        >
          <SearchIcon className="w-5 h-5" />
        </Button>
      </form>
    </div>
  );
};
