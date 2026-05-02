import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
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
    <Card sx={{ maxWidth: 520 }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Discussion thread title</Typography>
          <Typography variant="body2" color="text.secondary">
            A short snippet of the post body to give the bar a real surface to
            sit against.
          </Typography>
          <ReactionBar
            size="md"
            variant="pill"
            post={samplePost}
            policy={samplePolicy}
            actions={discussionCardActions}
            overflow={discussionCardOverflow}
          />
        </Stack>
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
    <Box
      sx={{
        bgcolor: "rgba(0,0,0,0.7)",
        color: "common.white",
        p: 3,
        borderRadius: 2,
        maxWidth: 640,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <ReactionBar
        size="md"
        variant="plain"
        post={samplePost}
        policy={samplePolicy}
        actions={contentAsArtifactActions}
      />
    </Box>
  ),
};
