import { Card, CardContent } from "@rezics/ui/shadcn";
import type { Meta, StoryObj } from "@storybook/react-vite";

import type { Action } from "../types";
import { ReactionBar, type ReactionBarPolicy } from "./ReactionBar";

const samplePost = {
  unitId: "fixture-post-1",
  reactionSummaries: [
    { reaction: "like", count: 42 },
    { reaction: "dislike", count: 5 },
  ],
  replyCount: 3,
  userReactions: ["like"],
};

const samplePolicy: ReactionBarPolicy = {
  getShareHref: () => "/fixture/share-url",
};

const contentAsArtifactActions: Action[] = ["vote", "reply", "shelf", "share"];
const discussionCardActions: Action[] = ["vote", "reply", "share"];
const discussionCardOverflow: Action[] = ["shelf"];
const threadRowActions: Action[] = ["vote", "reply"];
const threadRowOverflow: Action[] = ["share", "shelf"];

const meta = {
  title: "App/Engagement/ReactionBar",
  component: ReactionBar,
} satisfies Meta<typeof ReactionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PlainSm: Story = {
  render: () => (
    <ReactionBar
      size="sm"
      variant="plain"
      post={samplePost}
      policy={samplePolicy}
      actions={threadRowActions}
      overflow={threadRowOverflow}
    />
  ),
};

export const PlainMd: Story = {
  render: () => (
    <ReactionBar
      size="md"
      variant="plain"
      post={samplePost}
      policy={samplePolicy}
      actions={discussionCardActions}
      overflow={discussionCardOverflow}
    />
  ),
};

export const PlainLg: Story = {
  render: () => (
    <ReactionBar
      size="lg"
      variant="plain"
      post={samplePost}
      policy={samplePolicy}
      actions={contentAsArtifactActions}
    />
  ),
};

export const PillSm: Story = {
  render: () => (
    <ReactionBar
      size="sm"
      variant="pill"
      post={samplePost}
      policy={samplePolicy}
      actions={threadRowActions}
      overflow={threadRowOverflow}
    />
  ),
};

export const PillMd: Story = {
  render: () => (
    <ReactionBar
      size="md"
      variant="pill"
      post={samplePost}
      policy={samplePolicy}
      actions={discussionCardActions}
      overflow={discussionCardOverflow}
    />
  ),
};

export const PillLg: Story = {
  render: () => (
    <ReactionBar
      size="lg"
      variant="pill"
      post={samplePost}
      policy={samplePolicy}
      actions={contentAsArtifactActions}
    />
  ),
};

/**
 * Pill variant inside a real card surface — the capsule background is a
 * translucent neutral overlay so it fuses with whatever surface is hosting it.
 */
export const PillInCard: Story = {
  render: () => (
    <Card className="max-w-[520px]">
      <CardContent>
        <div className="flex flex-col gap-3">
          <div className="text-sm font-semibold">Discussion thread title</div>
          <p className="text-sm text-rezics-color-fg-muted">
            A short snippet of the post body to give the bar a real surface to
            sit against.
          </p>
          <ReactionBar
            size="md"
            variant="pill"
            post={samplePost}
            policy={samplePolicy}
            actions={discussionCardActions}
            overflow={discussionCardOverflow}
          />
        </div>
      </CardContent>
    </Card>
  ),
};

/**
 * Plain variant inside a hero-style header strip — icon-only, no background,
 * sits flush with the meta info on its left.
 */
export const PlainInHero: Story = {
  render: () => (
    <div
      className="flex max-w-[640px] justify-end rounded-lg p-6 text-white"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
    >
      <ReactionBar
        size="md"
        variant="plain"
        post={samplePost}
        policy={samplePolicy}
        actions={contentAsArtifactActions}
      />
    </div>
  ),
};
