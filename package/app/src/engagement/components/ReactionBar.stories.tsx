import { reactionKeys } from "@rezics/api/reaction/reaction.keys";
import type {
  ReactionMyResponse,
  ReactionSummaryResponse,
} from "@rezics/api/reaction/reaction.types";
import { Card, CardContent } from "@rezics/ui/shadcn";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import type { Action } from "../types";
import { ReactionBar, type ReactionBarPolicy } from "./ReactionBar";

const samplePost = {
  unitId: "fixture-post-1",
  replyCount: 3,
};

const samplePolicy: ReactionBarPolicy = {
  getShareHref: () => "/fixture/share-url",
};

const contentAsArtifactActions: Action[] = ["vote", "reply", "shelf", "share"];
const discussionCardActions: Action[] = ["vote", "reply", "share", "more"];
const discussionCardOverflow: Action[] = ["shelf"];
const threadRowActions: Action[] = ["vote", "reply", "more"];
const threadRowOverflow: Action[] = ["share", "shelf"];

/**
 * Pre-populate the React Query cache with summary + my-reaction batches for
 * the demo unitId so `<ReactionBar>` renders the same hydrated state it would
 * in production. Mirrors the section-level `useReactionHydration` call.
 */
function useHydrateDemoReactions(
  unitIds: string[],
  summary: ReactionSummaryResponse["summaries"],
  userReactions: ReactionMyResponse["reactionsByTarget"],
) {
  const queryClient = useQueryClient();
  useEffect(() => {
    queryClient.setQueryData<ReactionSummaryResponse>(
      reactionKeys.summaryBatch(unitIds),
      { summaries: summary },
    );
    queryClient.setQueryData<ReactionMyResponse>(
      reactionKeys.myBatch(unitIds),
      { userId: "fixture-user", reactionsByTarget: userReactions },
    );
  }, [queryClient, unitIds, summary, userReactions]);
}

const HydratedReactionBar: React.FC<
  React.ComponentProps<typeof ReactionBar>
> = (props) => {
  useHydrateDemoReactions(
    [samplePost.unitId],
    { [samplePost.unitId]: { upvote: 42, downvote: 5 } },
    { [samplePost.unitId]: ["upvote"] },
  );
  return <ReactionBar {...props} />;
};

const meta = {
  title: "App/Engagement/ReactionBar",
  component: ReactionBar,
} satisfies Meta<typeof ReactionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PlainSm: Story = {
  render: () => (
    <HydratedReactionBar
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
    <HydratedReactionBar
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
    <HydratedReactionBar
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
    <HydratedReactionBar
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
    <HydratedReactionBar
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
    <HydratedReactionBar
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
          <p className="text-sm text-text-secondary">
            A short snippet of the post body to give the bar a real surface to
            sit against.
          </p>
          <HydratedReactionBar
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
      <HydratedReactionBar
        size="md"
        variant="plain"
        post={samplePost}
        policy={samplePolicy}
        actions={contentAsArtifactActions}
      />
    </div>
  ),
};
