import { bookQueries } from "@rezics/api/book/book";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useAtomValue, useSetAtom } from "jotai";
import type React from "react";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { BookHeroSection } from "../section/BookHeroSection";
import {
  bookDetailAtomFamily,
  setBookDetailAtomFamily,
} from "../state/bookDetailAtoms";

/**
 * Book Detail Layout
 *
 * Shared layout for all book detail sub-routes.
 * Fetches book data, renders the hero section, and renders children (routed tab content).
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
  const { data: rating } = useQuery({
    ...bookQueries.rating(bookId),
    enabled: queriesEnabled,
  });

  const ratingValue = useMemo(() => {
    const average = (rating?.totalScore || 0) / (rating?.totalCount || 1) || 0;
    return Number(average.toFixed(1));
  }, [rating]);

  const setBookDetail = useSetAtom(setBookDetailAtomFamily(bookId));
  useEffect(() => {
    if (data) setBookDetail(data);
  }, [data, setBookDetail]);

  const bookInfo = useAtomValue(bookDetailAtomFamily(bookId)) ?? data;

  if (!queriesEnabled) {
    return <div>{t("common.error_generic")} Missing bookId</div>;
  }

  if (isLoading || !bookInfo) {
    return <div>{t("common.loading")}</div>;
  }

  if (error) {
    return (
      <div>
        {t("common.error_generic")} {String(error)}
      </div>
    );
  }

  return (
    <div>
      <BookHeroSection bookInfo={bookInfo} rating={ratingValue || 0} />
      {children}
    </div>
  );
};
