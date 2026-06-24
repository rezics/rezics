import { describe, expect, it } from "bun:test";
import { decideVoteAction } from "./voteAction";

describe("decideVoteAction", () => {
  it("returns auth-required when unauthenticated regardless of vote intent", () => {
    expect(
      decideVoteAction({
        isAuthenticated: false,
        userVote: null,
        next: "upvote",
      }),
    ).toEqual({ kind: "auth-required" });

    expect(
      decideVoteAction({
        isAuthenticated: false,
        userVote: "upvote",
        next: null,
      }),
    ).toEqual({ kind: "auth-required" });
  });

  it("noops when authenticated user clicks the active arrow with no change", () => {
    expect(
      decideVoteAction({
        isAuthenticated: true,
        userVote: "upvote",
        next: "upvote",
      }),
    ).toEqual({ kind: "noop" });
  });

  it("creates a reaction when authenticated user adds a fresh vote", () => {
    expect(
      decideVoteAction({
        isAuthenticated: true,
        userVote: null,
        next: "upvote",
      }),
    ).toEqual({ kind: "create", reaction: "upvote" });

    expect(
      decideVoteAction({
        isAuthenticated: true,
        userVote: null,
        next: "downvote",
      }),
    ).toEqual({ kind: "create", reaction: "downvote" });
  });

  it("deletes a reaction when authenticated user untoggles", () => {
    expect(
      decideVoteAction({
        isAuthenticated: true,
        userVote: "upvote",
        next: null,
      }),
    ).toEqual({ kind: "delete", reaction: "upvote" });

    expect(
      decideVoteAction({
        isAuthenticated: true,
        userVote: "downvote",
        next: null,
      }),
    ).toEqual({ kind: "delete", reaction: "downvote" });
  });

  it("swaps reactions when authenticated user flips between upvote and downvote", () => {
    expect(
      decideVoteAction({
        isAuthenticated: true,
        userVote: "upvote",
        next: "downvote",
      }),
    ).toEqual({ kind: "swap", remove: "upvote", add: "downvote" });

    expect(
      decideVoteAction({
        isAuthenticated: true,
        userVote: "downvote",
        next: "upvote",
      }),
    ).toEqual({ kind: "swap", remove: "downvote", add: "upvote" });
  });
});
