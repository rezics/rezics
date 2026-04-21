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

export default {
  "sm · thread row": () => (
    <ReactionBar
      size="sm"
      post={samplePost}
      policy={samplePolicy}
      actions={threadRowActions}
      overflow={threadRowOverflow}
    />
  ),
  "md · discussion card": () => (
    <ReactionBar
      size="md"
      post={samplePost}
      policy={samplePolicy}
      actions={discussionCardActions}
      overflow={discussionCardOverflow}
    />
  ),
  "md · content-as-artifact card": () => (
    <ReactionBar
      size="md"
      post={samplePost}
      policy={samplePolicy}
      actions={contentAsArtifactActions}
    />
  ),
  "lg · detail surface": () => (
    <ReactionBar
      size="lg"
      post={samplePost}
      policy={samplePolicy}
      actions={contentAsArtifactActions}
    />
  ),
};
