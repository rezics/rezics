import { bookQueries } from "@rezics/contract/api/book/book";
import { useTranslation } from "@rezics/i18n/react";
import { Separator } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import type React from "react";
import { useMemo } from "react";
import { ReplyComposer } from "@/comment";
import { StreamSection } from "@/stream";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { resolveCatalogEntryInteractionContext } from "../models/catalogEntryContext";
import { resolveBookCommunityStreamQuery } from "../models/communityStream";
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
  const readContext = useReadLanguageContext();
  const { data } = useQuery({
    ...bookQueries.detail(bookId, {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    enabled: Boolean(bookId) && readContext.ready,
  });
  const bookInfo = useAtomValue(bookDetailAtomFamily(bookId)) ?? data;

  const sidebar = useMemo(() => <CommunitySidebar />, []);
  useBookDetailSidebar(sidebar);

  if (!bookInfo) return null;

  const context = resolveCatalogEntryInteractionContext(bookInfo);
  const streamQuery = resolveBookCommunityStreamQuery({
    currentCatalogEntryUnitId: context.primaryTargetUnitId,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="lg:hidden">
        <CommunitySidebar />
      </div>

      <ReplyComposer
        mode="progressive"
        targetUnitId={context.primaryTargetUnitId}
        variantUnitId={context.variantUnitId}
      />

      <Separator />

      <StreamSection
        query={{
          scope: "library",
          libraryKind: "book",
          ...(context.variantUnitId
            ? { variantUnitId: context.variantUnitId }
            : { targetUnitId: streamQuery.targetUnitId }),
          languages: readContext.languages,
          appLocale: readContext.appLocale,
        }}
      />
    </div>
  );
};
