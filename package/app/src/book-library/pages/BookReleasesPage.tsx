import { bookQueries } from "@rezics/api/book/book";
import { useTranslation } from "@rezics/i18n/react";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { Badge, Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@/shared/ui/link";
import { getTranslation } from "@/shared/utils/translation-helpers";
import { useBookLanguage } from "../hooks/useBookLanguage";
import {
  ALL_RELEASE_LANGUAGES,
  defaultReleaseLanguageFilters,
  filterReleasesByLanguages,
  releaseLanguage,
  releaseLanguages,
  releaseWorkUnitId,
  sortWorkReleases,
} from "../models/releaseWork";
import { bookDetailAtomFamily } from "../states/bookDetailAtoms";
import { useBookDetailSidebar } from "./bookDetailLayoutContext";

export const BookReleasesPage: React.FC = () => {
  const { t } = useTranslation(["book"]);
  const { bookId } = useParams({ strict: false }) as { bookId: string };
  const { data } = useQuery({
    ...bookQueries.detail(bookId),
    enabled: Boolean(bookId),
  });
  const bookInfo = useAtomValue(bookDetailAtomFamily(bookId)) ?? data;
  const [selectedLang] = useBookLanguage(bookId, bookInfo);
  const workUnitId = releaseWorkUnitId(bookInfo);
  useBookDetailSidebar(null);

  const { data: releaseList } = useQuery({
    ...bookQueries.list({ workUnitId, limit: 100 }),
    enabled: Boolean(workUnitId),
  });

  const releases = useMemo(
    () => sortWorkReleases(releaseList?.books ?? []),
    [releaseList?.books],
  );
  const languages = useMemo(() => releaseLanguages(releases), [releases]);
  const defaultFilters = useMemo(
    () => defaultReleaseLanguageFilters(selectedLang, languages),
    [languages, selectedLang],
  );
  const [languageFilters, setLanguageFilters] =
    useState<string[]>(defaultFilters);

  useEffect(() => {
    setLanguageFilters(defaultFilters);
  }, [defaultFilters]);

  const filtered = useMemo(
    () => filterReleasesByLanguages(releases, languageFilters),
    [releases, languageFilters],
  );
  const toggleLanguage = (language: string) => {
    setLanguageFilters((current) =>
      current.includes(language)
        ? current.filter((item) => item !== language)
        : [...current, language],
    );
  };

  if (!bookInfo || !workUnitId) return null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AccentBarWithText text={t("book:otherEditions")} />
        <div className="flex flex-row flex-wrap gap-2 sm:justify-end">
          <Button
            type="button"
            variant={languageFilters.length === 0 ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setLanguageFilters([])}
          >
            All
          </Button>
          {languages.map((language) => (
            <Button
              key={language}
              type="button"
              variant={
                languageFilters.includes(language) ? "secondary" : "ghost"
              }
              size="sm"
              onClick={() => toggleLanguage(language)}
            >
              {language === ALL_RELEASE_LANGUAGES ? "All" : language}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        {filtered.map((release) => {
          const title =
            getTranslation(
              release.translations,
              selectedLang,
              release.defaultLanguage ?? undefined,
            )?.title ?? t("book:editionFallback");
          const isCurrent = release.unitId === bookInfo.unitId;
          const policy = release.workMembership?.displayPolicy;
          return (
            <Link
              key={release.unitId}
              to="/book/$bookId"
              params={{ bookId: release.unitId }}
              className={`flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm leading-ui transition-colors ${
                isCurrent
                  ? "bg-surface-subtle text-text-primary"
                  : "text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
              }`}
            >
              <span className="min-w-0 truncate">{title}</span>
              <span className="flex flex-none flex-row items-center gap-2">
                <Badge variant="outline">{releaseLanguage(release)}</Badge>
                {policy === "SECONDARY" && (
                  <Badge variant="secondary">Secondary</Badge>
                )}
                {policy === "HIDDEN_BY_DEFAULT" && (
                  <Badge variant="secondary">Hidden</Badge>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
};
