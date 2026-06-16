import { type StreamRow, PostKind } from "@rezics/contract";
import { Button } from "@rezics/ui/shadcn";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type React from "react";
import { withRouter } from "@/stories/decorators/withRouter";
import { bookMany } from "@/stories/fixtures/book";
import { postFlat } from "@/stories/fixtures/post";
import { reviewShort } from "@/stories/fixtures/review";
import { shelfList } from "@/stories/fixtures/shelf";
import { StreamLayout } from "../layouts/StreamLayout";
import { StreamRenderer } from "./StreamRenderer";

const postRow = {
  type: "post",
  rowId: "post:stream-post-1",
  post: postFlat[0],
  href: "/post/stream-post-1",
  recommendationReason: "global-post-rank",
} satisfies StreamRow;

const reviewRow = {
  type: "post",
  rowId: "post:stream-review-1",
  post: {
    ...reviewShort,
    unitId: "stream-review-1",
    kind: PostKind.REVIEW,
    targetUnitId: "book-many-1",
  },
  href: "/review/stream-review-1",
  recommendationReason: "book-library-review",
} satisfies StreamRow;

const bookRows = bookMany.slice(0, 2).map((book) => ({
  type: "book",
  rowId: `book:${book.unitId}`,
  href: `/book/${book.unitId}`,
  book: {
    ...book,
    subtitle: book.subtitle ?? "A catalog entry with community context",
  },
  recommendationReason: "home-book-recommendation",
})) satisfies StreamRow[];

const shelfRows = shelfList.slice(0, 2).map((shelf) => ({
  type: "shelf",
  rowId: `shelf:${shelf.unitId}`,
  href: `/shelf/${shelf.unitId}`,
  shelf,
  recommendationReason: "home-shelf-recommendation",
})) satisfies StreamRow[];

function Frame({ children }: { children: React.ReactNode }) {
  return <StreamLayout className="px-4 py-6">{children}</StreamLayout>;
}

const meta = {
  title: "App/Stream/StreamRenderer",
  component: StreamRenderer,
  decorators: [withRouter],
} satisfies Meta<typeof StreamRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ContentRows: Story = {
  render: () => (
    <Frame>
      <StreamRenderer rows={[postRow, reviewRow]} />
    </Frame>
  ),
};

export const ReviewTargetRow: Story = {
  render: () => (
    <Frame>
      <StreamRenderer rows={[reviewRow]} />
    </Frame>
  ),
};

export const BookRows: Story = {
  render: () => (
    <Frame>
      <StreamRenderer rows={bookRows} />
    </Frame>
  ),
};

export const ShelfRows: Story = {
  render: () => (
    <Frame>
      <StreamRenderer rows={shelfRows} />
    </Frame>
  ),
};

export const MixedRows: Story = {
  render: () => (
    <Frame>
      <StreamRenderer rows={[postRow, reviewRow, ...bookRows, ...shelfRows]} />
    </Frame>
  ),
};

export const Loading: Story = {
  render: () => (
    <Frame>
      <StreamRenderer rows={[]} loading />
    </Frame>
  ),
};

export const Empty: Story = {
  render: () => (
    <Frame>
      <StreamRenderer rows={[]} emptyTitle="No stream rows in this fixture" />
    </Frame>
  ),
};

export const RetryState: Story = {
  render: () => (
    <Frame>
      <StreamRenderer rows={[postRow, reviewRow]} />
      <div className="mt-4 flex justify-center">
        <Button type="button" variant="outline">
          Retry
        </Button>
      </div>
    </Frame>
  ),
};
