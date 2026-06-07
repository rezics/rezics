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

const contentRow = {
  type: "content",
  rowId: "post:feed-post-1",
  post: postFlat[0],
  href: "/post/feed-post-1",
  recommendationReason: "global-post-rank",
} satisfies FeedRow;

const reviewRow = {
  type: "content",
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

const workCarouselRow = {
  type: "carousel",
  rowId: "carousel:home:works",
  carouselKind: "works",
  title: { key: "feed.carousel.works" },
  works: bookMany.slice(0, 6).map((book) => ({
    unitId: book.unitId,
    kind: "book",
    title: book.title,
    coverUrl: book.coverUrl,
  })),
} satisfies FeedRow;

const shelfCarouselRow = {
  type: "carousel",
  rowId: "carousel:home:shelves",
  carouselKind: "shelves",
  title: { key: "feed.carousel.shelves" },
  shelves: shelfList.map((shelf) => ({
    unitId: shelf.unitId,
    slug: shelf.slug,
    userId: shelf.userId,
    kindKey: shelf.kindKey,
    coverUrl: shelf.coverUrl,
    title: shelf.translations?.[0]?.title ?? null,
    itemCount: shelf.itemCount ?? shelf.items?.length ?? 0,
  })),
} satisfies FeedRow;

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
      <FeedRenderer rows={[contentRow, reviewRow]} />
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

export const WorkCarousel: Story = {
  render: () => (
    <Frame>
      <FeedRenderer rows={[workCarouselRow]} />
    </Frame>
  ),
};

export const ShelfCarousel: Story = {
  render: () => (
    <Frame>
      <FeedRenderer rows={[shelfCarouselRow]} />
    </Frame>
  ),
};

export const MixedRows: Story = {
  render: () => (
    <Frame>
      <FeedRenderer
        rows={[contentRow, reviewRow, workCarouselRow, contentRow]}
      />
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
      <FeedRenderer rows={[contentRow, reviewRow]} />
      <div className="mt-4 flex justify-center">
        <Button type="button" variant="outline">
          Retry
        </Button>
      </div>
    </Frame>
  ),
};
