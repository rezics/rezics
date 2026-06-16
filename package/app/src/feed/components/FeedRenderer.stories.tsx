import { type FeedRow, PostKind } from "@rezics/contract";
import { Button } from "@rezics/ui/shadcn";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type React from "react";
import { withRouter } from "@/stories/decorators/withRouter";
import { bookMany } from "@/stories/fixtures/book";
import { postFlat } from "@/stories/fixtures/post";
import { reviewShort } from "@/stories/fixtures/review";
import { shelfList } from "@/stories/fixtures/shelf";
import { FeedLayout } from "../layouts/FeedLayout";
import { FeedRenderer } from "./FeedRenderer";

const postRow = {
  type: "post",
  rowId: "post:feed-post-1",
  post: postFlat[0],
  href: "/post/feed-post-1",
  recommendationReason: "global-post-rank",
} satisfies FeedRow;

const reviewRow = {
  type: "post",
  rowId: "post:feed-review-1",
  post: {
    ...reviewShort,
    unitId: "feed-review-1",
    kind: PostKind.REVIEW,
    targetUnitId: "book-many-1",
  },
  href: "/review/feed-review-1",
  targetUnit: {
    unitId: "book-many-1",
    title: "The Quiet Library",
  },
  recommendationReason: "book-library-review",
} satisfies FeedRow;

const bookRows = bookMany.slice(0, 2).map((book) => ({
  type: "book",
  rowId: `book:${book.unitId}`,
  href: `/book/${book.unitId}`,
  book: {
    unitId: book.unitId,
    kind: "book",
    title: book.title,
    subtitle: book.subtitle ?? "A catalog entry with community context",
    coverUrl: book.coverUrl,
    description: book.summary,
    primaryAuthor: {
      unitId: `author-${book.unitId}`,
      name: book.author ?? "Mira Hoshino",
      role: "author",
    },
    tags: [
      { unitId: `${book.unitId}-tag-1`, label: "Urban Fantasy" },
      { unitId: `${book.unitId}-tag-2`, label: "Archive" },
      { unitId: `${book.unitId}-tag-3`, label: "Translation" },
      { unitId: `${book.unitId}-tag-4`, label: "Community Pick" },
      { unitId: `${book.unitId}-tag-5`, label: "Longform" },
    ],
  },
  recommendationReason: "home-book-recommendation",
})) satisfies FeedRow[];

const shelfRows = shelfList.slice(0, 2).map((shelf) => ({
  type: "shelf",
  rowId: `shelf:${shelf.unitId}`,
  href: `/shelf/${shelf.unitId}`,
  shelf: {
    unitId: shelf.unitId,
    slug: shelf.slug,
    userId: shelf.userId,
    kindKey: shelf.kindKey,
    coverUrl: shelf.coverUrl,
    title: shelf.translations?.[0]?.title ?? null,
    itemCount: shelf.itemCount ?? shelf.items?.length ?? 0,
  },
  recommendationReason: "home-shelf-recommendation",
})) satisfies FeedRow[];

function Frame({ children }: { children: React.ReactNode }) {
  return <FeedLayout className="px-4 py-6">{children}</FeedLayout>;
}

const meta = {
  title: "App/Feed/FeedRenderer",
  component: FeedRenderer,
  decorators: [withRouter],
} satisfies Meta<typeof FeedRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ContentRows: Story = {
  render: () => (
    <Frame>
      <FeedRenderer rows={[postRow, reviewRow]} />
    </Frame>
  ),
};

export const ReviewTargetRow: Story = {
  render: () => (
    <Frame>
      <FeedRenderer rows={[reviewRow]} />
    </Frame>
  ),
};

export const BookRows: Story = {
  render: () => (
    <Frame>
      <FeedRenderer rows={bookRows} />
    </Frame>
  ),
};

export const ShelfRows: Story = {
  render: () => (
    <Frame>
      <FeedRenderer rows={shelfRows} />
    </Frame>
  ),
};

export const MixedRows: Story = {
  render: () => (
    <Frame>
      <FeedRenderer rows={[postRow, reviewRow, ...bookRows, ...shelfRows]} />
    </Frame>
  ),
};

export const Loading: Story = {
  render: () => (
    <Frame>
      <FeedRenderer rows={[]} loading />
    </Frame>
  ),
};

export const Empty: Story = {
  render: () => (
    <Frame>
      <FeedRenderer rows={[]} emptyTitle="No feed rows in this fixture" />
    </Frame>
  ),
};

export const RetryState: Story = {
  render: () => (
    <Frame>
      <FeedRenderer rows={[postRow, reviewRow]} />
      <div className="mt-4 flex justify-center">
        <Button type="button" variant="outline">
          Retry
        </Button>
      </div>
    </Frame>
  ),
};
