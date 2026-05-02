import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import type {
  EnrichedShelfItem,
  ShelfView,
  TagListEntryDTO,
} from "@rezics/api/shelf";
import type { BookDTO, PostDTO, UnitDTO, UnitTagDTO } from "@rezics/contract";
import { useState } from "react";
import { HorizontalBookCard } from "@/book-library/components/item/HorizontalBookCard";
import { BookCard } from "@/book-library/components/item/VerticalBookCard";
import { ExcerptCard } from "@/excerpt/components/item/ExcerptCard";
import { PostCard } from "@/post";
import { ReviewCard } from "@/review/components/item/ReviewCard";
import { getBookAuthorName } from "@/shared/utils/translation-helpers";
import { SingleTagChip } from "@/tag/components/TagList";
import type { ShelfStreamEntry } from "../models/shelfStream";
import { ShelfItemCard } from "./ShelfItemCard";

interface ShelfItemRendererProps {
  entry: ShelfStreamEntry;
  viewMode: ShelfView;
}

function renderPrimary(
  enriched: EnrichedShelfItem,
  viewMode: ShelfView,
): React.ReactNode {
  const { item, primary } = enriched;
  switch (item.kind) {
    case "book": {
      const book = primary as BookDTO | undefined;
      if (!book) return null;
      const title = book.translations?.[0]?.title ?? item.itemRef;
      const description = book.translations?.[0]?.description ?? undefined;
      const author = getBookAuthorName(book) || undefined;
      const coverUrl = book.coverUrl ?? "";
      const href = `/book/${item.itemRef}`;
      if (viewMode === "masonry") {
        return (
          <BookCard
            title={title}
            author={author}
            coverUrl={coverUrl}
            href={href}
          />
        );
      }
      return (
        <HorizontalBookCard
          title={title}
          author={author}
          description={description}
          coverUrl={coverUrl}
          href={href}
        />
      );
    }
    case "review": {
      const post = primary as PostDTO | undefined;
      if (!post) return null;
      return <ReviewCard review={post} />;
    }
    case "quote": {
      const post = primary as PostDTO | undefined;
      if (!post) return null;
      return <ExcerptCard excerpt={post as unknown as UnitDTO} />;
    }
    case "post": {
      const post = primary as PostDTO | undefined;
      if (!post) return null;
      return <PostCard post={post} />;
    }
    case "tag": {
      const tag = primary as TagListEntryDTO | undefined;
      if (!tag) return null;
      return <SingleTagChip tag={tag as unknown as UnitTagDTO} />;
    }
    default:
      return <ShelfItemCard item={item} />;
  }
}

function NestedPrimeCard({ enriched }: { enriched: EnrichedShelfItem }) {
  const [tab, setTab] = useState(0);
  const primary = renderPrimary(enriched, "nested");
  const reviews = enriched.attachedReviews;

  if (reviews.length === 0) {
    return <>{primary}</>;
  }

  return (
    <Stack spacing={1}>
      {primary}
      <Box>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {reviews.map((review, idx) => (
            <Tab
              key={review.unitId}
              label={
                (review.extra as { title?: string } | undefined)?.title ??
                `Review ${idx + 1}`
              }
            />
          ))}
        </Tabs>
        {reviews[tab] && <ReviewCard review={reviews[tab]} />}
      </Box>
    </Stack>
  );
}

export function ShelfItemRenderer({
  entry,
  viewMode,
}: ShelfItemRendererProps) {
  if (entry.kind === "review") {
    return <ReviewCard review={entry.review} />;
  }

  if (viewMode === "nested") {
    return <NestedPrimeCard enriched={entry.enriched} />;
  }

  return <>{renderPrimary(entry.enriched, viewMode)}</>;
}
