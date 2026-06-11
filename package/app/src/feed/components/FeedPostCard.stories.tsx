import { PostKind } from "@rezics/contract";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { withRouter } from "@/stories/decorators/withRouter";
import { postLongBody } from "@/stories/fixtures/post";
import { reviewShort } from "@/stories/fixtures/review";
import { FeedPostCard } from "./FeedPostCard";

const withCardFrame: Decorator = (Story) => (
  <div className="max-w-[45.75rem] bg-surface-canvas p-4 text-text-primary">
    <Story />
  </div>
);

const meta = {
  title: "App/Feed/FeedPostCard",
  component: FeedPostCard,
  decorators: [withRouter, withCardFrame],
  args: {
    post: postLongBody,
    title: "A feed card title can clamp independently from the body",
    onOpen: () => undefined,
  },
} satisfies Meta<typeof FeedPostCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongBodyTruncation: Story = {
  args: {
    bodyLines: 3,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      canvas.queryByRole("button", { name: /expand|collapse/i }),
    ).not.toBeInTheDocument();
  },
};

export const Review: Story = {
  args: {
    post: {
      ...reviewShort,
      unitId: "feed-review-card",
      kind: PostKind.REVIEW,
      targetUnitId: "book-many-1",
    },
    targetUnit: {
      unitId: "book-many-1",
      title: "The Quiet Library",
    },
  },
};

export const WithInlineMedia: Story = {
  args: {
    mediaSlot: (
      <div className="h-full w-full bg-surface-sunken" aria-hidden="true" />
    ),
  },
};

export const MediaForward: Story = {
  args: {
    mediaMode: "forward",
    mediaSlot: (
      <div className="flex h-full w-full items-center justify-center bg-surface-sunken text-sm leading-ui text-text-secondary">
        Media
      </div>
    ),
  },
};
