import type { FeedContentRow, FeedRow } from "@rezics/api/feed/feed";
import {
  type FeedCarouselRow,
  type FeedWorkSummary,
  type ModerationActionDTO,
  type ModerationStatus,
  type ShelfDTO,
  type ShelfSummaryDTO,
  PostKind,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { DomainCarousel } from "@rezics/ui/composite/carousel/DomainCarousel";
import { EmptyState } from "@rezics/ui";
import { Card, CardContent, Skeleton } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { PostCard } from "@/post";
import { ReviewCard } from "@/review/components/item/ReviewCard";
import { TextLink } from "@/shared/ui/link";
import { ShelfCard } from "@/shelf/components/ShelfCard";

interface FeedRendererProps {
  rows: FeedRow[];
  loading?: boolean;
  emptyTitle?: string;
  renderContentRow?: (row: FeedContentRow) => React.ReactNode;
}

function FeedLoadingRows() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="rounded-md bg-surface-subtle p-4">
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

interface FeedContentCardProps {
  row: FeedContentRow;
  summaryScopeKey?: string;
  reactionScopeKey?: string;
  manageMode?: boolean;
  realmModerationStatus?: ModerationStatus;
  realmModerationAt?: string | Date | null;
  moderationLatestAction?: ModerationActionDTO | null;
  moderationMenuContent?: React.ReactNode;
}

export function FeedContentCard({
  row,
  summaryScopeKey,
  reactionScopeKey,
  manageMode,
  realmModerationStatus,
  realmModerationAt,
  moderationLatestAction,
  moderationMenuContent,
}: FeedContentCardProps) {
  const navigate = useNavigate();
  const openRow = () => navigate({ to: row.href });

  if (row.post.kind === PostKind.REVIEW) {
    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: nested links and actions provide keyboard access; pointer row open mirrors content cards.
      // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard users can use the nested review title/action links.
      <div
        className="cursor-pointer border-b border-border-whisper"
        onClick={openRow}
      >
        <ReviewCard
          review={row.post}
          className="border-b-0"
          targetUnit={
            row.targetUnit?.unitId
              ? {
                  unitId: row.targetUnit.unitId,
                  title: row.targetUnit.title ?? row.targetUnit.unitId,
                }
              : undefined
          }
        />
      </div>
    );
  }

  return (
    <PostCard
      post={row.post}
      onOpen={openRow}
      href={row.href}
      summaryScopeKey={summaryScopeKey}
      reactionScopeKey={reactionScopeKey}
      variantContext={row.variantContext}
      manageMode={manageMode}
      realmModerationStatus={realmModerationStatus}
      realmModerationAt={realmModerationAt}
      moderationLatestAction={moderationLatestAction}
      moderationMenuContent={moderationMenuContent}
    />
  );
}

export const FeedRenderer: React.FC<FeedRendererProps> = ({
  rows,
  loading = false,
  emptyTitle = "No feed items yet",
  renderContentRow,
}) => {
  if (loading) return <FeedLoadingRows />;
  if (rows.length === 0) return <EmptyState title={emptyTitle} />;

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
