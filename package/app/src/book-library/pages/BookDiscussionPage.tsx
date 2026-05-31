import { bookQueries } from "@rezics/api/book/book";
import { useTranslation } from "@rezics/i18n/react";
import { Separator } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import type React from "react";
import { useMemo } from "react";
import { PostListSection, ReplyComposer } from "@/post";
import { resolveBookCommunityFeedQuery } from "../models/communityFeed";
import { bookDetailAtomFamily } from "../states/bookDetailAtoms";
import { useBookDetailSidebar } from "./bookDetailLayoutContext";

const CommunitySidebar: React.FC = () => {
  const { t } = useTranslation(["book", "page"]);
  return (
    <div className="bg-surface-elevated p-4 border border-border-whisper rounded-md">
      <h3 className="text-base font-semibold mb-2">
        {t("page:book_tabs_community")}
      </h3>
      <p className="text-sm text-text-secondary">
        {t("book:community_sidebar_help")}
      </p>
    </div>
  );
};

/**
 * Community tab — discussion threads for the book.
 * (Routed at `/book/$bookId/discussion`; the tab label is "Community".)
 */
export const BookCommunityPage: React.FC = () => {
  const { bookId } = useParams({ strict: false }) as { bookId: string };
  const { data } = useQuery({
    ...bookQueries.detail(bookId),
    enabled: Boolean(bookId),
  });
  const bookInfo = useAtomValue(bookDetailAtomFamily(bookId)) ?? data;

  const sidebar = useMemo(() => <CommunitySidebar />, []);
  useBookDetailSidebar(sidebar);

  if (!bookInfo) return null;

  const feedQuery = resolveBookCommunityFeedQuery({
    currentReleaseUnitId: bookInfo.unitId,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="lg:hidden">
        <CommunitySidebar />
      </div>

      <ReplyComposer mode="progressive" targetUnitId={bookId} />

      <Separator />

      <PostListSection
        targetUnitId={feedQuery.targetUnitId}
        currentReleaseUnitId={bookInfo.unitId}
      />
    </div>
  );
};
