import { describe, expect, it } from "bun:test";
import { decideVoteAction } from "./voteAction";

describe("decideVoteAction", () => {
  it("returns auth-required when unauthenticated regardless of vote intent", () => {
    expect(
      decideVoteAction({
        isAuthenticated: false,
        userVote: null,
        next: "like",
      }),
    ).toEqual({ kind: "auth-required" });

    expect(
      decideVoteAction({
        isAuthenticated: false,
        userVote: "like",
        next: null,
      }),
    ).toEqual({ kind: "auth-required" });
  });

  it("noops when authenticated user clicks the active arrow with no change", () => {
    expect(
      decideVoteAction({
        isAuthenticated: true,
        userVote: "like",
        next: "like",
      }),
    ).toEqual({ kind: "noop" });
  });

  it("creates a reaction when authenticated user adds a fresh vote", () => {
    expect(
      decideVoteAction({
        isAuthenticated: true,
        userVote: null,
        next: "like",
      }),
    ).toEqual({ kind: "create", reaction: "like" });

    expect(
      decideVoteAction({
        isAuthenticated: true,
        userVote: null,
        next: "dislike",
      }),
    ).toEqual({ kind: "create", reaction: "dislike" });
  });

  it("deletes a reaction when authenticated user untoggles", () => {
    expect(
      decideVoteAction({
        isAuthenticated: true,
        userVote: "like",
        next: null,
      }),
    ).toEqual({ kind: "delete", reaction: "like" });

    expect(
      decideVoteAction({
        isAuthenticated: true,
        userVote: "dislike",
        next: null,
      }),
    ).toEqual({ kind: "delete", reaction: "dislike" });
  });

  it("swaps reactions when authenticated user flips between like and dislike", () => {
    expect(
      decideVoteAction({
        isAuthenticated: true,
        userVote: "like",
        next: "dislike",
      }),
    ).toEqual({ kind: "swap", remove: "like", add: "dislike" });

    expect(
      decideVoteAction({
        isAuthenticated: true,
        userVote: "dislike",
        next: "like",
      }),
    ).toEqual({ kind: "swap", remove: "dislike", add: "like" });
  });
});
