export type VoteValue = "upvote" | "downvote" | null;

export type VoteAction =
  | { kind: "auth-required" }
  | { kind: "noop" }
  | { kind: "create"; reaction: "upvote" | "downvote" }
  | { kind: "delete"; reaction: "upvote" | "downvote" }
  | { kind: "swap"; remove: "upvote" | "downvote"; add: "upvote" | "downvote" };

export function decideVoteAction(args: {
  isAuthenticated: boolean;
  userVote: VoteValue;
  next: VoteValue;
}): VoteAction {
  if (!args.isAuthenticated) return { kind: "auth-required" };
  if (args.userVote === args.next) return { kind: "noop" };
  if (args.userVote && !args.next) {
    return { kind: "delete", reaction: args.userVote };
  }
  if (!args.userVote && args.next) {
    return { kind: "create", reaction: args.next };
  }
  if (args.userVote && args.next) {
    return { kind: "swap", remove: args.userVote, add: args.next };
  }
  return { kind: "noop" };
}
