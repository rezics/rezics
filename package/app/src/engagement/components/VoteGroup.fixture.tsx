import { VoteGroup } from "./VoteGroup";

export default {
  "sm · zero score · no vote": () => (
    <VoteGroup
      size="sm"
      targetUnitId="fixture-vote-1"
      initialScore={0}
      initialUserVote={null}
    />
  ),
  "md · positive · upvoted": () => (
    <VoteGroup
      size="md"
      targetUnitId="fixture-vote-2"
      initialScore={42}
      initialUserVote="like"
    />
  ),
  "md · negative · downvoted": () => (
    <VoteGroup
      size="md"
      targetUnitId="fixture-vote-3"
      initialScore={-7}
      initialUserVote="dislike"
    />
  ),
  "lg · abbreviated 3.1K": () => (
    <VoteGroup
      size="lg"
      targetUnitId="fixture-vote-4"
      initialScore={3147}
      initialUserVote={null}
    />
  ),
};
