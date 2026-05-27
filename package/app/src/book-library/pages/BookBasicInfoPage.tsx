import { bookQueries } from "@rezics/api/book/book";
import { tagQueries } from "@rezics/api/tag/tag.queries";
import { mainMarkdownSource } from "@rezics/contract";
import {
  book_editionFallback,
  book_excerpts,
  book_fields_tags,
  book_otherEditions,
  book_remark,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { WorkReleaseNav } from "@rezics/ui";
import { ArrowForwardIcon } from "@rezics/ui/composite/navigation/ArrowForwardIcon.tsx";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { Badge, Button, Separator } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import type React from "react";
import { useMemo, useState } from "react";
import { RemarkInlineForm } from "@/remark";
import { useNavigateToBookTagSearch } from "@/search/hooks/useNavigateToBookTagSearch";
import { Link } from "@/shared/ui/link";
import { getTranslation } from "@/shared/utils/translation-helpers";
import { TagInteraction } from "@/tag/components/TagInteraction";
import { BookCopyrightNotice } from "../components/BookCopyrightNotice";
import { BookDescription } from "../components/BookDescription";
import { MetadataPanel } from "../components/BookDetail/MetadataPanel";
import { ExcerptPreview } from "../components/ExcerptPreview";
import { RemarkPreview } from "../components/RemarkPreview";
import { useBookLanguage } from "../hooks/useBookLanguage";
import {
  filterReleasesByLanguages,
  releaseLanguage,
  releaseLanguages,
  releaseWorkUnitId,
  sortWorkReleases,
} from "../models/releaseWork";
import { bookDetailAtomFamily } from "../states/bookDetailAtoms";
import { useBookDetailSidebar } from "./bookDetailLayoutContext";

const i18nMessages = {
  book_editionFallback,
  book_excerpts,
  book_fields_tags,
  book_otherEditions,
  book_remark,
};

interface BookWorkReleaseNavProps {
  workUnitId: string;
  currentUnitId: string;
}

const BookWorkReleaseNav: React.FC<BookWorkReleaseNavProps> = ({
  workUnitId,
  currentUnitId,
}) => {
  const m = useMessage(i18nMessages);
  const { data } = useQuery({
    ...bookQueries.list({ workUnitId, limit: 10 }),
    enabled: Boolean(workUnitId),
  });

  const releases =
    data?.books?.map((b) => ({
      unitId: b.unitId,
      title: getTranslation(b.translations)?.title ?? undefined,
    })) ?? [];

  return (
    <WorkReleaseNav
      releases={releases}
      currentUnitId={currentUnitId}
      heading={m.book_otherEditions()}
      emptyLabel={m.book_editionFallback()}
      renderLink={(release, children) => (
        <Link
          key={release.unitId}
          to="/book/$bookId"
          params={{ bookId: release.unitId }}
        >
          {children}
        </Link>
      )}
    />
  );
};

const BookWorkReleasesPanel: React.FC<BookWorkReleaseNavProps> = ({
  workUnitId,
  currentUnitId,
}) => {
  const m = useMessage(i18nMessages);
  const [languageFilters, setLanguageFilters] = useState<string[]>([]);
  const { data } = useQuery({
    ...bookQueries.list({ workUnitId, limit: 100 }),
    enabled: Boolean(workUnitId),
  });

  const releases = useMemo(
    () => sortWorkReleases(data?.books ?? []),
    [data?.books],
  );
  const languages = useMemo(() => releaseLanguages(releases), [releases]);
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

  if (releases.length <= 1) return null;

  return (
    <section id="releases" className="flex flex-col gap-3">
      <div className="flex flex-row items-center justify-between gap-3">
        <AccentBarWithText text={m.book_otherEditions()} />
        <div className="flex flex-row flex-wrap justify-end gap-2">
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
              {language}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        {filtered.map((release) => {
          const title =
            getTranslation(release.translations)?.title ??
            m.book_editionFallback();
          const isCurrent = release.unitId === currentUnitId;
          const policy = release.workMembership?.displayPolicy;
          return (
            <Link
              key={release.unitId}
              to="/book/$bookId"
              params={{ bookId: release.unitId }}
              className={`flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
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

export const BookBasicInfoPage: React.FC = () => {
  const m = useMessage(i18nMessages);
  const { bookId } = useParams({ strict: false }) as { bookId: string };
  const { data } = useQuery({
    ...bookQueries.detail(bookId),
    enabled: Boolean(bookId),
  });
  const bookInfo = useAtomValue(bookDetailAtomFamily(bookId)) ?? data;
  const [selectedLang] = useBookLanguage(bookId, bookInfo);
  const navigateToBookTagSearch = useNavigateToBookTagSearch();

  const { data: tagsData } = useQuery({
    ...tagQueries.forUnit(bookId),
    enabled: Boolean(bookId),
  });
  const unitTags = tagsData?.tags ?? [];
  const tagUnitIds = unitTags.map((tag) => tag.tagUnitId);
  const { data: tagTranslations } = useQuery(
    tagQueries.batchTranslations(tagUnitIds, selectedLang),
  );

  const sidebar = useMemo(() => {
    if (!bookInfo) return null;
    return (
      <div className="flex flex-col gap-6">
        <MetadataPanel bookInfo={bookInfo} />
        {releaseWorkUnitId(bookInfo) && (
          <BookWorkReleaseNav
            workUnitId={releaseWorkUnitId(bookInfo)!}
            currentUnitId={bookInfo.unitId}
          />
        )}
      </div>
    );
  }, [bookInfo]);
  useBookDetailSidebar(sidebar);

  if (!bookInfo) return null;

  const description =
    mainMarkdownSource(
      getTranslation(
        bookInfo.translations,
        selectedLang,
        bookInfo.defaultLanguage ?? undefined,
      )?.description,
    ) ?? "";

  return (
    <div className="flex flex-col gap-8">
      <BookDescription description={description} />

      <div className="lg:hidden">
        <MetadataPanel bookInfo={bookInfo} variant="inline" />
      </div>

      {unitTags.length > 0 && (
        <>
          <Separator />
          <div>
            <AccentBarWithText text={m.book_fields_tags()} />
            <div className="mt-2">
              <TagInteraction
                tags={unitTags}
                translations={tagTranslations ?? {}}
                bookUnitId={bookInfo.unitId ?? bookId}
                bookUnit={bookInfo}
                onSearchTags={navigateToBookTagSearch}
              />
            </div>
          </div>
        </>
      )}

      <Separator />

      <div>
        <ArrowForwardIcon size={16} to={`/excerpt/book/${bookInfo.unitId}`}>
          <AccentBarWithText text={m.book_excerpts()} />
        </ArrowForwardIcon>
      </div>
      <ExcerptPreview id={bookInfo.unitId || ""} />

      <Separator />

      <div>
        <div>
          <ArrowForwardIcon
            size={16}
            to={`/review/book/${bookInfo.unitId}?tab=remark`}
          >
            <AccentBarWithText text={m.book_remark()} />
          </ArrowForwardIcon>
        </div>
        <div className="mt-3 mb-4">
          <RemarkInlineForm bookUnitId={bookInfo.unitId || ""} />
        </div>
        <RemarkPreview bookId={bookInfo.unitId || ""} />
      </div>

      {releaseWorkUnitId(bookInfo) && (
        <>
          <Separator />
          <BookWorkReleasesPanel
            workUnitId={releaseWorkUnitId(bookInfo)!}
            currentUnitId={bookInfo.unitId}
          />
        </>
      )}

      <BookCopyrightNotice />
    </div>
  );
};
