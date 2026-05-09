import type React from "react";
import { useTranslation } from "react-i18next";
import { MainContentContainer } from "@/core/components/container/MainContentContainer";
import { HomeSearch } from "@/search";
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
    <MainContentContainer className="mb-16 space-y-12 pt-6 md:pt-8">
      <section>
        {isMobile && (
          <div className="mb-4">
            <HomeSearch />
          </div>
        )}
        <div className="w-full">
          <div className="space-y-2 mb-4">
            <h1 className="text-2xl font-semibold leading-snug">
              <span className="text-brand">
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
      <NewBookSection limit={12} />
    </MainContentContainer>
  );
};
