import type {
  EnrichedShelfItem,
  ShelfView,
  TagListEntryDTO,
} from "@rezics/api/shelf";
import type {
  BookDTO,
  CommentDTO,
  PostDTO,
  ShelfDTO,
  UnitDTO,
  UnitTagDTO,
} from "@rezics/contract";
import {
  contentDocMarkdownFallback,
  isLibraryKind,
  shelfItemIdentity,
  shelfItemReference,
  shelfItemUnitId,
} from "@rezics/contract";
import { Tabs, TabsList, TabsTrigger } from "@rezics/ui/shadcn";
import { useState } from "react";
import { HorizontalBookCard } from "@/book-library/components/item/HorizontalBookCard";
import { BookCard } from "@/book-library/components/item/VerticalBookCard";
import { aspectRatioForKind } from "@/bookshelf-view";
import { CommentReply } from "@/comment/components/item/CommentReply";
import { ExcerptCard } from "@/excerpt/components/item/ExcerptCard";
import { PostCard } from "@/post";
import { ReviewCard } from "@/review/components/item/ReviewCard";
import { getBookAuthorName } from "@/shared/utils/translation-helpers";
import { SingleTagChip } from "@/tag/components/TagList";
import { shelfItemToUnitCardSummary, UnitCard } from "@/unit";
import type { ShelfStreamEntry } from "../models/shelfStream";
import { ShelfCard } from "./ShelfCard";
import { ShelfItemCard } from "./ShelfItemCard";

interface ReviewTargetUnit {
  unitId: string;
  title: string;
}

interface ShelfItemRendererProps {
  entry: ShelfStreamEntry;
  viewMode: ShelfView;
  /**
   * Optional left-column controls (drag handle, move, delete) for editor use.
   * 可选的左栏控件（拖拽手柄、移动、删除），供编辑器使用。
   */
  editControls?: React.ReactNode;
  /**
   * When true, all entries render as fixed-height `UnitCard`s regardless of
   * viewMode.
   * 为 true 时，所有条目都渲染为固定高度的 `UnitCard`，与 viewMode 无关。
   */
  editing?: boolean;
}

function renderUnit(
  enriched: EnrichedShelfItem,
  viewMode: ShelfView,
  options?: {
    targetUnit?: ReviewTargetUnit;
    showTargetUnit?: boolean;
  },
): React.ReactNode {
  const { unit, data } = enriched;

  // Bookshelf (cover grid) view: render library kinds as cover-only cards and
  // silently skip non-library kinds. Layout/columns are owned by the grid
  // container; each item just renders a kind-aspect cover.
  // Bookshelf（封面网格）视图：将 library 类型渲染为仅含封面的卡片，并静默
  // 跳过非 library 类型。布局/列数由网格容器掌控；每个条目只渲染按类型比例的
  // 封面。
  if (viewMode === "bookshelf") {
    if (!isLibraryKind(unit.kind)) return null;
    const book = data as BookDTO | undefined;
    const unitId = shelfItemUnitId(unit) ?? shelfItemReference(unit);
    return (
      <BookCard
        title={book?.title ?? unitId}
        author={book ? getBookAuthorName(book) || undefined : undefined}
        coverUrl={book?.coverUrl ?? ""}
        href={`/book/${unitId}`}
        showTitle
        aspectRatio={aspectRatioForKind(unit.kind)}
      />
    );
  }

  switch (unit.kind) {
    case "book": {
      const book = data as BookDTO | undefined;
      if (!book) return <ShelfItemCard unit={unit} />;
      const unitId = shelfItemUnitId(unit) ?? shelfItemReference(unit);
      const title = book.title ?? unitId;
      const description =
        contentDocMarkdownFallback(book.description) ?? undefined;
      const author = getBookAuthorName(book) || undefined;
      const coverUrl = book.coverUrl ?? "";
      const href = `/book/${unitId}`;
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
          targetUnit={options?.targetUnit}
          showTargetUnit={options?.showTargetUnit}
          variantContext={post.variantContext ?? unit.variantContext}
        />
      );
    }
    case "quote": {
      const post = data as PostDTO | undefined;
      if (!post) return <ShelfItemCard unit={unit} />;
      return (
        <ExcerptCard
          excerpt={post as unknown as UnitDTO}
          variantContext={post.variantContext ?? unit.variantContext}
        />
      );
    }
    case "post": {
      const post = data as PostDTO | undefined;
      if (!post) return <ShelfItemCard unit={unit} />;
      return <PostCard post={post} variantContext={unit.variantContext} />;
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
    case "comment": {
      const comment = data as CommentDTO | undefined;
      if (!comment) return <ShelfItemCard unit={unit} />;
      return (
        <CommentReply
          post={comment}
          showAvatar={viewMode !== "masonry"}
          summaryScopeKey={`shelf-item:${unit.itemId}`}
          reactionScopeKey={`shelf-item:${unit.itemId}`}
        />
      );
    }
    default:
      return <ShelfItemCard unit={unit} />;
  }
}

function getBookTitle(enriched: EnrichedShelfItem | undefined): string | null {
  if (!enriched || enriched.unit.kind !== "book") return null;
  const book = enriched.data as BookDTO | undefined;
  return book?.title ?? shelfItemReference(enriched.unit);
}

function targetUnitFromParent(
  parent: EnrichedShelfItem | undefined,
): ReviewTargetUnit | undefined {
  const title = getBookTitle(parent);
  if (!parent || !title) return undefined;
  return {
    unitId: shelfItemUnitId(parent.unit) ?? shelfItemReference(parent.unit),
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
  root: EnrichedShelfItem;
  attachedChildren: EnrichedShelfItem[];
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
                <TabsTrigger
                  key={shelfItemIdentity(c.unit)}
                  value={String(idx)}
                >
                  {post?.title ?? `Review ${idx + 1}`}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
        {reviewChildren[activeIdx]?.data && (
          <ReviewCard
            review={reviewChildren[activeIdx]!.data as PostDTO}
            showTargetUnit={false}
            variantContext={reviewChildren[activeIdx]!.unit.variantContext}
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
        summary={shelfItemToUnitCardSummary(
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
      targetUnit:
        entry.kind === "child" ? targetUnitFromParent(entry.parent) : undefined,
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
