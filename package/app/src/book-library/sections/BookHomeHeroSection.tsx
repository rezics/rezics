import type React from "react";
import { useMessage } from "@rezics/i18n/react";
import {
  page_book_home_hero_kicker,
  page_book_home_hero_subtitle,
  page_book_home_hero_title,
} from "@rezics/i18n/messages";
const i18nMessages = {
  page_book_home_hero_kicker,
  page_book_home_hero_subtitle,
  page_book_home_hero_title,
};

export const BookHomeHeroSection: React.FC = () => {
  const m = useMessage(i18nMessages);
  return (
    <div>
      <div className="space-y-2 mb-4">
        <p className="text-[10px] uppercase tracking-[0.35em] text-primary/80">
          {m.page_book_home_hero_kicker()}
        </p>
        <h1 className="text-2xl font-semibold leading-snug">
          <span className="text-primary">{m.page_book_home_hero_title()}</span>
        </h1>
        <p className="text-xs text-muted-foreground">
          {m.page_book_home_hero_subtitle()}
        </p>
      </div>
    </div>
  );
};
