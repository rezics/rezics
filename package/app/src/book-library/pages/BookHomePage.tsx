import type React from "react";
import { MainContentContainer } from "@/core/components/container/MainContentContainer";
import { NewBookSection } from "@/home/sections/NewBookSection";
import { QuickAccessLinks } from "@/home/sections/QuickAccessLinks";
import { TrendingBookSection } from "@/home/sections/TrendingBookSection";
import { TrendingExcerptSection } from "@/home/sections/TrendingExcerptSection";
import { BookHomeHeroSection } from "../sections/BookHomeHeroSection";

export const BookHomePage: React.FC = () => {
  return (
    <MainContentContainer className="mt-2 mb-16 space-y-12">
      <section>
        <BookHomeHeroSection />
        <div className="mt-8">
          <QuickAccessLinks />
        </div>
      </section>

      <NewBookSection limit={12} />
      <TrendingBookSection />
      <TrendingExcerptSection />
    </MainContentContainer>
  );
};
