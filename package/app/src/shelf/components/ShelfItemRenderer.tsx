import type {
  EnrichedShelfUnit,
  ShelfView,
  TagListEntryDTO,
} from "@rezics/api/shelf";
import type {
  BookDTO,
  PostDTO,
  ShelfDTO,
  UnitDTO,
  UnitTagDTO,
} from "@rezics/contract";
import { contentDocMarkdownFallback } from "@rezics/contract";
import { Tabs, TabsList, TabsTrigger } from "@rezics/ui/shadcn";
import { useState } from "react";
import { HorizontalBookCard } from "@/book-library/components/item/HorizontalBookCard";
import { BookCard } from "@/book-library/components/item/VerticalBookCard";
import { ExcerptCard } from "@/excerpt/components/item/ExcerptCard";
import { PostCard } from "@/post";
import { ReviewCard } from "@/review/components/item/ReviewCard";
import { getBookAuthorName } from "@/shared/utils/translation-helpers";
import { SingleTagChip } from "@/tag/components/TagList";
import { shelfUnitToUnitCardSummary, UnitCard } from "@/unit";
import type { ShelfStreamEntry } from "../models/shelfStream";
import { ShelfCard } from "./ShelfCard";
import { ShelfItemCard } from "./ShelfItemCard";

interface ReviewTargetWork {
  unitId: string;
  title: string;
}

interface ShelfItemRendererProps {
  entry: ShelfStreamEntry;
  viewMode: ShelfView;
  /**
   * Optional left-column controls (drag handle, move, delete) for editor use.
   */
  editControls?: React.ReactNode;
  /**
   * When true, all entries render as fixed-height `UnitCard`s regardless of
   * viewMode.
   */
  editing?: boolean;
}

function renderUnit(
  enriched: EnrichedShelfUnit,
  viewMode: ShelfView,
  options?: {
    targetWork?: ReviewTargetWork;
    showTargetWork?: boolean;
  },
): React.ReactNode {
  const { unit, data } = enriched;
  switch (unit.kind) {
    case "book": {
      const book = data as BookDTO | undefined;
      if (!book) return <ShelfItemCard unit={unit} />;
      const title = book.translations?.[0]?.title ?? unit.unitId;
      const description =
        contentDocMarkdownFallback(book.translations?.[0]?.description) ||
        undefined;
      const author = getBookAuthorName(book) || undefined;
      const coverUrl = book.coverUrl ?? "";
      const href = `/book/${unit.unitId}`;
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
      const post = data as PostDTO | undefined;
      if (!post) return <ShelfItemCard unit={unit} />;
      return (
        <ReviewCard
          review={post}
          targetWork={options?.targetWork}
          showTargetWork={options?.showTargetWork}
        />
      );
    }
    case "quote": {
      const post = data as PostDTO | undefined;
      if (!post) return <ShelfItemCard unit={unit} />;
      return <ExcerptCard excerpt={post as unknown as UnitDTO} />;
    }
    case "post": {
      const post = data as PostDTO | undefined;
      if (!post) return <ShelfItemCard unit={unit} />;
      return <PostCard post={post} />;
    }
    case "shelf": {
      const shelf = data as ShelfDTO | undefined;
      if (!shelf) return <ShelfItemCard unit={unit} />;
      return <ShelfCard shelf={shelf} />;
    }
    case "tag": {
      const tag = data as TagListEntryDTO | undefined;
      if (!tag) return <ShelfItemCard unit={unit} />;
      return <SingleTagChip tag={tag as unknown as UnitTagDTO} />;
    }
    default:
      return <ShelfItemCard unit={unit} />;
  }
}

function getBookTitle(enriched: EnrichedShelfUnit | undefined): string | null {
  if (!enriched || enriched.unit.kind !== "book") return null;
  const book = enriched.data as BookDTO | undefined;
  return book?.translations?.[0]?.title ?? enriched.unit.unitId;
}

function targetWorkFromParent(
  parent: EnrichedShelfUnit | undefined,
): ReviewTargetWork | undefined {
  const title = getBookTitle(parent);
  if (!parent || !title) return undefined;
  return {
    unitId: parent.unit.unitId,
    title,
  };
}

function attachmentCountsForEntry(entry: ShelfStreamEntry):
  | {
      reviews: number;
      tags: number;
    }
  | undefined {
  if (entry.kind !== "root") return undefined;
  let reviews = 0;
  let tags = 0;
  for (const child of entry.children) {
    if (child.unit.kind === "review") reviews += 1;
    if (child.unit.kind === "tag") tags += 1;
  }
  if (reviews === 0 && tags === 0) return undefined;
  return { reviews, tags };
}

function NestedRootCard({
  root,
  attachedChildren,
}: {
  root: EnrichedShelfUnit;
  attachedChildren: EnrichedShelfUnit[];
}) {
  const [tab, setTab] = useState("0");
  const primary = renderUnit(root, "nested");
  const reviewChildren = attachedChildren.filter(
    (c) => c.unit.kind === "review",
  );

  if (reviewChildren.length === 0) {
    return <>{primary}</>;
  }

  const activeIdx = Number(tab);

  return (
    <div className="flex flex-col gap-2">
      {primary}
      <div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="overflow-x-auto">
            {reviewChildren.map((c, idx) => {
              const post = c.data as PostDTO | undefined;
              return (
                <TabsTrigger key={c.unit.unitId} value={String(idx)}>
                  {(post?.extra as { title?: string } | undefined)?.title ??
                    `Review ${idx + 1}`}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
        {reviewChildren[activeIdx]?.data && (
          <ReviewCard
            review={reviewChildren[activeIdx]!.data as PostDTO}
            showTargetWork={false}
          />
        )}
      </div>
    </div>
  );
}

export function ShelfItemRenderer({
  entry,
  viewMode,
  editControls,
  editing,
}: ShelfItemRendererProps) {
  let content: React.ReactNode;
  if (editing) {
    content = (
      <UnitCard
        summary={shelfUnitToUnitCardSummary(
          entry.unit.unit,
          entry.unit.data,
          undefined,
          attachmentCountsForEntry(entry),
        )}
      />
    );
  } else if (entry.kind === "root" && viewMode === "nested") {
    content = (
      <NestedRootCard
        root={entry.unit}
        attachedChildren={entry.children ?? []}
      />
    );
  } else {
    content = renderUnit(entry.unit, viewMode, {
      targetWork:
        entry.kind === "child" ? targetWorkFromParent(entry.parent) : undefined,
    });
  }

  if (!editControls) {
    return content;
  }

  return (
    <div className="flex items-stretch gap-2">
      <div className="flex flex-col items-center justify-start gap-1 shrink-0 pt-1">
        {editControls}
      </div>
      <div className="min-w-0 flex-1">{content}</div>
    </div>
  );
}
