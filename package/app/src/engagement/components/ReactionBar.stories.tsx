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

export const SmThreadRow: Story = {
  render: () => (
    <ReactionBar
      size="sm"
      post={samplePost}
      policy={samplePolicy}
      actions={threadRowActions}
      overflow={threadRowOverflow}
    />
  ),
};

export const MdDiscussionCard: Story = {
  render: () => (
    <ReactionBar
      size="md"
      post={samplePost}
      policy={samplePolicy}
      actions={discussionCardActions}
      overflow={discussionCardOverflow}
    />
  ),
};

export const MdContentAsArtifactCard: Story = {
  render: () => (
    <ReactionBar
      size="md"
      post={samplePost}
      policy={samplePolicy}
      actions={contentAsArtifactActions}
    />
  ),
};

export const LgDetailSurface: Story = {
  render: () => (
    <ReactionBar
      size="lg"
      post={samplePost}
      policy={samplePolicy}
      actions={contentAsArtifactActions}
    />
  ),
};
