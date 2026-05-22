import { bookQueries } from "@rezics/api/book/book";
import { scoreQueries } from "@rezics/api/score/score";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useAtomValue, useSetAtom } from "jotai";
import type React from "react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "@rezics/i18n/react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";

import { BookDetailShell } from "../sections/BookDetailSection";
import { BookHeroSection } from "../sections/BookHeroSection";
import {
  bookDetailAtomFamily,
  setBookDetailAtomFamily,
} from "../states/bookDetailAtoms";
import { BookDetailLayoutContext } from "./bookDetailLayoutContext";

/**
 * Book Detail Layout
 *
 * Shared layout for all book detail sub-routes. Owns the hero, the tab bar,
 * and the content/sidebar grid — so the `Tabs` instance persists across
 * route changes and the active-tab underline transition fires normally.
 *
 * Pages populate the sidebar via `useBookDetailSidebar` from
 * `bookDetailLayoutContext.ts`.
 */
export const BookDetailLayout: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const params = useParams({ strict: false }) as { bookId?: string };
  const bookId = params.bookId ?? "";
  const queriesEnabled = Boolean(bookId);

  const { t } = useTranslation();

  const { data, isLoading, error } = useQuery({
    ...bookQueries.detail(bookId),
    enabled: queriesEnabled,
  });
  const { data: scoreAggregates } = useQuery({
    ...scoreQueries.aggregates(bookId),
    enabled: queriesEnabled,
  });

  const ratingValue = useMemo(() => {
    const agg = scoreAggregates?.[0];
    if (!agg || agg.totalCount === 0) return 0;
    const average = agg.totalScore / agg.totalCount;
    return Number(average.toFixed(1));
  }, [scoreAggregates]);
  const ratingCount = scoreAggregates?.[0]?.totalCount ?? 0;

  const setBookDetail = useSetAtom(setBookDetailAtomFamily(bookId));
  useEffect(() => {
    if (data) setBookDetail(data);
  }, [data, setBookDetail]);

  const bookInfo = useAtomValue(bookDetailAtomFamily(bookId)) ?? data;

  const [sidebar, setSidebar] = useState<ReactNode>(null);
  const layoutContextValue = useMemo(() => ({ setSidebar }), []);

  if (!queriesEnabled) {
    return <div>{t("common.error_generic")} Missing bookId</div>;
  }

  if (isLoading || !bookInfo) {
    return <div>{t("common.loading")}</div>;
  }

  if (error) {
    return <QueryErrorDisplay error={error} />;
  }

  return (
    <BookDetailLayoutContext.Provider value={layoutContextValue}>
      <BookHeroSection
        bookInfo={bookInfo}
        rating={ratingValue || 0}
        ratingCount={ratingCount}
      />
      <BookDetailShell bookInfo={bookInfo} sidebar={sidebar}>
        {children}
      </BookDetailShell>
    </BookDetailLayoutContext.Provider>
  );
};
