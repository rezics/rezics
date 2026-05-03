import { Paper } from "@mui/material";
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
    <div className={cn("mx-auto mb-16", isMobile ? "w-full" : "w-16/12")}>
      <Paper sx={{ p: 2, mt: 2 }}>
        <BookHomeHeroSection />
        <div className="mt-8">
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
        <TrendingExcerptSection />
      </Paper>
    </div>
  );
};
