import type React from "react";
import { MainContentContainer } from "@/core";
import {
  NewBookSection,
  QuickAccessLinks,
  TrendingBookSection,
  TrendingExcerptSection,
} from "@/home";
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
