import type React from "react";
import { MainContentContainer } from "@/core";
import {
  NewBookSection,
  QuickAccessLinks,
  TrendingBookSection,
  TrendingExcerptSection,
} from "@/home";
import { BookHomeHeroSection } from "../sections/BookHomeHeroSection";

/**
 * 书籍首页。展示书籍目录的主着陆页，包括英雄区、快速链接、新书、热门书籍和热门摘录。
 * Book Home Page: landing page for book catalog with hero, quick links, new books, trending books & excerpts.
 *
 * Layout breakpoints:
 *
 * Mobile (<640px):
 * ┌──────────────────────┐
 * │ Hero Section         │
 * │ [Title/Subtitle]     │
 * │ Kicker text          │
 * ├──────────────────────┤
 * │ Quick Access Links   │
 * │ [Link 1] [Link 2]    │
 * │ [Link 3] [Link 4]    │
 * ├──────────────────────┤
 * │ New Books (12 items) │
 * │ [Book 1]             │
 * │ [Book 2]             │
 * │ [Book 3]             │
 * │ [... scrollable]     │
 * ├──────────────────────┤
 * │ Trending Books       │
 * │ [Book 1]             │
 * │ [Book 2]             │
 * │ [... scrollable]     │
 * ├──────────────────────┤
 * │ Trending Excerpts    │
 * │ [Excerpt 1]          │
 * │ [Excerpt 2]          │
 * │ [... scrollable]     │
 * └──────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │ Hero Section (wider)               │
 * │ [Larger Title/Subtitle]            │
 * │ Kicker (more prominent)            │
 * ├────────────────────────────────────┤
 * │ Quick Access Links (2-3 columns)   │
 * │ [Link 1] [Link 2] [Link 3]         │
 * │ [Link 4] ...                       │
 * ├────────────────────────────────────┤
 * │ New Books (grid view)              │
 * │ [Book 1] [Book 2] [Book 3]         │
 * │ [Book 4] [Book 5] [Book 6]         │
 * │ [... more rows]                    │
 * ├────────────────────────────────────┤
 * │ Trending Books                     │
 * │ [Book 1] [Book 2] [Book 3]         │
 * │ [Book 4] [Book 5] ...              │
 * ├────────────────────────────────────┤
 * │ Trending Excerpts                  │
 * │ [Excerpt 1] [Excerpt 2]            │
 * │ [Excerpt 3] ...                    │
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌─────────────────────────────────────────────┐
 * │ Hero Section (optimized width)              │
 * │ [Centered Title with primary color]         │
 * │ Kicker | Subtitle | Description             │
 * ├─────────────────────────────────────────────┤
 * │ Quick Access Links (responsive grid)        │
 * │ [Link 1] [Link 2] [Link 3] [Link 4]         │
 * │ [Link 5] ...                                │
 * ├─────────────────────────────────────────────┤
 * │ New Books Section (title + grid)            │
 * │ [Book 1] [Book 2] [Book 3] [Book 4]         │
 * │ [Book 5] [Book 6] [Book 7] [Book 8]         │
 * │ [Book 9] [Book 10] [Book 11] [Book 12]      │
 * ├─────────────────────────────────────────────┤
 * │ Trending Books Section                      │
 * │ [Book 1] [Book 2] [Book 3] [Book 4]         │
 * │ [Book 5] ...                                │
 * ├─────────────────────────────────────────────┤
 * │ Trending Excerpts Section                   │
 * │ [Excerpt 1] [Excerpt 2] [Excerpt 3] ...     │
 * └─────────────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * ┌────────────────────────────────────────────────────────┐
 * │ Hero Section (maximum comfortable width)               │
 * │ [Centered Title with primary accent]                   │
 * │ Kicker | Larger Subtitle | Description text            │
 * ├────────────────────────────────────────────────────────┤
 * │ Quick Access Links (even distribution)                 │
 * │ [Link 1] [Link 2] [Link 3] [Link 4] [Link 5]           │
 * ├────────────────────────────────────────────────────────┤
 * │ New Books Section (4-6 column grid)                    │
 * │ [Book 1] [Book 2] [Book 3] [Book 4]                    │
 * │ [Book 5] [Book 6] [Book 7] [Book 8]                    │
 * │ [Book 9] [Book 10] [Book 11] [Book 12]                 │
 * ├────────────────────────────────────────────────────────┤
 * │ Trending Books Section (optimal spacing)               │
 * │ [Book 1] [Book 2] [Book 3] [Book 4] [Book 5]           │
 * ├────────────────────────────────────────────────────────┤
 * │ Trending Excerpts Section                              │
 * │ [Excerpt 1] [Excerpt 2] [Excerpt 3] [Excerpt 4]        │
 * └────────────────────────────────────────────────────────┘
 */
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
