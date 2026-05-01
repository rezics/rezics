import type { Meta, StoryObj } from "@storybook/react-vite";

import { VoteGroup } from "./VoteGroup";

const meta = {
  title: "App/Engagement/VoteGroup",
  component: VoteGroup,
} satisfies Meta<typeof VoteGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SmZeroScoreNoVote: Story = {
  render: () => (
    <VoteGroup
      size="sm"
      targetUnitId="fixture-vote-1"
      initialScore={0}
      initialUserVote={null}
    />
  ),
};

export const MdPositiveUpvoted: Story = {
  render: () => (
    <VoteGroup
      size="md"
      targetUnitId="fixture-vote-2"
      initialScore={42}
      initialUserVote="like"
    />
  ),
};

export const MdNegativeDownvoted: Story = {
  render: () => (
    <VoteGroup
      size="md"
      targetUnitId="fixture-vote-3"
      initialScore={-7}
      initialUserVote="dislike"
    />
  ),
};

export const LgAbbreviated3Point1K: Story = {
  render: () => (
    <VoteGroup
      size="lg"
      targetUnitId="fixture-vote-4"
      initialScore={3147}
      initialUserVote={null}
    />
  ),
};
