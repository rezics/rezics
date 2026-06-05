import { reactionKeys } from "@rezics/api/reaction/reaction.keys";
import type {
  ReactionMyResponse,
  ReactionSummaryResponse,
} from "@rezics/api/reaction/reaction.types";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { VoteGroup } from "./VoteGroup";

function useHydrate(
  unitId: string,
  summary: Record<string, number>,
  userReactions: string[],
) {
  const queryClient = useQueryClient();
  useEffect(() => {
    queryClient.setQueryData<ReactionSummaryResponse>(
      reactionKeys.summaryBatch([unitId]),
      { summaries: { [unitId]: summary } },
    );
    queryClient.setQueryData<ReactionMyResponse>(
      reactionKeys.myBatch([unitId]),
      {
        userId: "fixture-user",
        reactionsByTarget: { [unitId]: userReactions },
      },
    );
  }, [queryClient, unitId, summary, userReactions]);
}

const HydratedVoteGroup: React.FC<{
  targetUnitId: string;
  size: "sm" | "md" | "lg";
  summary: Record<string, number>;
  userReactions: string[];
}> = ({ targetUnitId, size, summary, userReactions }) => {
  useHydrate(targetUnitId, summary, userReactions);
  return <VoteGroup size={size} targetUnitId={targetUnitId} />;
};

const meta = {
  title: "App/Engagement/VoteGroup",
  component: VoteGroup,
} satisfies Meta<typeof VoteGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SmZeroScoreNoVote: Story = {
  render: () => (
    <HydratedVoteGroup
      size="sm"
      targetUnitId="fixture-vote-1"
      summary={{}}
      userReactions={[]}
    />
  ),
};

export const MdPositiveUpvoted: Story = {
  render: () => (
    <HydratedVoteGroup
      size="md"
      targetUnitId="fixture-vote-2"
      summary={{ upvote: 42 }}
      userReactions={["upvote"]}
    />
  ),
};

export const MdNegativeDownvoted: Story = {
  render: () => (
    <HydratedVoteGroup
      size="md"
      targetUnitId="fixture-vote-3"
      summary={{ downvote: 7 }}
      userReactions={["downvote"]}
    />
  ),
};

export const LgAbbreviated3Point1K: Story = {
  render: () => (
    <HydratedVoteGroup
      size="lg"
      targetUnitId="fixture-vote-4"
      summary={{ upvote: 3147 }}
      userReactions={[]}
    />
  ),
};
