import type React from "react";
import { NewBookSection } from "@/home/sections/NewBookSection";
import { QuickAccessLinks } from "@/home/sections/QuickAccessLinks";
import { TrendingBookSection } from "@/home/sections/TrendingBookSection";
import { TrendingExcerptSection } from "@/home/sections/TrendingExcerptSection";
import { cn } from "@/shared/utils/css-util";
import { useIsMobile } from "@/shared/utils/use-media-query";
import { BookHomeHeroSection } from "../sections/BookHomeHeroSection";

export const BookHomePage: React.FC = () => {
  const isMobile = useIsMobile();

  return (
    <div
      className={cn(
        "mx-auto mt-2 mb-16 max-w-[1280px] space-y-12",
        isMobile ? "w-full" : "w-14/16",
      )}
    >
      <section>
        <BookHomeHeroSection />
        <div className="mt-8">
          <QuickAccessLinks />
        </div>
      </section>

      <NewBookSection limit={12} />
      <TrendingBookSection />
      <TrendingExcerptSection />
    </div>
  );
};
