import type React from "react";
import { useTranslation } from "@rezics/i18n/react";

export const BookHomeHeroSection: React.FC = () => {
  const { t } = useTranslation();

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
    </div>
  );
};
