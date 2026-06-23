import { bookQueries } from "@rezics/api/book/book";
import { scoreQueries } from "@rezics/api/score/score";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useAtomValue, useSetAtom } from "jotai";
import type React from "react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { QueryBoundary } from "@/core";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
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
 * 所有图书详情子路由共享的布局。持有英雄区、标签栏和内容/侧栏网格，
 * 使 Tabs 实例在路由切换时保持不变，活动标签下划线过渡正常触发。
 */
export const BookDetailLayout: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const params = useParams({ strict: false }) as { bookId?: string };
  const bookId = params.bookId ?? "";
  const queriesEnabled = Boolean(bookId);
  const readContext = useReadLanguageContext();

  // Primary data query — drives QueryBoundary loading/error states
  // 主数据查询 —— 驱动 QueryBoundary 的加载/错误状态
  const bookQuery = useQuery({
    ...bookQueries.detail(bookId, {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    enabled: queriesEnabled && readContext.ready,
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
    if (bookQuery.data) setBookDetail(bookQuery.data);
  }, [bookQuery.data, setBookDetail]);

  // Atom may have cached data from a prior navigation; prefer it for snappy
  // re-renders while the query refreshes in the background.
  // Atom 可能持有上次导航的缓存数据；优先使用以在后台刷新时快速重渲染。
  const bookInfo = useAtomValue(bookDetailAtomFamily(bookId)) ?? bookQuery.data;

  const [sidebar, setSidebar] = useState<ReactNode>(null);
  const layoutContextValue = useMemo(() => ({ setSidebar }), []);

  // Synthesise a query-like object that resolves to the atom-cached value when
  // available, falling back to the live query state.
  // 合成一个 query-like 对象：有 atom 缓存时直接解析，否则降回实时查询状态。
  const resolvedQuery = bookInfo
    ? { isPending: false, isError: false, error: null, data: bookInfo }
    : bookQuery;

  return (
    <BookDetailLayoutContext.Provider value={layoutContextValue}>
      <QueryBoundary query={resolvedQuery}>
        {(data) => (
          <>
            <BookHeroSection
              bookInfo={data}
              rating={ratingValue || 0}
              ratingCount={ratingCount}
            />
            <BookDetailShell bookInfo={data} sidebar={sidebar}>
              {children}
            </BookDetailShell>
          </>
        )}
      </QueryBoundary>
    </BookDetailLayoutContext.Provider>
  );
};
