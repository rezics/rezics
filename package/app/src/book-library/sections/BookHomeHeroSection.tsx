import * as m from "@rezics/i18n/messages";
import type React from "react";

export const BookHomeHeroSection: React.FC = () => {
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
