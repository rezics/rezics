import { bookQueries } from "@rezics/api/book/book";
import { useTranslation } from "@rezics/i18n/react";
import { Button, Separator } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import type React from "react";
import { useMemo, useState } from "react";
import { PostListSection, ReplyComposer } from "@/post";
import {
  resolveBookCommunityFeedQuery,
  type BookCommunityFeedMode,
} from "../models/communityFeed";
import { releaseWorkUnitId, sortWorkReleases } from "../models/releaseWork";
import { getTranslation } from "@/shared/utils/translation-helpers";
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
  const [feedMode, setFeedMode] = useState<BookCommunityFeedMode>("work");
  const { data } = useQuery({
    ...bookQueries.detail(bookId),
    enabled: Boolean(bookId),
  });
  const bookInfo = useAtomValue(bookDetailAtomFamily(bookId)) ?? data;
  const workUnitId = releaseWorkUnitId(bookInfo);
  const { data: releaseList } = useQuery({
    ...bookQueries.list({ workUnitId, limit: 100 }),
    enabled: Boolean(workUnitId),
  });

  const sidebar = useMemo(() => <CommunitySidebar />, []);
  useBookDetailSidebar(sidebar);

  if (!bookInfo) return null;

  const feedQuery = resolveBookCommunityFeedQuery({
    currentReleaseUnitId: bookInfo.unitId,
    workUnitId,
    exactRelease: feedMode === "release",
  });
  const releaseTitlesByUnitId = Object.fromEntries(
    sortWorkReleases([...(releaseList?.books ?? []), bookInfo]).map(
      (release) => [
        release.unitId,
        getTranslation(release.translations)?.title ?? release.unitId,
      ],
    ),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="lg:hidden">
        <CommunitySidebar />
      </div>

      <ReplyComposer mode="progressive" targetUnitId={bookId} />

      <Separator />

      {workUnitId && (
        <div className="flex flex-row flex-wrap gap-2">
          <Button
            type="button"
            variant={feedQuery.mode === "work" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFeedMode("work")}
          >
            All releases
          </Button>
          <Button
            type="button"
            variant={feedQuery.mode === "release" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFeedMode("release")}
          >
            This release
          </Button>
        </div>
      )}

      <PostListSection
        targetUnitId={feedQuery.targetUnitId}
        workUnitId={feedQuery.workUnitId}
        workRoles={feedQuery.workRoles}
        currentReleaseUnitId={bookInfo.unitId}
        targetReleaseTitles={releaseTitlesByUnitId}
      />
    </div>
  );
};
