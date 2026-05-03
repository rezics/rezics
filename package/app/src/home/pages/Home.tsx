import type React from "react";
import { useTranslation } from "react-i18next";
import { HomeSearch } from "@/search";
import { cn } from "@/shared/utils/css-util";
import { useIsMobile } from "@/shared/utils/use-media-query";
import { BookCarousel } from "../components/HomeCarousel";
import { ActiveRealmsSection } from "../sections/ActiveRealmsSection";
import { AnnouncementBarSection } from "../sections/AnnouncementBarSection";
import { LibraryCardsSection } from "../sections/LibraryCardsSection";
import { NewBookSection } from "../sections/NewBookSection";
import { TrendingReviews } from "../sections/TrendingReviewsSection";
import { TrendingShelfSection } from "../sections/TrendingShelfSection";

export type HomeProps = object;

export const Home: React.FC<HomeProps> = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  return (
    <div
      className={cn(
        "mx-auto mt-2 mb-16 max-w-[1280px] space-y-12",
        isMobile ? "w-full" : "w-14/16",
      )}
    >
      <section>
        {isMobile && (
          <div className="mb-4">
            <HomeSearch />
          </div>
        )}
        <div className="w-full">
          <div className="space-y-2 mb-4">
            <p className="text-[10px] uppercase tracking-[0.35em] text-primary/80">
              {t("page.home.hero.kicker")}
            </p>
            <h1 className="text-2xl font-semibold leading-snug">
              <span className="text-primary">
                {" "}
                {t("page.home.hero.title_highlight")}
              </span>
            </h1>
            <p className="text-xs text-muted-foreground">
              {t("page.home.hero.subtitle")}
            </p>
          </div>
          <BookCarousel autoplayIntervalNum={3000} />
        </div>
      </section>

      <LibraryCardsSection />
      <ActiveRealmsSection />
      <AnnouncementBarSection />
      <TrendingShelfSection />
      <TrendingReviews />
      <NewBookSection limit={5} />
    </div>
  );
};
