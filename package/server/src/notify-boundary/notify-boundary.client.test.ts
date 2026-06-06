import { describe, expect, test } from "bun:test";
import type { NotificationPreference } from "@rezics/contract";
import type { BroadcastEvent } from "./notify-boundary.client";

const { filterRecipientsByPreference, resolveRecipients } = await import(
  "./notify-boundary.client.ts?notify-client-test-actual" as string
);

/**
 * Unit tests for the recipient resolver. The storage-backed
 * `defaultFindSubscriptionMatches` is replaced with an injected stub so
 * these tests verify the resolver's union/dedup logic without a DB.
 * Integration coverage of the three-tier GIN-indexed match query lives
 * with the migration verification scripts.
 */

function evt(partial: Partial<BroadcastEvent> = {}): BroadcastEvent {
  return {
    kind: "chapter.new",
    sourceUnitId: "00000000-0000-0000-0000-000000000001",
    ...partial,
  };
}

describe("resolveRecipients", () => {
  test("returns subscribers from findSubscriptionMatches", async () => {
    const recipients = await resolveRecipients(evt(), {
      findSubscriptionMatches: async () => ["sub-1", "sub-2"],
    });
    expect(recipients.sort()).toEqual(["sub-1", "sub-2"]);
  });

  test("unions directRecipients with subscription matches", async () => {
    const recipients = await resolveRecipients(
      evt({ directRecipients: ["direct-1", "direct-2"] }),
      { findSubscriptionMatches: async () => ["sub-1"] },
    );
    expect(recipients.sort()).toEqual(["direct-1", "direct-2", "sub-1"]);
  });

  test("dedupes when a direct recipient is also a subscriber", async () => {
    const recipients = await resolveRecipients(
      evt({ directRecipients: ["dup", "direct-only"] }),
      {
        findSubscriptionMatches: async () => ["dup", "sub-only"],
      },
    );
    expect(recipients.sort()).toEqual(["direct-only", "dup", "sub-only"]);
    expect(recipients).toHaveLength(3);
  });

  test("returns empty when no direct and no matches", async () => {
    const recipients = await resolveRecipients(evt(), {
      findSubscriptionMatches: async () => [],
    });
    expect(recipients).toEqual([]);
  });

  test("returns only directRecipients when subscription set is empty", async () => {
    const recipients = await resolveRecipients(
      evt({ directRecipients: ["a", "b"] }),
      { findSubscriptionMatches: async () => [] },
    );
    expect(recipients.sort()).toEqual(["a", "b"]);
  });

  test("directOnly skips subscription matches", async () => {
    const recipients = await resolveRecipients(
      evt({ directOnly: true, directRecipients: ["a", "b"] }),
      { findSubscriptionMatches: async () => ["sub-1"] },
    );
    expect(recipients.sort()).toEqual(["a", "b"]);
  });

  test("dedupes duplicate direct recipients", async () => {
    const recipients = await resolveRecipients(
      evt({ directRecipients: ["a", "a", "b"] }),
      { findSubscriptionMatches: async () => [] },
    );
    expect(recipients.sort()).toEqual(["a", "b"]);
  });

  test("passes sourceUnitId and kind through to the matcher", async () => {
    let seenTarget: string | undefined;
    let seenKind: string | undefined;
    await resolveRecipients(
      { kind: "review.updated", sourceUnitId: "book-42" },
      {
        findSubscriptionMatches: async (target: string, kind: string) => {
          seenTarget = target;
          seenKind = kind;
          return [];
        },
      },
    );
    expect(seenTarget).toBe("book-42");
    expect(seenKind).toBe("review.updated");
  });
});

describe("filterRecipientsByPreference", () => {
  const prefs = (
    entries: Record<string, NotificationPreference>,
  ): ((
    ids: string[],
  ) => Promise<Map<string, NotificationPreference | undefined>>) => {
    return async (ids: string[]) =>
      new Map<string, NotificationPreference | undefined>(
        ids.filter((id) => id in entries).map((id) => [id, entries[id]]),
      );
  };

  test("suppresses a kind for recipients who disabled its toggle", async () => {
    const result = await filterRecipientsByPreference(
      ["opted-out", "opted-in", "default"],
      "follow.new",
      prefs({
        "opted-out": { follow: false },
        "opted-in": { follow: true },
      }),
    );
    // "default" has no stored preference -> enabled by default.
    expect(result.sort()).toEqual(["default", "opted-in"]);
  });

  test("other kinds still deliver when an unrelated toggle is off", async () => {
    // Same recipient who disabled follow still receives a reply notification.
    const result = await filterRecipientsByPreference(
      ["user-1"],
      "comment.new",
      prefs({ "user-1": { follow: false } }),
    );
    expect(result).toEqual(["user-1"]);
  });

  test("ungated kinds pass through without a preference lookup", async () => {
    let called = false;
    const result = await filterRecipientsByPreference(
      ["a", "b"],
      "reaction.upvote",
      async (ids: string[]) => {
        called = true;
        return new Map(ids.map((id: string) => [id, {}]));
      },
    );
    expect(result).toEqual(["a", "b"]);
    expect(called).toBe(false);
  });

  test("empty recipient set short-circuits", async () => {
    const result = await filterRecipientsByPreference([], "follow.new");
    expect(result).toEqual([]);
  });

  test("maps follow category kinds to the follow toggle", async () => {
    const result = await filterRecipientsByPreference(
      ["blocked"],
      "follow.new",
      prefs({ blocked: { follow: false } }),
    );
    expect(result).toEqual([]);
  });
});
