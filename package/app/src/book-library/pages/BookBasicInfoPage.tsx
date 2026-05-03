import { Box, Divider, Stack } from "@mui/material";
import { bookQueries } from "@rezics/api/book/book";
import { tagQueries } from "@rezics/api/tag/tag.queries";
import { ArrowForwardIcon } from "@rezics/ui/composite/navigation/ArrowForwardIcon.tsx";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { WorkReleaseNav } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import type React from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { RemarkInlineForm } from "@/remark";
import { useNavigateToBookTagSearch } from "@/search/hooks/useNavigateToBookTagSearch";
import { getTranslation } from "@/shared/utils/translation-helpers";
import { TagInteraction } from "@/tag/components/TagInteraction";
import { BookDescription } from "../components/BookDescription";
import { MetadataPanel } from "../components/BookDetail/MetadataPanel";
import { ExcerptPreview } from "../components/ExcerptPreview";
import { RemarkPreview } from "../components/RemarkPreview";
import { useBookLanguage } from "../hooks/useBookLanguage";
import { bookDetailAtomFamily } from "../states/bookDetailAtoms";
import { useBookDetailSidebar } from "./bookDetailLayoutContext";

interface BookWorkReleaseNavProps {
  workUnitId: string;
  currentUnitId: string;
}

const BookWorkReleaseNav: React.FC<BookWorkReleaseNavProps> = ({
  workUnitId,
  currentUnitId,
}) => {
  const { t } = useTranslation();
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
      heading={t("book.otherEditions", "Other Editions")}
      emptyLabel={t("book.editionFallback", "Edition")}
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

export const BookBasicInfoPage: React.FC = () => {
  const { bookId } = useParams({ strict: false }) as { bookId: string };
  const { data } = useQuery({
    ...bookQueries.detail(bookId),
    enabled: Boolean(bookId),
  });
  const bookInfo = useAtomValue(bookDetailAtomFamily(bookId)) ?? data;

  const { t } = useTranslation();
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
      <Stack spacing={3}>
        <MetadataPanel bookInfo={bookInfo} />
        {bookInfo.workUnitId && (
          <BookWorkReleaseNav
            workUnitId={bookInfo.workUnitId}
            currentUnitId={bookInfo.unitId}
          />
        )}
      </Stack>
    );
  }, [bookInfo]);
  useBookDetailSidebar(sidebar);

  if (!bookInfo) return null;

  const description =
    getTranslation(
      bookInfo.translations,
      selectedLang,
      bookInfo.defaultLanguage ?? undefined,
    )?.description ?? "";

  return (
    <Stack spacing={4}>
      <BookDescription description={description} />

      <Box className="lg:hidden">
        <MetadataPanel bookInfo={bookInfo} variant="inline" />
      </Box>

      {unitTags.length > 0 && (
        <>
          <Divider />
          <div>
            <AccentBarWithText text={t("book.fields.tags", "Tags")} />
            <Box mt={1}>
              <TagInteraction
                tags={unitTags}
                translations={tagTranslations ?? {}}
                bookUnitId={bookInfo.unitId ?? bookId}
                bookUnit={bookInfo}
                onSearchTags={navigateToBookTagSearch}
              />
            </Box>
          </div>
        </>
      )}

      <Divider />

      <div>
        <ArrowForwardIcon size={16} to={`/excerpt/book/${bookInfo.unitId}`}>
          <AccentBarWithText text={t("book.excerpts")} />
        </ArrowForwardIcon>
      </div>
      <ExcerptPreview id={bookInfo.unitId || ""} />

      <Divider />

      <div>
        <AccentBarWithText text={t("book.fields.score" as any)} />
        <Box mt={1}>
          <RemarkInlineForm bookUnitId={bookInfo.unitId || ""} />
        </Box>
      </div>

      <Divider />

      <Box>
        <div>
          <ArrowForwardIcon
            size={16}
            to={`/review/book/${bookInfo.unitId}?tab=remark`}
          >
            <AccentBarWithText text={t("book.remark")} />
          </ArrowForwardIcon>
        </div>
        <RemarkPreview bookId={bookInfo.unitId || ""} />
      </Box>

      {bookInfo.workUnitId && (
        <Box className="lg:hidden">
          <BookWorkReleaseNav
            workUnitId={bookInfo.workUnitId}
            currentUnitId={bookInfo.unitId}
          />
        </Box>
      )}
    </Stack>
  );
};
