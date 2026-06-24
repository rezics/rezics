import { useTranslation } from "@rezics/i18n/react";
import type React from "react";

/**
 * 书籍首页英雄区。展示着陆页的欢迎语、主标题和副标题。
 * Book Home Hero Section: displays welcome kicker, main title (with primary color accent), and subtitle.
 *
 * Layout breakpoints:
 *
 * Mobile (<640px):
 * ┌──────────────────────┐
 * │ [kicker text]        │
 * │ UPPER 10PX           │
 * │                      │
 * │ Main Title           │
 * │ REGULAR 24PX         │
 * │ [primary] accent     │
 * │                      │
 * │ Subtitle text        │
 * │ MUTED 12PX           │
 * └──────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │                                    │
 * │ [kicker text] (more space)         │
 * │ UPPER 10-11PX                      │
 * │                                    │
 * │ Main Title (larger)                │
 * │ REGULAR 28-32PX                    │
 * │ [primary color accent] on word     │
 * │                                    │
 * │ Subtitle with context              │
 * │ MUTED 13-14PX                      │
 * │                                    │
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌─────────────────────────────────────────────┐
 * │                                             │
 * │ [Kicker] - optional badge/label            │
 * │ UPPER 11PX TRACKING 0.35EM                 │
 * │                                             │
 * │ Welcome to the Book Catalog                │
 * │ SEMIBOLD 2XL (32-36PX)                     │
 * │ The [primary] accent on key word           │
 * │                                             │
 * │ Subtitle describing the collection         │
 * │ MUTED XS (12-14PX) LEADING SNUG             │
 * │                                             │
 * └─────────────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * ┌────────────────────────────────────────────────────────┐
 * │                                                        │
 * │ [Kicker] - Optional descriptive label                │
 * │ UPPERCASE 11PX LETTER SPACING 0.35EM                 │
 * │ COLOR text-primary/80 (slightly muted primary)        │
 * │                                                        │
 * │ Explore the Community-Driven Book Catalog             │
 * │ FONT SEMIBOLD SIZE 2XL (40+PX optimal)               │
 * │ [primary] - key word gets primary color accent        │
 * │ LEADING SNUG for tight heading feel                   │
 * │                                                        │
 * │ A description explaining the value proposition        │
 * │ FONT REGULAR COLOR text-muted-foreground              │
 * │ XS SIZE (13-14PX) with optimal reading width          │
 * │                                                        │
 * └────────────────────────────────────────────────────────┘
 */
export const BookHomeHeroSection: React.FC = () => {
  const { t } = useTranslation(["page"]);
  return (
    <div>
      <div className="space-y-2 mb-4">
        <p className="text-[10px] uppercase tracking-[0.35em] text-primary/80">
          {t("page:book_home_hero_kicker")}
        </p>
        <h1 className="text-2xl font-semibold leading-snug">
          <span className="text-primary">{t("page:book_home_hero_title")}</span>
        </h1>
        <p className="text-xs text-muted-foreground">
          {t("page:book_home_hero_subtitle")}
        </p>
      </div>
    </div>
  );
};
