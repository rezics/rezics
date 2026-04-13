import { Paper } from "@mui/material";
import type React from "react";
import { cn } from "@/shared/util/css-util";
import { useIsMobile } from "@/shared/util/use-media-query";
import { NewBookSection } from "@/home/section/NewBookSection";
import { QuickAccessLinks } from "@/home/section/QuickAccessLinks";
import { TrendingBookSection } from "@/home/section/TrendingBookSection";
import { TrendingQuoteSection } from "@/home/section/TrendingQuoteSection";
import { BookHomeHeroSection } from "../section/BookHomeHeroSection";

export const BookHomePage: React.FC = () => {
  const isMobile = useIsMobile();

  return (
    <div className={cn("mx-auto mb-10", isMobile ? "w-full" : "w-10/12")}>
      <Paper sx={{ p: 2, mt: 2 }}>
        <BookHomeHeroSection />
        <div className="mt-6">
          <QuickAccessLinks />
        </div>
      </Paper>

      <Paper sx={{ mt: 2, p: 2 }}>
        <NewBookSection limit={12} />
      </Paper>

      <Paper sx={{ mt: 2, p: 2 }}>
        <TrendingBookSection />
      </Paper>

      <Paper sx={{ mt: 2, p: 2 }}>
        <TrendingQuoteSection />
      </Paper>
    </div>
  );
};
