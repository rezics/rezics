import type { FeedContentRow, FeedRow } from "@rezics/api/feed/feed";
import type {
  FeedCarouselRow,
  FeedWorkSummary,
  ShelfDTO,
  ShelfSummaryDTO,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { EmptyState } from "@rezics/ui";
import { DomainCarousel } from "@rezics/ui/composite/carousel/DomainCarousel.tsx";
import { Card, CardContent, Skeleton } from "@rezics/ui/shadcn";
import type React from "react";
import { TextLink } from "@/shared/ui/link";
import { ShelfCard } from "@/shelf";
import { FeedContentCard } from "./FeedContentCard";

interface FeedRendererProps {
  rows: FeedRow[];
  loading?: boolean;
  emptyTitle?: string;
  renderContentRow?: (row: FeedContentRow) => React.ReactNode;
}

const FEED_LOADING_ROW_KEYS = [
  "feed-loading-1",
  "feed-loading-2",
  "feed-loading-3",
  "feed-loading-4",
];

function FeedLoadingRows() {
  return (
    <div className="space-y-4">
      {FEED_LOADING_ROW_KEYS.map((key) => (
        <div key={key} className="rounded-md bg-surface-subtle p-4">
          <Skeleton className="mb-3 h-5 w-40" />
          <Skeleton className="mb-2 h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

function carouselTitle(
  t: ReturnType<typeof useTranslation>["t"],
  row: FeedCarouselRow,
): string {
  switch (row.title.key) {
    case "feed.carousel.works":
      return t("community:feed_carousel_works");
    case "feed.carousel.shelves":
      return t("community:feed_carousel_shelves");
    default:
      return row.title.key;
  }
}

function WorkSummaryCard({ work }: { work: FeedWorkSummary }) {
  const { t } = useTranslation(["common"]);
  const title = work.title ?? t("common:untitled");
  return (
    <TextLink
      to="/book/$bookId"
      params={{ bookId: work.unitId }}
      underline="none"
      className="block h-full"
    >
      <Card surface="plain" interactive className="h-full gap-0 py-0">
        <div className="aspect-[3/4] overflow-hidden border-b border-border-whisper bg-surface-subtle">
          {work.coverUrl ? (
            <img
              src={work.coverUrl}
              alt={title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-3 text-center text-xs leading-dense text-text-secondary">
              {title}
            </div>
          )}
        </div>
        <CardContent className="px-3 py-3">
          <p className="line-clamp-2 text-sm font-medium leading-ui text-text-primary">
            {title}
          </p>
        </CardContent>
      </Card>
    </TextLink>
  );
}

function shelfSummaryToDTO(shelf: ShelfSummaryDTO): ShelfDTO {
  return {
    unitId: shelf.unitId,
    slug: shelf.slug,
    userId: shelf.userId,
    kindKey: shelf.kindKey,
    coverUrl: shelf.coverUrl,
    itemCount: shelf.itemCount,
    translations: shelf.title
      ? [
          {
            unitId: shelf.unitId,
            language: "en",
            title: shelf.title,
          },
        ]
      : [],
  };
}

function FeedCarousel({ row }: { row: FeedCarouselRow }) {
  const { t } = useTranslation(["community"]);
  const title = carouselTitle(t, row);
  const items =
    row.carouselKind === "works" ? (row.works ?? []) : (row.shelves ?? []);

  if (items.length === 0) return null;

  return (
    <section className="py-2" aria-label={title}>
      <h2 className="mb-3 text-sm font-medium leading-ui text-text-secondary">
        {title}
      </h2>
      {row.carouselKind === "works" ? (
        <DomainCarousel
          items={row.works ?? []}
          itemKey={(work) => work.unitId}
          itemClassName="basis-40 pl-4 sm:basis-44"
          ariaLabel={title}
          renderItem={(work) => <WorkSummaryCard work={work} />}
        />
      ) : (
        <DomainCarousel
          items={row.shelves ?? []}
          itemKey={(shelf) => shelf.unitId}
          itemClassName="basis-64 pl-4 sm:basis-72"
          ariaLabel={title}
          renderItem={(shelf) => <ShelfCard shelf={shelfSummaryToDTO(shelf)} />}
        />
      )}
    </section>
  );
}

export const FeedRenderer: React.FC<FeedRendererProps> = ({
  rows,
  loading = false,
  emptyTitle,
  renderContentRow,
}) => {
  const { t } = useTranslation("community");
  const effectiveEmptyTitle = emptyTitle ?? t("feed_empty");

  if (loading) return <FeedLoadingRows />;
  if (rows.length === 0) return <EmptyState title={effectiveEmptyTitle} />;

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        if (row.type === "carousel") {
          return <FeedCarousel key={row.rowId} row={row} />;
        }

        return renderContentRow ? (
          <div key={row.rowId}>{renderContentRow(row)}</div>
        ) : (
          <FeedContentCard key={row.rowId} row={row} />
        );
      })}
    </div>
  );
};
