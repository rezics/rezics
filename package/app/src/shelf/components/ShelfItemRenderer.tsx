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
  ShelfItemParentRole,
} from "@rezics/contract";
import {
  contentDocMarkdownFallback,
  isLibraryKind,
  shelfItemIdentity,
  shelfItemReference,
  shelfItemUnitId,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Badge, Tabs, TabsList, TabsTrigger } from "@rezics/ui/shadcn";
import { useState } from "react";
import { BookCard, HorizontalBookCard } from "@/book-library";
import { coverAspectRatioForLibraryKind } from "@/bookshelf-view";
import { CommentReply } from "@/comment";
import { ExcerptCard, mapPostToExcerptUnit } from "@/excerpt";
import { ReviewCard } from "@/review";
import { Link, unitHref } from "@/shared/ui/link";
import { getBookAuthorName } from "@/shared/utils/translation-helpers";
import { StreamPostCard } from "@/stream";
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
    const summary = shelfItemToUnitCardSummary(unit, data);
    const unitId = shelfItemUnitId(unit) ?? shelfItemReference(unit);
    const href = unit.kind === "book" ? `/book/${unitId}` : `/unit/${unitId}`;
    return (
      <BookCard
        title={summary.title}
        author={summary.author?.name ?? undefined}
        coverUrl={summary.imageUrl ?? ""}
        href={href}
        showTitle
        aspectRatio={coverAspectRatioForLibraryKind(unit.kind)}
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
          variantContext={post.variantContext}
        />
      );
    }
    case "quote": {
      const post = data as PostDTO | undefined;
      if (!post) return <ShelfItemCard unit={unit} />;
      return (
        <ExcerptCard
          excerpt={mapPostToExcerptUnit(post)}
          variantContext={post.variantContext}
        />
      );
    }
    case "post": {
      const post = data as PostDTO | undefined;
      if (!post) return <ShelfItemCard unit={unit} />;
      return <StreamPostCard post={post} />;
    }
    case "shelf": {
      const shelf = data as ShelfDTO | undefined;
      if (!shelf) return <ShelfItemCard unit={unit} />;
      return <ShelfCard shelf={shelf} />;
    }
    case "tag": {
      const tag = data as TagListEntryDTO | undefined;
      if (!tag) return <ShelfItemCard unit={unit} />;
      const tagLabel =
        tag.translations?.[0]?.title ?? tag.label ?? tag.slug ?? tag.unitId;
      const href = unitHref({ type: "TAG", unitId: tag.unitId, slug: null });
      return (
        <Link to={href}>
          <Badge variant="secondary" className="cursor-pointer">
            {tagLabel}
          </Badge>
        </Link>
      );
    }
    case "comment": {
      const comment = data as CommentDTO | undefined;
      if (!comment) return <ShelfItemCard unit={unit} />;
      return (
        <CommentReply post={comment} showAvatar={viewMode !== "masonry"} />
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
      reviews?: number;
      variants?: number;
      comments?: number;
      tags?: number;
      annotations?: number;
      total?: number;
    }
  | undefined {
  if (entry.kind !== "root") return undefined;
  const counts = {
    reviews: 0,
    variants: 0,
    comments: 0,
    tags: 0,
    annotations: 0,
    total: entry.children.length,
  };
  for (const child of entry.children) {
    const role = child.unit.parentRole;
    if (role === "review" || child.unit.kind === "review") counts.reviews += 1;
    else if (role === "variant") counts.variants += 1;
    else if (role === "comment" || child.unit.kind === "comment")
      counts.comments += 1;
    else if (role === "tag" || child.unit.kind === "tag") counts.tags += 1;
    else if (role === "annotation") counts.annotations += 1;
  }
  if (counts.total === 0) return undefined;
  return counts;
}

function childRoleLabel(
  role: ShelfItemParentRole | null | undefined,
  t: (key: string) => string,
): string {
  switch (role) {
    case "variant":
      return t("shelf_child_role_variant");
    case "comment":
      return t("shelf_child_role_comment");
    case "tag":
      return t("shelf_child_role_tag");
    case "annotation":
      return t("shelf_child_role_annotation");
    default:
      return t("shelf_child_role_review");
  }
}

function NestedRootCard({
  root,
  attachedChildren,
}: {
  root: EnrichedShelfItem;
  attachedChildren: EnrichedShelfItem[];
}) {
  const { t } = useTranslation("entity");
  const [tab, setTab] = useState("0");
  const primary = renderUnit(root, "nested");
  const tabChildren = attachedChildren;

  if (tabChildren.length === 0) {
    return <>{primary}</>;
  }

  const activeIdx = Number(tab);
  const activeChild = tabChildren[activeIdx];

  return (
    <div className="flex flex-col gap-2">
      {primary}
      <div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="overflow-x-auto">
            {tabChildren.map((c, idx) => {
              // Tabs expose every supported one-level child role; deeper graph
              // traversal is intentionally not rendered in nested mode.
              // tabs 展示每个受支持的一层 child role；nested 模式有意不递归渲染更深图关系。
              const labelPrefix = childRoleLabel(c.unit.parentRole, t);
              return (
                <TabsTrigger
                  key={shelfItemIdentity(c.unit)}
                  value={String(idx)}
                >
                  {labelPrefix} {idx + 1}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
        {activeChild?.unit.kind === "review" && activeChild.data ? (
          <ReviewCard
            review={activeChild.data as PostDTO}
            showTargetUnit={false}
          />
        ) : activeChild ? (
          renderUnit(activeChild, "nested")
        ) : null}
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
