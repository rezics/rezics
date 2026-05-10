export type VoteValue = "like" | "dislike" | null;

export type VoteAction =
  | { kind: "auth-required" }
  | { kind: "noop" }
  | { kind: "create"; reaction: "like" | "dislike" }
  | { kind: "delete"; reaction: "like" | "dislike" }
  | { kind: "swap"; remove: "like" | "dislike"; add: "like" | "dislike" };

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
